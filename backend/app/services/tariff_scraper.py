"""
Servicio de scraping de tarifas de electricidad EPM para collectors-forge-studio.

Descarga automáticamente el PDF de tarifas mensuales publicado por
Empresas Públicas de Medellín (EPM) en su sitio web oficial, extrae
las tarifas de los 6 estratos residenciales en COP/kWh, aplica el
multiplicador ×2 (estimación conservadora del próximo mes) a cada una,
y las convierte a USD/kWh usando la tasa de cambio actual.

El resultado completo (todos los estratos) se cachea durante 24 horas
para evitar descargas repetidas del PDF. Si el scraping falla (PDF no
disponible, cambio de estructura, sin red), se devuelve el último valor
cacheado o None.
"""

import re
import io
import time
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict

import httpx
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

EPM_TARIFFS_URL = "https://www.epm.com.co/clientesyusuarios/energia/tarifas-energia/"
EPM_BASE_URL = "https://www.epm.com.co"

# Multiplicador aplicado a la tarifa de mercado (factor de estimación conservadora)
TARIFF_MULTIPLIER = 2.0

# Caché: diccionario con resultado y timestamp
# NOTA (M-01): caché module-global — válido con --workers 1 (configuración actual).
# Con múltiples workers, cada proceso descarga el PDF por separado. Migrar a Redis
# o BD si se escala horizontalmente.
_cache: Optional[Dict] = None
_CACHE_TTL = 86400  # 24 horas


async def get_epm_estrato4_tariff(force: bool = False) -> Optional[Dict]:
    """
    Obtiene las tarifas de electricidad EPM para todos los estratos con factor ×2.

    Flujo de ejecución:
    1. Devuelve el caché si tiene menos de 24 horas (salvo force=True).
    2. Scraping de la página EPM para encontrar el PDF del mes más reciente.
    3. Descarga y parsea el PDF con pdfplumber.
    4. Extrae las tarifas de los 6 estratos residenciales en COP/kWh.
    5. Aplica el multiplicador ×2 a cada una.
    6. Convierte a USD/kWh usando la tasa de cambio actual.

    Args:
        force: Si True, ignora el caché y hace scraping inmediato.

    Returns:
        dict con las claves:
            - cop_market_rate: tarifa EPM Estrato 4 original (COP/kWh) — compatibilidad
            - cop_rate_used: tarifa Estrato 4 aplicada = cop_market_rate × TARIFF_MULTIPLIER
            - multiplier: factor aplicado (2.0)
            - usd_rate: tarifa Estrato 4 en USD/kWh
            - usd_to_cop: tasa de cambio usada para la conversión
            - month_label: texto del mes al que corresponde la tarifa
            - pdf_url: URL del PDF descargado
            - estratos: dict {"1": {...}, "2": {...}, ..., "6": {...}} con cop_market_rate,
                        cop_rate_used y usd_rate por estrato
        None si no se pudo obtener la tarifa.
    """
    global _cache

    # Devolver caché si está vigente (a menos que se pida forzar actualización)
    if not force and _cache is not None and time.time() - _cache["ts"] < _CACHE_TTL:
        return _cache["data"]

    try:
        pdf_url, month_label, year, month_num = await _find_latest_pdf_url()
        if not pdf_url:
            logger.warning("No se encontró URL del PDF de tarifas EPM")
            return _cache["data"] if _cache else None

        estratos_cop = await _extract_all_estratos(pdf_url)
        if not estratos_cop:
            logger.warning("No se pudo extraer ningún estrato del PDF")
            return _cache["data"] if _cache else None

        # Importar aquí para evitar importación circular
        from app.services.exchange_rate import get_usd_to_cop
        usd_to_cop = await get_usd_to_cop()

        # Construir dict completo por estrato
        estratos_full = {}
        for num, cop_r in estratos_cop.items():
            cop_used = round(cop_r * TARIFF_MULTIPLIER, 2)
            usd_r = round(cop_used / usd_to_cop, 6)
            estratos_full[num] = {
                "cop_market_rate": cop_r,
                "cop_rate_used": cop_used,
                "usd_rate": usd_r,
            }

        # Estrato 4 como valor principal (compatibilidad con código existente)
        estrato4 = estratos_cop.get("4", next(iter(estratos_cop.values())))
        cop_rate_used = round(estrato4 * TARIFF_MULTIPLIER, 2)
        usd_rate = round(cop_rate_used / usd_to_cop, 6)

        data = {
            "cop_market_rate": estrato4,
            "cop_rate_used": cop_rate_used,
            "multiplier": TARIFF_MULTIPLIER,
            "usd_rate": usd_rate,
            "usd_to_cop": usd_to_cop,
            "month_label": month_label,
            "year": year,
            "month": month_num,
            "pdf_url": pdf_url,
            "estratos": estratos_full,
        }
        _cache = {"data": data, "ts": time.time()}
        logger.info(
            f"Tarifa EPM actualizada: {len(estratos_full)} estratos extraídos. "
            f"Estrato 4 = {estrato4} COP/kWh → ×{TARIFF_MULTIPLIER} → {usd_rate} USD/kWh"
        )
        return data

    except Exception as e:
        logger.error(f"Error obteniendo tarifa EPM: {e}")
        return _cache["data"] if _cache else None


