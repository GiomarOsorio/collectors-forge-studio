"""
Tests unitarios para el servicio de scraping de tarifas EPM.

Verifica el comportamiento de get_epm_estrato4_tariff() y sus helpers:
    - Retorna el caché cuando está vigente.
    - Llama a la API cuando el caché está expirado.
    - _find_latest_pdf_url extrae URL, mes y año del HTML.
    - _find_latest_pdf_url retorna None si no hay PDFs.
    - Manejo de errores: retorna None si no hay caché y falla.
    - Manejo de errores: retorna caché viejo si hay error.
"""

import time
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

import app.services.tariff_scraper as ts_module
from app.services.tariff_scraper import (
    get_epm_estrato4_tariff,
    _find_latest_pdf_url,
    TARIFF_MULTIPLIER,
)


# ── Utilidades ────────────────────────────────────────────────────────────────

def _reset_cache():
    """Limpia el caché global antes de cada test."""
    ts_module._cache = None


def _set_cache(data: dict, age_seconds: float = 0.0):
    """
    Inyecta un valor en el caché global.

    Args:
        data:        Datos de tarifa a cachear.
        age_seconds: Cuántos segundos atrás se almacenó.
    """
    ts_module._cache = {"data": data, "ts": time.time() - age_seconds}


def _fake_tariff_data():
    """Crea datos de tarifa de ejemplo para el caché."""
    return {
        "cop_market_rate": 801.24,
        "cop_rate_used": 1602.48,
        "multiplier": 2.0,
        "usd_rate": 0.00036,
        "usd_to_cop": 4400.0,
        "month_label": "Febrero 2026",
        "year": 2026,
        "month": 2,
        "pdf_url": "https://www.epm.com.co/content/dam/epm/tarifas-febrero-2026.pdf",
        "estratos": {
            "1": {"cop_market_rate": 400.0, "cop_rate_used": 800.0, "usd_rate": 0.00018},
            "4": {"cop_market_rate": 801.24, "cop_rate_used": 1602.48, "usd_rate": 0.00036},
        },
    }


# ── Tests de caché ────────────────────────────────────────────────────────────

class TestCacheVigente:
    """El caché vigente se retorna sin contactar la API."""

    @pytest.mark.asyncio
    async def test_retorna_cache_si_vigente(self):
        """get_epm_estrato4_tariff devuelve el caché sin HTTP si tiene < 24h."""
        data = _fake_tariff_data()
        _set_cache(data, age_seconds=3600)  # 1 hora de antigüedad

        with patch("app.services.tariff_scraper._find_latest_pdf_url") as mock_find:
            result = await get_epm_estrato4_tariff()

        mock_find.assert_not_called()
        assert result["month_label"] == "Febrero 2026"

    @pytest.mark.asyncio
    async def test_cache_exacto_retornado(self):
        """Los campos del caché se retornan intactos."""
        data = _fake_tariff_data()
        _set_cache(data, age_seconds=100)

        result = await get_epm_estrato4_tariff()

        assert result["cop_market_rate"] == 801.24
        assert result["multiplier"] == TARIFF_MULTIPLIER
        assert "estratos" in result


# ── Tests de _find_latest_pdf_url ─────────────────────────────────────────────

class TestFindLatestPdfUrl:
    """Tests para el helper que extrae la URL del PDF de la página EPM."""

    @pytest.mark.asyncio
    async def test_extrae_url_desde_html(self):
        """Extrae correctamente la URL del PDF cuando el HTML la contiene."""
        html_mock = """
        <html><body>
        <a href="/content/dam/epm/clientesyusuarios/energia/Tarifas-enero-2026.pdf">
          Tarifas enero 2026
        </a>
        </body></html>
        """
        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()
        mock_response.text = html_mock

        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__  = AsyncMock(return_value=False)
        mock_client.get        = AsyncMock(return_value=mock_response)

        with patch("app.services.tariff_scraper.httpx.AsyncClient", return_value=mock_client):
            url, label, year, month_num = await _find_latest_pdf_url()

        assert url is not None
        assert "epm.com.co" in url
        assert ".pdf" in url.lower()

    @pytest.mark.asyncio
    async def test_extrae_mes_del_nombre_pdf(self):
        """El mes extraído del nombre del PDF coincide con el mes esperado."""
        html_mock = """
        <html>
        <a href="/content/dam/epm/tarifas/Tarifas-marzo-2026.pdf">marzo</a>
        </html>
        """
        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()
        mock_response.text = html_mock

        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__  = AsyncMock(return_value=False)
        mock_client.get        = AsyncMock(return_value=mock_response)

        with patch("app.services.tariff_scraper.httpx.AsyncClient", return_value=mock_client):
            url, label, year, month_num = await _find_latest_pdf_url()

        assert month_num == 3
        assert "Marzo" in label

    @pytest.mark.asyncio
    async def test_retorna_none_si_sin_pdfs(self):
        """Si no hay PDFs en el HTML, retorna (None, None, None, None)."""
        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()
        mock_response.text = "<html><body>Sin enlaces PDF</body></html>"

        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__  = AsyncMock(return_value=False)
        mock_client.get        = AsyncMock(return_value=mock_response)

        with patch("app.services.tariff_scraper.httpx.AsyncClient", return_value=mock_client):
            url, label, year, month_num = await _find_latest_pdf_url()

        assert url is None
        assert label is None
        assert year is None
        assert month_num is None


