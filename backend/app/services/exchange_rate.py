"""
Servicio de tasa de cambio USD → COP para collectors-forge-studio.

Obtiene el precio del dólar en pesos colombianos desde la API pública de
open.er-api.com (sin clave de API requerida). Al valor obtenido se le suman
200 COP adicionales para cubrir la variación del mercado local, siguiendo
la preferencia del negocio.

El resultado se almacena en memoria con una vigencia de 1 hora para evitar
consultas excesivas a la API externa. Si la consulta falla (sin internet,
API caída, etc.), se devuelve la última tasa conocida, o un valor de
respaldo de 4200 COP/USD si nunca se obtuvo ninguna.
"""

import time
import logging
from typing import Optional, Tuple

import httpx

logger = logging.getLogger(__name__)

# Markup fijo en pesos colombianos que se suma a la tasa de mercado
COP_MARKUP = 200.0

# Tasa de respaldo si la API no está disponible y no hay caché
_FALLBACK_RATE = 4200.0

# Caché en memoria: (tasa_con_markup, timestamp_unix)
# NOTA (M-01): este caché es module-global y vive en el proceso uvicorn.
# Con --workers 1 (configuración actual) funciona correctamente.
# Con múltiples workers, cada proceso tiene su propio caché independiente,
# lo que causaría N llamadas simultáneas a la API externa en vez de una.
# Si se escala a múltiples workers, migrar a Redis o tabla de BD.
_cache: Optional[Tuple[float, float]] = None

# Tiempo de vigencia del caché en segundos (1 hora)
_CACHE_TTL = 3600


def get_cache_timestamp() -> Optional[float]:
    """Devuelve el timestamp Unix de la última actualización del caché, o None si no hay caché."""
    return _cache[1] if _cache is not None else None


async def get_usd_to_cop() -> float:
    """
    Devuelve la tasa de cambio USD → COP con markup incluido.

    Consulta la API de open.er-api.com para obtener el tipo de cambio
    oficial y le suma COP_MARKUP (200 COP). El resultado se cachea durante
    1 hora. Si la API falla, se devuelve el valor cacheado previo o el
    valor de respaldo (_FALLBACK_RATE + COP_MARKUP).

    Returns:
        float: Tasa de cambio USD → COP con markup aplicado.
            Ejemplo: si el mercado cotiza 4100, devuelve 4300.0
    """
    global _cache

    # Devolver caché si está vigente
    if _cache is not None:
        rate, ts = _cache
        if time.time() - ts < _CACHE_TTL:
            return rate

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get("https://open.er-api.com/v6/latest/USD")
            response.raise_for_status()
            data = response.json()
            market_rate = float(data["rates"]["COP"])
            rate_with_markup = round(market_rate + COP_MARKUP, 2)
            _cache = (rate_with_markup, time.time())
            logger.info("Tasa USD/COP actualizada: %s + %s = %s", market_rate, COP_MARKUP, rate_with_markup)
            return rate_with_markup
    except httpx.TimeoutException:
        logger.warning("Timeout al consultar API de tasa USD/COP (5s)")
    except httpx.HTTPStatusError as e:
        logger.warning("API USD/COP devolvió error HTTP %s", e.response.status_code)
    except httpx.RequestError as e:
        logger.warning("Error de red al consultar API USD/COP: %s", type(e).__name__)
    except (KeyError, ValueError, TypeError) as e:
        logger.warning("Respuesta inesperada de la API USD/COP: %s", e)
    except Exception as e:
        logger.warning("Error inesperado al obtener tasa USD/COP: %s", e)
    # Devolver caché anterior aunque esté vencido, o valor de respaldo
    if _cache is not None:
        return _cache[0]
    return round(_FALLBACK_RATE + COP_MARKUP, 2)
