"""
Tests unitarios del tariff_scraper.

Cubre la parte del scraping que tiene lógica pura (regex de URL del PDF,
selección de mes más reciente, _MONTH_NAMES). Los pedazos que requieren
HTTP o PDF parsing se mockean.

Bugs históricos cubiertos (per CLAUDE.md):
- "20\d{2}" capturaba `2020` por colisión con `%20` URL-encoded. Año real
  siempre está al final del nombre del archivo → tomar `findall(...)[-1]`.
- max((year, month_num)) en lugar de matches[-1] — más robusto a cambios
  de orden en el HTML del dropdown EPM.
"""

from unittest.mock import patch, AsyncMock

import pytest

from app.services import tariff_scraper
from app.services.tariff_scraper import _MONTH_NAMES, _find_latest_pdf_url


@pytest.mark.unit
class TestMonthNames:
    def test_doce_meses_completos(self):
        assert len(_MONTH_NAMES) == 12

    def test_enero_es_1(self):
        assert _MONTH_NAMES["enero"] == 1

    def test_diciembre_es_12(self):
        assert _MONTH_NAMES["diciembre"] == 12

    def test_todos_lowercase(self):
        for k in _MONTH_NAMES:
            assert k == k.lower()


def _mock_response(html: str):
    """Construye un mock de httpx.Response con .text y .raise_for_status()."""
    resp = AsyncMock()
    resp.text = html
    resp.raise_for_status = AsyncMock(return_value=None)
    return resp


def _patch_httpx(html: str):
    """Patch httpx.AsyncClient.get para devolver el HTML dado."""
    client = AsyncMock()
    client.__aenter__.return_value = client
    client.__aexit__.return_value = None
    resp = _mock_response(html)
    # raise_for_status() en httpx es síncrono, ajustar:
    resp.raise_for_status = lambda: None
    client.get = AsyncMock(return_value=resp)
    return patch("httpx.AsyncClient", return_value=client)


@pytest.mark.unit
@pytest.mark.asyncio
class TestFindLatestPdfUrl:
    async def test_sin_matches_retorna_tupla_nones(self):
        html = "<html><body>Página sin PDFs</body></html>"
        with _patch_httpx(html):
            result = await _find_latest_pdf_url()
        assert result == (None, None, None, None)

    async def test_extrae_path_y_construye_url_absoluta(self):
        html = (
            'Tarifa: <a href="/content/dam/epm/Tarifas2026/Marzo032026_ANT_OM.pdf">PDF</a>'
        )
        with _patch_httpx(html):
            url, label, year, month = await _find_latest_pdf_url()
        assert url == (
            "https://www.epm.com.co/content/dam/epm/Tarifas2026/Marzo032026_ANT_OM.pdf"
        )
        assert label == "Marzo 2026"
        assert year == 2026
        assert month == 3

    async def test_elige_el_mes_mas_reciente_ignorando_orden_html(self):
        """Si HTML lista marzo antes que abril, debe elegir abril (más reciente)."""
        html = """
        <a href="/content/dam/epm/Tarifas2026/Marzo032026.pdf">marzo</a>
        <a href="/content/dam/epm/Tarifas2026/Abril162026.pdf">abril</a>
        """
        with _patch_httpx(html):
            url, label, year, month = await _find_latest_pdf_url()
        assert "Abril162026" in url
        assert month == 4

    async def test_ano_se_toma_del_final_no_de_url_encoded(self):
        """Bug fix CLAUDE.md: `%20` ⊃ `2020`. Tomar el último `20\\d{2}`."""
        html = '<a href="/content/dam/epm/Tarifas%202026/Abril162026_ANT_OM.pdf">x</a>'
        with _patch_httpx(html):
            _, label, year, _ = await _find_latest_pdf_url()
        assert year == 2026
        assert "2026" in label

    async def test_descarta_paths_sin_mes_o_ano(self):
        html = '<a href="/content/dam/epm/Tarifas_general.pdf">no mes</a>'
        with _patch_httpx(html):
            result = await _find_latest_pdf_url()
        assert result == (None, None, None, None)

    async def test_deduplicacion_paths_idénticos(self):
        """Si el mismo PDF aparece varias veces en el HTML, no duplica candidatos."""
        html = (
            '<a href="/content/dam/epm/Tarifas2026/Marzo032026.pdf">1</a>'
            '<a href="/content/dam/epm/Tarifas2026/Marzo032026.pdf">2</a>'
        )
        with _patch_httpx(html):
            url, _, _, _ = await _find_latest_pdf_url()
        assert "Marzo032026" in url

    async def test_excluye_blobs_con_caracteres_invalidos(self):
        """Bug fix CLAUDE.md: regex restrictivo (excluye `\\&<>`) para no capturar
        blobs HTML escaped del dropdown."""
        html = (
            '<a href="/content/dam/epm/Tarifas2026/Marzo032026.pdf">válido</a>'
            '<script>var x="/content/dam/epm/Tarifas2026\\\\&Abril2026.pdf"</script>'
        )
        with _patch_httpx(html):
            url, _, _, _ = await _find_latest_pdf_url()
        assert "Marzo032026" in url
        # No debe haber capturado la URL escaped del script
        assert "\\" not in url

    async def test_meses_en_minuscula_y_capitalizado(self):
        """El regex es case-insensitive — captura `marzo` y `Marzo` por igual."""
        html_lower = '<a href="/content/dam/epm/Tarifas2026/marzo032026.pdf">x</a>'
        with _patch_httpx(html_lower):
            url1, _, _, _ = await _find_latest_pdf_url()

        html_upper = '<a href="/content/dam/epm/Tarifas2026/MARZO032026.pdf">x</a>'
        with _patch_httpx(html_upper):
            url2, _, _, _ = await _find_latest_pdf_url()

        assert "marzo032026" in url1
        assert "MARZO032026" in url2

    async def test_diciembre_de_anio_anterior_pierde_vs_enero_actual(self):
        """Que un PDF de diciembre 2025 no opaque enero 2026."""
        html = (
            '<a href="/content/dam/epm/Tarifas2025/Diciembre152025.pdf">dic</a>'
            '<a href="/content/dam/epm/Tarifas2026/Enero152026.pdf">ene</a>'
        )
        with _patch_httpx(html):
            url, _, year, month = await _find_latest_pdf_url()
        assert year == 2026
        assert month == 1
        assert "Enero152026" in url
