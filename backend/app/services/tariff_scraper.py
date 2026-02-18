"""
Servicio de scraping de tarifas de electricidad EPM para Calculator3D.

Descarga automáticamente el PDF de tarifas mensuales publicado por
Empresas Públicas de Medellín (EPM) en su sitio web oficial, extrae
la tarifa para Estrato 4 (todo el consumo), la duplica (×2) para
estimación conservadora del próximo mes, y la convierte de COP/kWh
a USD/kWh usando la tasa de cambio actual.

El resultado se cachea durante 24 horas para evitar descargas repetidas.
Si el scraping falla (PDF no disponible, cambio de estructura, sin red),
se devuelve el último valor cacheado o None.
"""

import re
import io
import time
import logging
from typing import Optional, Dict

import httpx

logger = logging.getLogger(__name__)

EPM_TARIFFS_URL = "https://www.epm.com.co/clientesyusuarios/energia/tarifas-energia/"
EPM_BASE_URL = "https://www.epm.com.co"

# Multiplicador aplicado a la tarifa de mercado (factor de estimación conservadora)
TARIFF_MULTIPLIER = 2.0

# Caché: diccionario con resultado y timestamp
_cache: Optional[Dict] = None
_CACHE_TTL = 86400  # 24 horas


async def get_epm_estrato4_tariff() -> Optional[Dict]:
    """
    Obtiene las tarifas de electricidad EPM para todos los estratos con factor ×2.

    Flujo de ejecución:
    1. Devuelve el caché si tiene menos de 24 horas.
    2. Scraping de la página EPM para encontrar el PDF del mes más reciente.
    3. Descarga y parsea el PDF con pdfplumber.
    4. Extrae las tarifas de los 6 estratos residenciales en COP/kWh.
    5. Aplica el multiplicador ×2 a cada una.
    6. Convierte a USD/kWh usando la tasa de cambio actual.

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

    # Devolver caché si está vigente
    if _cache is not None and time.time() - _cache["ts"] < _CACHE_TTL:
        return _cache["data"]

    try:
        pdf_url, month_label = await _find_latest_pdf_url()
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


async def _find_latest_pdf_url() -> tuple:
    """
    Scraping de la página EPM para encontrar la URL del PDF más reciente.

    Returns:
        tuple: (url_absoluta, etiqueta_mes) o (None, None) si no se encontró.
    """
    async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
        response = await client.get(EPM_TARIFFS_URL)
        response.raise_for_status()
        html = response.text

    # Busca rutas de PDF dentro de la carpeta de tarifas del año actual
    pattern = r'(/content/dam/epm/[^"\']*[Tt]arifa[^"\']*\.pdf)'
    matches = re.findall(pattern, html)

    if not matches:
        return None, None

    # El último enlace suele ser el más reciente (publicación más nueva)
    latest_path = matches[-1]
    full_url = EPM_BASE_URL + latest_path

    # Intentar extraer el mes del nombre del archivo
    month_match = re.search(
        r'(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)',
        latest_path, re.IGNORECASE
    )
    month_label = month_match.group(1).capitalize() if month_match else "Mes actual"

    return full_url, month_label


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
