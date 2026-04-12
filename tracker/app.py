"""
Microservicio de tracking de pedidos con Playwright.

Lee todos los pedidos activos de la base de datos, abre parcelsapp.com
en modo headless para cada número de tracking, extrae el estado y los
eventos, y actualiza la tabla purchase_orders directamente.

Se ejecuta automáticamente cada SCAN_INTERVAL_MINUTES minutos (configurable
en .env). También expone un endpoint POST /scan para lanzar el escaneo
manualmente desde el frontend.

Endpoints:
    GET  /health  -- Verifica que el servicio está activo
    POST /scan    -- Escanea todos los pedidos activos y actualiza tracking
"""

import asyncio
import json
import logging
import os
import random
import re
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Optional

import asyncpg
from fastapi import FastAPI

logging.basicConfig(level=logging.INFO, format="%(asctime)s [tracker] %(message)s")
log = logging.getLogger(__name__)

async def _auto_scan_loop():
    """Bucle que ejecuta el escaneo cada SCAN_INTERVAL_MINUTES minutos."""
    if SCAN_INTERVAL_MINUTES <= 0:
        log.info("Escaneo automático desactivado (SCAN_INTERVAL_MINUTES=0)")
        return
    log.info("Escaneo automático cada %d minutos", SCAN_INTERVAL_MINUTES)
    while True:
        await asyncio.sleep(SCAN_INTERVAL_MINUTES * 60)
        log.info("Iniciando escaneo automático programado…")
        try:
            result = await _run_scan()
            log.info(
                "Escaneo automático completado: %d escaneados, %d actualizados, %d errores",
                result["scanned"], result["updated"], result["errors"],
            )
        except Exception as exc:
            log.error("Error en escaneo automático: %s", exc)


@asynccontextmanager
async def lifespan(fastapi_app: FastAPI):
    """Arranca el bucle de escaneo automático al iniciar el servicio."""
    task = asyncio.create_task(_auto_scan_loop())
    yield
    task.cancel()


app = FastAPI(title="Collector's Forge Tracker Service", version="1.0.0", lifespan=lifespan)

# URL de la base de datos (misma que usa el backend)
DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://postgres:postgres@db:5432/collectorsforge",
)

# Intervalo de escaneo automático en minutos (0 = desactivado)
SCAN_INTERVAL_MINUTES = int(os.environ.get("SCAN_INTERVAL_MINUTES", "300"))

# Mapeo de palabras clave de parcelsapp.com a estados internos
# Orden importa: se evalúa de más específico a más general
_STATUS_MAP = [
    # Entregado
    (r"delivered|entregado|delivery successful|package delivered", "entregado"),
    # Intento fallido / en oficina
    (r"out for delivery|en reparto|delivery attempt", "en_transito"),
    # En tránsito
    (r"in transit|en tránsito|transit|in customs|customs|sorting|hub|facility", "en_transito"),
    # Despachado / etiqueta creada / enviado
    (r"shipped|dispatched|label created|picked up|collected|departure|origin", "despachado"),
]


async def _human_pause(min_ms: int, max_ms: int) -> None:
    """
    Pausa aleatoria dentro del rango dado, simulando tiempos de reacción humanos.

    Rangos de referencia basados en investigación de UX / HCI:
      - Tiempo de movimiento de mouse (Fitts' Law, promedio 1660ms SD=480ms)
      - Pausa de lectura antes de scroll (Nielsen/NN Group: 1.5–5s)
      - Tiempo de reacción antes de un click: 200–500ms

    Args:
        min_ms: Mínimo en milisegundos.
        max_ms: Máximo en milisegundos.
    """
    delay_s = random.uniform(min_ms, max_ms) / 1000.0
    await asyncio.sleep(delay_s)


async def _simulate_human_browsing(page) -> None:
    """
    Simula el comportamiento humano típico al revisar una página de tracking.

    Secuencia:
      1. Pausa inicial leyendo el encabezado (2–5 s, tiempo de decisión según NNG).
      2. Movimiento del mouse a zona de contenido (600–2400 ms, Fitts' Law).
      3. Primer scroll para ver los eventos de tracking (pausa 1.5–4 s).
      4. 60% de probabilidad de un segundo scroll menor (pausa 0.8–2.5 s).
      5. Movimiento final del mouse simulando salida de la zona (400–1200 ms).

    Args:
        page: Instancia de página de Playwright.
    """
    # 1. Leer encabezado — tiempo de decisión: 2–5 s (Nielsen NN Group)
    await _human_pause(2000, 5000)

    # 2. Mover mouse hacia la zona de eventos de tracking
    #    Fitts' Law: movimiento deliberado a objetivo promedio 1660ms SD=480ms
    #    → simulamos 600–2400ms
    target_x = random.randint(300, 900)
    target_y = random.randint(280, 520)
    await page.mouse.move(target_x, target_y)
    await _human_pause(600, 2400)

    # 3. Scroll hacia los eventos (usuario busca la línea de tiempo)
    scroll_px = random.randint(280, 480)
    await page.evaluate(f"window.scrollBy(0, {scroll_px})")
    await _human_pause(1500, 4000)   # lectura activa: 1.5–4 s

    # 4. Segundo scroll opcional (60% de probabilidad)
    if random.random() < 0.60:
        await page.evaluate(f"window.scrollBy(0, {random.randint(80, 220)})")
        await _human_pause(800, 2500)

    # 5. Movimiento final del mouse (salida visual de la zona)
    await page.mouse.move(random.randint(100, 400), random.randint(100, 300))
    await _human_pause(400, 1200)