# ── Tests de manejo de errores en get_epm_estrato4_tariff ───────────────────

class TestManejoErrores:
    """Comportamiento ante fallos de red o parseo."""

    @pytest.mark.asyncio
    async def test_fallo_sin_cache_retorna_none(self):
        """Si la API falla y no hay caché, retorna None."""
        _reset_cache()

        with patch(
            "app.services.tariff_scraper._find_latest_pdf_url",
            side_effect=Exception("sin conexión"),
        ):
            result = await get_epm_estrato4_tariff()

        assert result is None

    @pytest.mark.asyncio
    async def test_fallo_con_cache_vencido_retorna_cache(self):
        """Si la API falla pero hay caché expirado, lo retorna."""
        data = _fake_tariff_data()
        _set_cache(data, age_seconds=100000)  # expirado hace >24h

        with patch(
            "app.services.tariff_scraper._find_latest_pdf_url",
            side_effect=Exception("timeout"),
        ):
            result = await get_epm_estrato4_tariff()

        assert result is not None
        assert result["month_label"] == "Febrero 2026"

    @pytest.mark.asyncio
    async def test_pdf_no_encontrado_retorna_none_sin_cache(self):
        """Si _find_latest_pdf_url devuelve None y no hay caché, retorna None."""
        _reset_cache()

        with patch(
            "app.services.tariff_scraper._find_latest_pdf_url",
            return_value=(None, None, None, None),
        ):
            result = await get_epm_estrato4_tariff()

        assert result is None


# ── Tests del flujo completo (mocked) ─────────────────────────────────────────

class TestFlujoCompleto:
    """Tests de integración del flujo completo con todas las dependencias mockeadas."""

    @pytest.mark.asyncio
    async def test_flujo_exitoso_construye_datos_correctos(self):
        """
        Simula un scraping exitoso: PDF encontrado, estratos extraídos, tasa obtenida.
        Verifica que el resultado contiene todos los campos esperados.
        """
        _reset_cache()

        pdf_url    = "https://www.epm.com.co/content/dam/epm/tarifas-febrero-2026.pdf"
        estratos   = {"4": 800.0, "1": 400.0, "6": 950.0}
        usd_to_cop = 4400.0

        with patch(
            "app.services.tariff_scraper._find_latest_pdf_url",
            return_value=(pdf_url, "Febrero 2026", 2026, 2),
        ), patch(
            "app.services.tariff_scraper._extract_all_estratos",
            return_value=estratos,
        ), patch(
            "app.services.exchange_rate.get_usd_to_cop",
            return_value=usd_to_cop,
        ):
            result = await get_epm_estrato4_tariff()

        assert result is not None
        assert result["cop_market_rate"] == 800.0
        assert result["cop_rate_used"]   == pytest.approx(800.0 * TARIFF_MULTIPLIER)
        assert result["multiplier"]      == TARIFF_MULTIPLIER
        assert result["month_label"]     == "Febrero 2026"
        assert result["pdf_url"]         == pdf_url
        assert "estratos" in result
        assert "4" in result["estratos"]

    @pytest.mark.asyncio
    async def test_flujo_exitoso_actualiza_cache(self):
        """Tras un scraping exitoso el caché debe contener el nuevo resultado."""
        _reset_cache()

        with patch(
            "app.services.tariff_scraper._find_latest_pdf_url",
            return_value=("https://epm.com.co/tarifas.pdf", "Enero 2026", 2026, 1),
        ), patch(
            "app.services.tariff_scraper._extract_all_estratos",
            return_value={"4": 790.0},
        ), patch(
            "app.services.exchange_rate.get_usd_to_cop",
            return_value=4400.0,
        ):
            await get_epm_estrato4_tariff()

        assert ts_module._cache is not None
        assert time.time() - ts_module._cache["ts"] < 5

    @pytest.mark.asyncio
    async def test_usd_rate_calculado_correctamente(self):
        """usd_rate = cop_rate_used / usd_to_cop."""
        _reset_cache()

        cop_market = 800.0
        usd_to_cop = 4000.0
        cop_used   = cop_market * TARIFF_MULTIPLIER  # 1600.0
        esperado   = round(cop_used / usd_to_cop, 6)  # 0.0004

        with patch(
            "app.services.tariff_scraper._find_latest_pdf_url",
            return_value=("https://epm.com.co/t.pdf", "Enero 2026", 2026, 1),
        ), patch(
            "app.services.tariff_scraper._extract_all_estratos",
            return_value={"4": cop_market},
        ), patch(
            "app.services.exchange_rate.get_usd_to_cop",
            return_value=usd_to_cop,
        ):
            result = await get_epm_estrato4_tariff()

        assert result["usd_rate"] == pytest.approx(esperado)
