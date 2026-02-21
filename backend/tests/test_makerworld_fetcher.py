"""
Tests unitarios para el servicio makerworld_fetcher.

Verifica la extracción de IDs de URL, el parseo de perfiles de impresión
y la integración con la API/HTML de MakerWorld, usando mocks de httpx
para no hacer requests reales durante los tests.
"""

import json
from unittest.mock import MagicMock, patch

import pytest

from app.services.makerworld_fetcher import (
    MakerworldData,
    _parse_print_profiles,
    extract_model_id,
    fetch_model_data,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _mock_httpx_client(api_status=404, api_json=None, html_status=200, html_text=""):
    """
    Crea un mock de httpx.Client cuyo .get() retorna respuestas distintas
    según si la URL contiene '/api/' (llamada a la API) o no (HTML).
    """
    def fake_get(url, **kwargs):
        resp = MagicMock()
        if "/api/" in url:
            resp.status_code = api_status
            resp.json.return_value = api_json or {}
        else:
            resp.status_code = html_status
            resp.text = html_text
        return resp

    mock_client = MagicMock()
    mock_client.get.side_effect = fake_get
    mock_client.__enter__ = lambda s: s
    mock_client.__exit__ = MagicMock(return_value=False)
    return mock_client


def _html_con_next_data(data: dict) -> str:
    """Crea HTML de prueba con JSON __NEXT_DATA__ embebido."""
    json_str = json.dumps(data)
    return (
        "<html><head></head><body>"
        f'<script id="__NEXT_DATA__" type="application/json">{json_str}</script>'
        "</body></html>"
    )


# ---------------------------------------------------------------------------
# extract_model_id
# ---------------------------------------------------------------------------

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
    """Retorna None para URLs que no son de modelos."""
    assert extract_model_id(url) is None


# ---------------------------------------------------------------------------
# _parse_print_profiles
# ---------------------------------------------------------------------------

def test_parse_profiles_datos_completos():
    """Extrae tiempo, peso y filamento de un perfil completo."""
    profiles = [{"printTime": 8138, "filamentWeight": 45.32, "filamentType": "PLA"}]
    tiempo, gramos, tipo = _parse_print_profiles(profiles)
    assert tiempo == 8138
    assert gramos == pytest.approx(45.32)
    assert tipo == "PLA"


def test_parse_profiles_tiempo_string():
    """Parsea tiempo en formato string '2h 15m 38s'."""
    profiles = [{"printTime": "2h 15m 38s", "filamentWeight": 20.0}]
    tiempo, gramos, tipo = _parse_print_profiles(profiles)
    assert tiempo == (2 * 3600 + 15 * 60 + 38)
    assert gramos == pytest.approx(20.0)


def test_parse_profiles_lista_vacia():
    """Lista vacía retorna todo None."""
    tiempo, gramos, tipo = _parse_print_profiles([])
    assert tiempo is None
    assert gramos is None
    assert tipo is None


def test_parse_profiles_sin_weight():
    """Solo tiempo, sin gramos ni tipo."""
    profiles = [{"printTime": 3600}]
    tiempo, gramos, tipo = _parse_print_profiles(profiles)
    assert tiempo == 3600
    assert gramos is None
    assert tipo is None


def test_parse_profiles_usa_primer_perfil_util():
    """Usa el primer perfil con datos y para en cuanto tiene tiempo+gramos."""
    profiles = [
        {"printTime": 100, "filamentWeight": 5.0, "filamentType": "PLA"},
        {"printTime": 200, "filamentWeight": 10.0, "filamentType": "PETG"},
    ]
    tiempo, gramos, tipo = _parse_print_profiles(profiles)
    assert tiempo == 100
    assert gramos == pytest.approx(5.0)
    assert tipo == "PLA"


# ---------------------------------------------------------------------------
# fetch_model_data — vía API
# ---------------------------------------------------------------------------

def test_fetch_via_api_exitoso():
    """Si la API responde 200 con perfiles, retorna MakerworldData."""
    api_data = {
        "title": "Soporte de Filamento",
        "printProfiles": [
            {"printTime": 3600, "filamentWeight": 12.5, "filamentType": "PLA"}
        ],
    }
    mock_client = _mock_httpx_client(api_status=200, api_json=api_data)

    with patch("app.services.makerworld_fetcher.httpx.Client", return_value=mock_client):
        resultado = fetch_model_data("12345")

    assert resultado is not None
    assert resultado.model_id == "12345"
    assert resultado.model_name == "Soporte de Filamento"
    assert resultado.print_time_seconds == 3600
    assert resultado.filament_weight_g == pytest.approx(12.5)
    assert resultado.filament_type == "PLA"


def test_fetch_api_sin_perfiles_cae_a_html():
    """Si la API responde 200 pero sin perfiles, intenta el HTML."""
    api_data = {"title": "Modelo vacío", "printProfiles": []}
    html_data = {
        "props": {
            "pageProps": {
                "design": {
                    "title": "Modelo del HTML",
                    "printProfiles": [{"printTime": 500, "filamentWeight": 3.0}],
                }
            }
        }
    }
    mock_client = _mock_httpx_client(
        api_status=200,
        api_json=api_data,
        html_status=200,
        html_text=_html_con_next_data(html_data),
    )

    with patch("app.services.makerworld_fetcher.httpx.Client", return_value=mock_client):
        resultado = fetch_model_data("12345")

    assert resultado is not None
    assert resultado.print_time_seconds == 500


def test_fetch_api_403_cae_a_html():
    """Si la API responde 403, intenta el HTML."""
    html_data = {
        "props": {
            "pageProps": {
                "design": {
                    "title": "Cubo",
                    "printProfiles": [{"printTime": 900, "filamentWeight": 4.5}],
                }
            }
        }
    }
    mock_client = _mock_httpx_client(
        api_status=403,
        html_status=200,
        html_text=_html_con_next_data(html_data),
    )

    with patch("app.services.makerworld_fetcher.httpx.Client", return_value=mock_client):
        resultado = fetch_model_data("12345")

    assert resultado is not None
    assert resultado.print_time_seconds == 900
    assert resultado.filament_weight_g == pytest.approx(4.5)


# ---------------------------------------------------------------------------
# fetch_model_data — vía HTML
# ---------------------------------------------------------------------------

def test_fetch_html_con_next_data():
    """HTML con __NEXT_DATA__ retorna MakerworldData."""
    html_data = {
        "props": {
            "pageProps": {
                "design": {
                    "title": "Soporte ajustable",
                    "printProfiles": [
                        {"printTime": 7200, "filamentWeight": 35.0, "filamentType": "PETG"}
                    ],
                }
            }
        }
    }
    mock_client = _mock_httpx_client(
        api_status=404,
        html_status=200,
        html_text=_html_con_next_data(html_data),
    )

    with patch("app.services.makerworld_fetcher.httpx.Client", return_value=mock_client):
        resultado = fetch_model_data("99999")

    assert resultado is not None
    assert resultado.model_id == "99999"
    assert resultado.print_time_seconds == 7200
    assert resultado.filament_type == "PETG"


def test_fetch_html_sin_datos_retorna_none():
    """HTML sin __NEXT_DATA__ y API fallida retorna None."""
    mock_client = _mock_httpx_client(
        api_status=404,
        html_status=200,
        html_text="<html><body>Página sin datos</body></html>",
    )

    with patch("app.services.makerworld_fetcher.httpx.Client", return_value=mock_client):
        resultado = fetch_model_data("12345")

    assert resultado is None


def test_fetch_ambos_fallan_retorna_none():
    """Si API y HTML retornan 403/500, retorna None."""
    mock_client = _mock_httpx_client(api_status=403, html_status=503)

    with patch("app.services.makerworld_fetcher.httpx.Client", return_value=mock_client):
        resultado = fetch_model_data("12345")

    assert resultado is None


def test_fetch_excepcion_de_red_retorna_none():
    """Una excepción de red retorna None sin propagarse."""
    mock_client = MagicMock()
    mock_client.get.side_effect = Exception("Connection refused")
    mock_client.__enter__ = lambda s: s
    mock_client.__exit__ = MagicMock(return_value=False)

    with patch("app.services.makerworld_fetcher.httpx.Client", return_value=mock_client):
        resultado = fetch_model_data("12345")

    assert resultado is None