def _infer_status(text: str) -> Optional[str]:
    """
    Infiere el estado del paquete a partir del texto extraído de parcelsapp.

    Args:
        text: Texto plano extraído de la página de tracking.

    Returns:
        Estado inferido o None si no se puede determinar.
    """
    lower = text.lower()
    for pattern, status in _STATUS_MAP:
        if re.search(pattern, lower):
            return status
    return None


async def _scrape_tracking(tracking_number: str) -> dict:
    """
    Abre parcelsapp.com con Playwright y extrae datos de tracking.

    Estrategias en orden:
      1. Interceptar respuestas JSON de la API interna de parcelsapp.
      2. Leer __NEXT_DATA__ (SSR de Next.js).
      3. Extraer texto visible de la página como fallback.

    Args:
        tracking_number: Número de seguimiento del paquete.

    Returns:
        Diccionario con eventos, estado inferido y texto raw.
    """
    from playwright.async_api import async_playwright

    captured: dict = {}

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
            ],
        )
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            )
        )
        page = await context.new_page()

        async def on_response(response):
            try:
                ct = response.headers.get("content-type", "")
                if response.status == 200 and "json" in ct:
                    data = await response.json()
                    if isinstance(data, dict) and any(
                        k in data
                        for k in ("events", "checkpoints", "status", "parcels",
                                  "trackings", "tracking", "states")
                    ):
                        captured.update(data)
            except Exception:
                pass

        page.on("response", on_response)

        try:
            await page.goto(
                f"https://parcelsapp.com/en/tracking/{tracking_number}",
                wait_until="networkidle",
                timeout=30000,
            )
            # Simular comportamiento humano mientras la página carga el tracking
            await _simulate_human_browsing(page)
        except Exception:
            pass

        # Estrategia 1: datos de la API interna interceptados
        if captured:
            await browser.close()
            return captured

        # Estrategia 2: __NEXT_DATA__ (Next.js SSR)
        next_raw = await page.evaluate(
            "() => { const el = document.getElementById('__NEXT_DATA__');"
            " return el ? el.textContent : null; }"
        )
        if next_raw:
            try:
                props = json.loads(next_raw).get("props", {}).get("pageProps", {})
                if props:
                    await browser.close()
                    return props
            except Exception:
                pass

        # Estrategia 3: texto visible de la página
        body_text = await page.evaluate("() => document.body.innerText")
        await browser.close()
        return {"raw_text": body_text[:5000]}


@app.get("/health")
async def health():
    """Verifica que el servicio está activo."""
    return {"status": "ok"}


async def _run_scan() -> dict:
    """
    Lógica central de escaneo: lee pedidos activos, scrape y actualiza DB.

    Returns:
        Diccionario con totales: escaneados, actualizados y errores.
    """
    STATUS_ORDER = ["pendiente", "despachado", "en_transito", "entregado"]

    db_url = DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")
    conn = await asyncpg.connect(db_url)
    try:
        orders = await conn.fetch(
            """
            SELECT id, tracking_number, status
            FROM purchase_orders
            WHERE tracking_number IS NOT NULL
              AND tracking_number != ''
              AND status NOT IN ('llegado', 'cancelado')
            """
        )

        results = []
        for order in orders:
            order_id = order["id"]
            tracking_number = order["tracking_number"]
            current_status = order["status"]

            try:
                log.info("Scraping pedido #%d — %s", order_id, tracking_number)
                data = await _scrape_tracking(tracking_number)
                data_json = json.dumps(data, ensure_ascii=False)

                # Inferir estado desde el texto scrapeado
                text_for_inference = data.get("raw_text") or " ".join(
                    str(v) for v in data.values() if isinstance(v, (str, list))
                )
                inferred = _infer_status(text_for_inference)

                # Solo avanzar el estado (nunca retroceder, nunca auto-'llegado')
                new_status = current_status
                if (
                    inferred
                    and inferred in STATUS_ORDER
                    and current_status in STATUS_ORDER
                    and STATUS_ORDER.index(inferred) > STATUS_ORDER.index(current_status)
                ):
                    new_status = inferred

                await conn.execute(
                    """
                    UPDATE purchase_orders
                    SET tracking_data = $1,
                        tracking_checked_at = $2,
                        status = $3
                    WHERE id = $4
                    """,
                    data_json,
                    datetime.now(timezone.utc).replace(tzinfo=None),
                    new_status,
                    order_id,
                )

                results.append({
                    "id": order_id,
                    "tracking": tracking_number,
                    "old_status": current_status,
                    "new_status": new_status,
                    "ok": True,
                })

            except Exception as exc:
                log.error("Error scraping pedido #%d: %s", order_id, exc)
                results.append({
                    "id": order_id,
                    "tracking": tracking_number,
                    "ok": False,
                    "error": str(exc)[:200],
                })

        return {
            "scanned": len(results),
            "updated": sum(1 for r in results if r.get("ok") and r["old_status"] != r["new_status"]),
            "errors": sum(1 for r in results if not r.get("ok")),
            "results": results,
        }
    finally:
        await conn.close()


@app.post("/scan")
async def scan_all_orders():
    """
    Dispara manualmente un escaneo completo de tracking.

    Útil para actualizaciones bajo demanda desde el frontend sin
    esperar el ciclo automático.

    Returns:
        Diccionario con totales: escaneados, actualizados y errores.
    """
    return await _run_scan()
