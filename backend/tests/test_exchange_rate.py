"""
Tests unitarios para el servicio de tasa de cambio USD/COP.

Verifica el comportamiento de get_usd_to_cop():
    - Retorna el valor cacheado si está vigente (sin llamada HTTP).
    - Consulta la API cuando el caché está expirado o vacío.
    - Suma COP_MARKUP (200) a la tasa de mercado.
    - Retorna el caché anterior si la API falla (aunque esté expirado).
    - Retorna FALLBACK + MARKUP si la API falla y no hay caché.
"""

import time
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

import app.services.exchange_rate as er_module
from app.services.exchange_rate import get_usd_to_cop, COP_MARKUP, _FALLBACK_RATE


# ── Utilidades ────────────────────────────────────────────────────────────────

def _reset_cache():
    """Limpia el caché global antes de cada test."""
    er_module._cache = None


def _set_cache(rate: float, age_seconds: float = 0.0):
    """
    Inyecta un valor en el caché global.

    Args:
        rate:        Tasa con markup ya incluida.
        age_seconds: Cuántos segundos atrás se almacenó.
    """
    er_module._cache = (rate, time.time() - age_seconds)


def _mock_httpx_response(market_rate: float):
    """
    Crea un mock de httpx.AsyncClient que retorna market_rate como tasa COP.

    Args:
        market_rate: Tasa de mercado sin markup (simula data["rates"]["COP"]).
    """
    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    mock_response.json.return_value = {"rates": {"COP": market_rate}}

    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__  = AsyncMock(return_value=False)
    mock_client.get        = AsyncMock(return_value=mock_response)
    return mock_client


# ── Tests de caché ────────────────────────────────────────────────────────────

class TestCacheVigente:
    """El caché vigente se retorna sin contactar la API."""

    @pytest.mark.asyncio
    async def test_retorna_cache_si_vigente(self):
        """get_usd_to_cop devuelve el valor cacheado sin hacer HTTP."""
        _set_cache(4300.0, age_seconds=10)

        with patch("app.services.exchange_rate.httpx.AsyncClient") as mock_cls:
            result = await get_usd_to_cop()

        mock_cls.assert_not_called()
        assert result == 4300.0

    @pytest.mark.asyncio
    async def test_cache_reciente_ignora_api(self):
        """Un caché de 5 minutos de antigüedad no genera llamada HTTP."""
        _set_cache(5000.0, age_seconds=300)

        with patch("app.services.exchange_rate.httpx.AsyncClient") as mock_cls:
            result = await get_usd_to_cop()

        mock_cls.assert_not_called()
        assert result == 5000.0


# ── Tests de llamada exitosa a la API ────────────────────────────────────────

class TestLlamadaExitosa:
    """Cuando el caché está vacío o expirado, se consulta la API."""

    @pytest.mark.asyncio
    async def test_sin_cache_consulta_api(self):
        """Sin caché previo, debe consultar la API."""
        _reset_cache()
        mock_client = _mock_httpx_response(4100.0)

        with patch("app.services.exchange_rate.httpx.AsyncClient", return_value=mock_client):
            result = await get_usd_to_cop()

        assert result == pytest.approx(4100.0 + COP_MARKUP)

    @pytest.mark.asyncio
    async def test_suma_markup_a_tasa_de_mercado(self):
        """La tasa devuelta debe ser market_rate + COP_MARKUP."""
        _reset_cache()
        market_rate = 4250.0
        mock_client = _mock_httpx_response(market_rate)

        with patch("app.services.exchange_rate.httpx.AsyncClient", return_value=mock_client):
            result = await get_usd_to_cop()

        assert result == pytest.approx(market_rate + COP_MARKUP)

    @pytest.mark.asyncio
    async def test_cache_expirado_consulta_api(self):
        """Un caché de más de 1 hora debe renovarse con llamada a la API."""
        _set_cache(4000.0, age_seconds=3700)  # > _CACHE_TTL (3600s)
        mock_client = _mock_httpx_response(4350.0)

        with patch("app.services.exchange_rate.httpx.AsyncClient", return_value=mock_client):
            result = await get_usd_to_cop()

        assert result == pytest.approx(4350.0 + COP_MARKUP)

    @pytest.mark.asyncio
    async def test_actualiza_cache_tras_llamada_exitosa(self):
        """Después de una llamada exitosa, el caché debe contener el nuevo valor."""
        _reset_cache()
        mock_client = _mock_httpx_response(4200.0)

        with patch("app.services.exchange_rate.httpx.AsyncClient", return_value=mock_client):
            await get_usd_to_cop()

        assert er_module._cache is not None
        cached_rate, cached_ts = er_module._cache
        assert cached_rate == pytest.approx(4200.0 + COP_MARKUP)
        assert time.time() - cached_ts < 5  # el timestamp es reciente


# ── Tests de fallback ante errores ───────────────────────────────────────────

class TestFallbackErrores:
    """Cuando la API falla, se retorna el caché anterior o el valor de respaldo."""

    @pytest.mark.asyncio
    async def test_fallo_sin_cache_retorna_fallback(self):
        """Si la API falla y no hay caché, retorna _FALLBACK_RATE + COP_MARKUP."""
        _reset_cache()

        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__  = AsyncMock(return_value=False)
        mock_client.get        = AsyncMock(side_effect=Exception("sin conexión"))

        with patch("app.services.exchange_rate.httpx.AsyncClient", return_value=mock_client):
            result = await get_usd_to_cop()

        assert result == pytest.approx(_FALLBACK_RATE + COP_MARKUP)

    @pytest.mark.asyncio
    async def test_fallo_con_cache_vencido_retorna_cache(self):
        """Si la API falla pero hay caché (aunque expirado), lo retorna."""
        viejo_valor = 4150.0
        _set_cache(viejo_valor, age_seconds=9000)  # expirado hace 2.5h

        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__  = AsyncMock(return_value=False)
        mock_client.get        = AsyncMock(side_effect=Exception("timeout"))

        with patch("app.services.exchange_rate.httpx.AsyncClient", return_value=mock_client):
            result = await get_usd_to_cop()

        assert result == viejo_valor

    @pytest.mark.asyncio
    async def test_fallo_http_4xx_retorna_fallback(self):
        """Un error HTTP (raise_for_status) sin caché retorna el fallback."""
        _reset_cache()

        mock_response = MagicMock()
        mock_response.raise_for_status.side_effect = Exception("404 Not Found")

        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__  = AsyncMock(return_value=False)
        mock_client.get        = AsyncMock(return_value=mock_response)

        with patch("app.services.exchange_rate.httpx.AsyncClient", return_value=mock_client):
            result = await get_usd_to_cop()

        assert result == pytest.approx(_FALLBACK_RATE + COP_MARKUP)


# ── Tests de constantes ───────────────────────────────────────────────────────

class TestConstantes:
    """Verifica los valores de las constantes del módulo."""

    def test_cop_markup_es_200(self):
        """COP_MARKUP debe ser 200.0."""
        assert COP_MARKUP == 200.0

    def test_fallback_rate_es_4200(self):
        """_FALLBACK_RATE debe ser 4200.0."""
        assert _FALLBACK_RATE == 4200.0

    def test_fallback_total_es_4400(self):
        """El fallback total (sin markup) es 4200 + 200 = 4400.0."""
        assert _FALLBACK_RATE + COP_MARKUP == 4400.0