_MONTH_NAMES = {
    "enero": 1, "febrero": 2, "marzo": 3, "abril": 4,
    "mayo": 5, "junio": 6, "julio": 7, "agosto": 8,
    "septiembre": 9, "octubre": 10, "noviembre": 11, "diciembre": 12,
}


async def _find_latest_pdf_url() -> tuple:
    """
    Scraping de la página EPM para encontrar la URL del PDF más reciente.

    Estrategia:
    - Regex restringido a caracteres válidos de URL (excluye `\\&<>` y blancos)
      para no capturar blobs HTML escaped que EPM embebe en sus dropdowns.
    - Para cada match con año y mes parseables, escoge por `max((año, mes))`
      en lugar de la posición — más robusto a cambios de orden en el HTML.

    Returns:
        tuple: (url_absoluta, etiqueta_mes, year, month_num)
               o (None, None, None, None) si no se encontró.
    """
    async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
        response = await client.get(EPM_TARIFFS_URL)
        response.raise_for_status()
        html = response.text

    # Excluye `\&<>` y blancos para evitar capturar JSON/HTML escaped en blobs
    pattern = r'(/content/dam/epm/[^"\'\\&<>\s]*[Tt]arifa[^"\'\\&<>\s]*\.pdf)'
    matches = re.findall(pattern, html)

    if not matches:
        return None, None, None, None

    # Construye candidatos (year, month_num, path) y elige el más reciente
    candidates = []
    seen_paths = set()
    for path in matches:
        if path in seen_paths:
            continue
        seen_paths.add(path)

        month_match = re.search(
            r'(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)',
            path, re.IGNORECASE
        )
        # IMPORTANTE: tomar el ÚLTIMO año que aparece en el path. EPM usa rutas
        # tipo `.../Tarifas%202026/...Abril162026_ANT_OM.pdf` donde el regex
        # `20\d{2}` empareja primero `2020` por colisión con `%20` + `20...`.
        # El año real siempre está al final del nombre del archivo.
        year_matches = re.findall(r'20\d{2}', path)
        if not month_match or not year_matches:
            continue

        month_name = month_match.group(1).lower()
        month_num = _MONTH_NAMES.get(month_name)
        year = int(year_matches[-1])
        if month_num:
            candidates.append((year, month_num, month_name, path))

    if not candidates:
        return None, None, None, None

    year, month_num, month_name, latest_path = max(candidates, key=lambda c: (c[0], c[1]))
    full_url = EPM_BASE_URL + latest_path
    month_label = f"{month_name.capitalize()} {year}"
    return full_url, month_label, year, month_num


