"""
Tests unitarios para el servicio makerworld_fetcher.

Verifica la extracción de IDs de URL y el parseo de datos de MakerWorld,
usando mocks para no hacer requests reales durante los tests.
"""

import json
from unittest.mock import patch, MagicMock
import urllib.error

import pytest

from app.services.makerworld_fetcher import (
    extract_model_id,
    fetch_model_data,
    _parse_next_data,
    MakerworldData,
)


# --- Tests de extract_model_id ---

@pytest.mark.parametrize("url,expected_id", [
    ("https://makerworld.com/en/models/12345", "12345"),
    ("https://makerworld.com/en/models/12345-nombre-del-modelo", "12345"),
    ("https://www.makerworld.com/en/models/99999-test", "99999"),
    ("https://makerworld.com/models/55555", "55555"),
    ("https://makerworld.com/es/models/33333-algo", "33333"),
])
def test_extract_model_id_urls_validas(url, expected_id):
    """Extrae el ID correcto de URLs válidas de MakerWorld."""
    assert extract_model_id(url) == expected_id


@pytest.mark.parametrize("url", [
    "https://google.com",
    "https://makerworld.com/en/collections/featured",
    "https://makerworld.com",
    "no-es-una-url",
    "",
])
def test_extract_model_id_urls_invalidas(url):
    """Retorna None para URLs no válidas de modelos."""
    assert extract_model_id(url) is None


# --- HTML de muestra con __NEXT_DATA__ ---

def _crear_html_con_next_data(data: dict) -> str:
    """Crea HTML de prueba con el JSON __NEXT_DATA__ embebido."""
    json_str = json.dumps(data)
    return f"""
    <html>
    <head><title>Modelo</title></head>
    <body>
    <script id="__NEXT_DATA__" type="application/json">{json_str}</script>
    </body>
    </html>
    """


# --- Tests de _parse_next_data ---

def test_parse_next_data_con_datos_completos():
    """Extrae datos correctamente de un __NEXT_DATA__ bien formado."""
    data = {
        "props": {
            "pageProps": {
                "design": {
                    "title": "Soporte de Filamento",
                    "printProfiles": [
                        {
                            "printTime": 8138,
                            "filamentWeight": 45.32,
                            "filamentType": "PLA",
                        }
                    ]
                }
            }
        }
    }
    html = _crear_html_con_next_data(data)
    resultado = _parse_next_data(html, "12345")
    assert resultado is not None
    assert resultado.model_id == "12345"
    assert resultado.model_name == "Soporte de Filamento"
    assert resultado.print_time_seconds == 8138
    assert resultado.filament_weight_g == pytest.approx(45.32)
    assert resultado.filament_type == "PLA"


def test_parse_next_data_sin_perfil_impresion():
    """Retorna None si no hay perfiles de impresión con datos."""
    data = {
        "props": {
            "pageProps": {
                "design": {
                    "title": "Modelo sin perfil",
                    "printProfiles": []
                }
            }
        }
    }
    html = _crear_html_con_next_data(data)
    resultado = _parse_next_data(html, "99999")
    assert resultado is None


def test_parse_next_data_sin_next_data_script():
    """Retorna None si el HTML no tiene __NEXT_DATA__."""
    html = "<html><body><p>Sin datos</p></body></html>"
    resultado = _parse_next_data(html, "12345")
    assert resultado is None


def test_parse_next_data_json_invalido():
    """Retorna None si el JSON de __NEXT_DATA__ está malformado."""
    html = '<script id="__NEXT_DATA__" type="application/json">{invalid json}</script>'
    resultado = _parse_next_data(html, "12345")
    assert resultado is None


def test_parse_next_data_tiempo_como_string():
    """Parsea tiempo en formato string '2h 15m 38s'."""
    data = {
        "props": {
            "pageProps": {
                "design": {
                    "title": "Modelo",
                    "printProfiles": [
                        {
                            "printTime": "2h 15m 38s",
                            "filamentWeight": 20.0,
                        }
                    ]
                }
            }
        }
    }
    html = _crear_html_con_next_data(data)
    resultado = _parse_next_data(html, "12345")
    assert resultado is not None
    assert resultado.print_time_seconds == (2 * 3600 + 15 * 60 + 38)


# --- Tests de fetch_model_data ---

def test_fetch_model_data_exitoso():
    """Fetch exitoso retorna MakerworldData."""
    data = {
        "props": {
            "pageProps": {
                "design": {
                    "title": "Cubo de prueba",
                    "printProfiles": [
                        {"printTime": 3600, "filamentWeight": 10.5, "filamentType": "PLA"}
                    ]
                }
            }
        }
    }
    html = _crear_html_con_next_data(data).encode("utf-8")

    mock_resp = MagicMock()
    mock_resp.read.return_value = html
    mock_resp.headers.get.return_value = "text/html; charset=utf-8"
    mock_resp.__enter__ = lambda s: s
    mock_resp.__exit__ = MagicMock(return_value=False)

    with patch("urllib.request.urlopen", return_value=mock_resp):
        resultado = fetch_model_data("12345")

    assert resultado is not None
    assert resultado.model_id == "12345"
    assert resultado.print_time_seconds == 3600
    assert resultado.filament_weight_g == pytest.approx(10.5)


def test_fetch_model_data_http_403():
    """HTTP 403 retorna None sin lanzar excepción."""
    with patch(
        "urllib.request.urlopen",
        side_effect=urllib.error.HTTPError(None, 403, "Forbidden", {}, None),
    ):
        resultado = fetch_model_data("12345")

    assert resultado is None


def test_fetch_model_data_timeout():
    """Error de red retorna None sin lanzar excepción."""
    with patch(
        "urllib.request.urlopen",
        side_effect=urllib.error.URLError("timed out"),
    ):
        resultado = fetch_model_data("12345")

    assert resultado is None


def test_fetch_model_data_html_sin_datos():
    """HTML sin __NEXT_DATA__ retorna None."""
    html = b"<html><body>Pagina vacia</body></html>"

    mock_resp = MagicMock()
    mock_resp.read.return_value = html
    mock_resp.headers.get.return_value = "text/html"
    mock_resp.__enter__ = lambda s: s
    mock_resp.__exit__ = MagicMock(return_value=False)

    with patch("urllib.request.urlopen", return_value=mock_resp):
        resultado = fetch_model_data("12345")

    assert resultado is None