async def _extract_all_estratos(pdf_url: str) -> Optional[Dict]:
    """
    Descarga el PDF y extrae las tarifas de todos los estratos residenciales en COP/kWh.

    Recorre el texto completo del PDF buscando las filas de cada estrato (1-6).
    El primer valor numérico de cada fila es la tarifa con activos EPM (columna
    'Propiedad EPM'), que es el caso más común para usuarios residenciales.

    Args:
        pdf_url: URL completa del PDF de tarifas EPM.

    Returns:
        dict: {"1": 400.0, "2": 450.0, ..., "6": 950.0} con las tarifas encontradas,
              o None si no se pudo extraer ninguna.
    """
    try:
        import pdfplumber
    except ImportError:
        logger.error("pdfplumber no está instalado. Agrega 'pdfplumber' a requirements.txt")
        return None

    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
        response = await client.get(pdf_url)
        response.raise_for_status()
        pdf_bytes = response.content

    # Concatenar texto de todas las páginas para búsqueda global
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        full_text = "\n".join(page.extract_text() or "" for page in pdf.pages)

    estratos = {}
    for n in range(1, 7):
        # Patrón: "Estrato 4. Todo el consumo 801.24 766.87 ..."
        # El primer valor numérico es la tarifa con propiedad EPM
        match = re.search(rf'Estrato\s+{n}[^\d]+([\d,\.]+)', full_text)
        if match:
            rate_str = match.group(1).replace(",", "")
            try:
                estratos[str(n)] = float(rate_str)
            except ValueError:
                pass

    return estratos if estratos else None


async def persist_tariffs(db: AsyncSession, data: Dict) -> int:
    """
    Inserta los estratos del scrape en la tabla `electricity_tariffs` si no existen.

    Idempotente: usa UNIQUE(year, month, estrato) para detectar duplicados
    en aplicación. Hace commit solo si insertó al menos un registro.

    Args:
        db:   Sesión async activa.
        data: Dict retornado por `get_epm_estrato4_tariff()`.

    Returns:
        int: Número de registros nuevos insertados (0..6).
    """
    # Importación tardía para evitar ciclo con app.models
    from app.models.electricity_tariff import ElectricityTariff

    year = data.get("year")
    month = data.get("month")
    if not year or not month:
        return 0

    inserted = 0
    for estrato_num_str, estrato_data in data.get("estratos", {}).items():
        estrato_num = int(estrato_num_str)
        existing = await db.execute(
            select(ElectricityTariff).where(
                ElectricityTariff.year == year,
                ElectricityTariff.month == month,
                ElectricityTariff.estrato == estrato_num,
            )
        )
        if existing.scalar_one_or_none() is None:
            db.add(ElectricityTariff(
                year=year,
                month=month,
                month_label=data["month_label"],
                estrato=estrato_num,
                cop_market_rate=estrato_data["cop_market_rate"],
                cop_rate_used=estrato_data["cop_rate_used"],
                usd_rate=estrato_data["usd_rate"],
                usd_to_cop=data["usd_to_cop"],
                multiplier=data["multiplier"],
                pdf_url=data.get("pdf_url"),
                scraped_at=datetime.now(timezone.utc).replace(tzinfo=None),
            ))
            inserted += 1
    if inserted:
        await db.commit()
    return inserted


async def refresh_if_stale(db: AsyncSession, max_age_days: int = 7) -> Optional[Dict]:
    """
    Scraping condicional: solo descarga el PDF EPM si el último registro en BD
    tiene más de `max_age_days` días.

    Pensado para ejecutarse en una tarea de fondo periódica (lifespan) sin
    saturar el portal EPM. EPM publica una vez al mes, así que un intervalo
    semanal cubre la latencia de publicación con holgura (~4-5 hits/mes max).

    Args:
        db:           Sesión async activa.
        max_age_days: Edad mínima del último scrape para volver a intentarlo.

    Returns:
        dict si se hizo scrape (datos persistidos), None si se omitió o falló.
    """
    from app.models.electricity_tariff import ElectricityTariff

    result = await db.execute(select(func.max(ElectricityTariff.scraped_at)))
    last_scraped = result.scalar()

    if last_scraped is not None:
        # `scraped_at` se guarda timezone-naive en UTC (asyncpg + TIMESTAMP WITHOUT TZ)
        now_utc_naive = datetime.now(timezone.utc).replace(tzinfo=None)
        age = now_utc_naive - last_scraped
        if age < timedelta(days=max_age_days):
            logger.debug(
                "Tarifa EPM omite scrape: último registro hace %s (< %d días)",
                age, max_age_days,
            )
            return None

    data = await get_epm_estrato4_tariff()
    if not data:
        logger.warning("Tarifa EPM: scraping falló durante refresh periódico")
        return None

    inserted = await persist_tariffs(db, data)
    logger.info(
        "Tarifa EPM refresh completado: %d registros nuevos para %s",
        inserted, data.get("month_label", "?"),
    )
    return data
