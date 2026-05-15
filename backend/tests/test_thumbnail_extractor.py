"""
Tests del extractor de thumbnails embebidos en archivos `.3mf`.

Cubre los 6 caminos del extractor: plate_number explícito, fallback
plate_1.png, fallback thumbnail.png, fallback model_thumbnail.png, regex
plate_N para placas no canónicas, y caso ZIP inválido / sin PNG.

También verifica save_thumbnail + delete_thumbnail idempotentes con
tmp_path para no depender de /app/static.
"""

import io
import zipfile
from pathlib import Path
from unittest.mock import patch

import pytest

from app.services import thumbnail_extractor
from app.services.thumbnail_extractor import (
    delete_thumbnail,
    extract_plate_png,
    save_thumbnail,
)


# ─── Helpers ────────────────────────────────────────────────────────────────


PNG_FIXTURE_A = b"\x89PNG\r\n\x1a\nFIXTURE-A"
PNG_FIXTURE_B = b"\x89PNG\r\n\x1a\nFIXTURE-B"
PNG_FIXTURE_C = b"\x89PNG\r\n\x1a\nFIXTURE-C"


def _make_zip(entries: dict[str, bytes]) -> bytes:
    """Crea un ZIP en memoria con los archivos indicados (path → bytes)."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for path, data in entries.items():
            zf.writestr(path, data)
    return buf.getvalue()


# ─── extract_plate_png ──────────────────────────────────────────────────────


@pytest.mark.unit
class TestExtractPlatePng:
    def test_prioriza_plate_explicito(self):
        zip_bytes = _make_zip(
            {
                "Metadata/plate_1.png": PNG_FIXTURE_A,
                "Metadata/plate_2.png": PNG_FIXTURE_B,
                "Metadata/plate_3.png": PNG_FIXTURE_C,
            }
        )
        assert extract_plate_png(zip_bytes, plate_number=2) == PNG_FIXTURE_B

    def test_fallback_plate_1_sin_plate_number(self):
        zip_bytes = _make_zip(
            {
                "Metadata/plate_1.png": PNG_FIXTURE_A,
                "Metadata/plate_2.png": PNG_FIXTURE_B,
            }
        )
        assert extract_plate_png(zip_bytes) == PNG_FIXTURE_A

    def test_fallback_thumbnail_png_si_no_hay_plate(self):
        zip_bytes = _make_zip({"Metadata/thumbnail.png": PNG_FIXTURE_A})
        assert extract_plate_png(zip_bytes) == PNG_FIXTURE_A

    def test_fallback_model_thumbnail_png(self):
        zip_bytes = _make_zip({"Metadata/model_thumbnail.png": PNG_FIXTURE_B})
        assert extract_plate_png(zip_bytes) == PNG_FIXTURE_B

    def test_regex_plate_n_cuando_no_hay_canonicos(self):
        """Si el ZIP trae plate_7.png solamente (no plate_1), regex lo encuentra."""
        zip_bytes = _make_zip({"Metadata/plate_7.png": PNG_FIXTURE_C})
        assert extract_plate_png(zip_bytes) == PNG_FIXTURE_C

    def test_plate_number_explicito_aunque_no_exista_cae_a_fallbacks(self):
        zip_bytes = _make_zip(
            {
                "Metadata/plate_1.png": PNG_FIXTURE_A,
                "Metadata/thumbnail.png": PNG_FIXTURE_B,
            }
        )
        # plate_99 no existe, cae a plate_1
        assert extract_plate_png(zip_bytes, plate_number=99) == PNG_FIXTURE_A

    def test_orden_default_candidates(self):
        """plate_1 gana sobre thumbnail.png sobre model_thumbnail.png."""
        zip_bytes = _make_zip(
            {
                "Metadata/plate_1.png": PNG_FIXTURE_A,
                "Metadata/thumbnail.png": PNG_FIXTURE_B,
                "Metadata/model_thumbnail.png": PNG_FIXTURE_C,
            }
        )
        assert extract_plate_png(zip_bytes) == PNG_FIXTURE_A

    def test_thumbnail_gana_sobre_model_thumbnail(self):
        zip_bytes = _make_zip(
            {
                "Metadata/thumbnail.png": PNG_FIXTURE_A,
                "Metadata/model_thumbnail.png": PNG_FIXTURE_B,
            }
        )
        assert extract_plate_png(zip_bytes) == PNG_FIXTURE_A

    def test_zip_sin_thumbnails_retorna_none(self):
        zip_bytes = _make_zip(
            {
                "3D/3dmodel.model": b"<xml>...</xml>",
                "Metadata/slice_info.config": b"info",
            }
        )
        assert extract_plate_png(zip_bytes) is None

    def test_zip_vacio_retorna_none(self):
        zip_bytes = _make_zip({})
        assert extract_plate_png(zip_bytes) is None

    def test_bytes_no_son_zip_retorna_none(self):
        assert extract_plate_png(b"not a zip file") is None

    def test_zip_corrupto_retorna_none(self):
        # ZIP header pero datos truncados
        assert extract_plate_png(b"PK\x03\x04\x00\x00") is None

    def test_no_match_regex_para_paths_similares_pero_invalidos(self):
        """`plate_X.png` (no número) no debe coincidir; `plate_2.jpg` tampoco."""
        zip_bytes = _make_zip(
            {
                "Metadata/plate_X.png": PNG_FIXTURE_A,
                "Metadata/plate_2.jpg": PNG_FIXTURE_B,
                "OtraCarpeta/plate_1.png": PNG_FIXTURE_C,
            }
        )
        assert extract_plate_png(zip_bytes) is None


# ─── save_thumbnail ─────────────────────────────────────────────────────────


@pytest.mark.unit
class TestSaveThumbnail:
    def test_crea_directorio_si_no_existe(self, tmp_path, monkeypatch):
        monkeypatch.setattr(thumbnail_extractor, "THUMBNAIL_DIR", tmp_path / "thumbnails")
        url = save_thumbnail(42, PNG_FIXTURE_A)
        assert (tmp_path / "thumbnails" / "42.png").exists()
        assert (tmp_path / "thumbnails" / "42.png").read_bytes() == PNG_FIXTURE_A
        assert url == "/static/thumbnails/42.png"

    def test_sobreescribe_si_ya_existia(self, tmp_path, monkeypatch):
        monkeypatch.setattr(thumbnail_extractor, "THUMBNAIL_DIR", tmp_path)
        save_thumbnail(1, PNG_FIXTURE_A)
        save_thumbnail(1, PNG_FIXTURE_B)
        assert (tmp_path / "1.png").read_bytes() == PNG_FIXTURE_B

    def test_url_format_consistente(self, tmp_path, monkeypatch):
        monkeypatch.setattr(thumbnail_extractor, "THUMBNAIL_DIR", tmp_path)
        for mid in [1, 42, 9999, 100_000]:
            url = save_thumbnail(mid, PNG_FIXTURE_A)
            assert url == f"/static/thumbnails/{mid}.png"


# ─── delete_thumbnail ───────────────────────────────────────────────────────


@pytest.mark.unit
class TestDeleteThumbnail:
    def test_borra_archivo_existente(self, tmp_path, monkeypatch):
        monkeypatch.setattr(thumbnail_extractor, "THUMBNAIL_DIR", tmp_path)
        save_thumbnail(7, PNG_FIXTURE_A)
        assert (tmp_path / "7.png").exists()
        delete_thumbnail(7)
        assert not (tmp_path / "7.png").exists()

    def test_no_op_si_no_existe(self, tmp_path, monkeypatch):
        monkeypatch.setattr(thumbnail_extractor, "THUMBNAIL_DIR", tmp_path)
        # No debe lanzar excepción aunque el archivo no exista
        delete_thumbnail(999)

    def test_silencia_oserror(self, tmp_path, monkeypatch):
        """Si unlink falla por OSError (permisos, etc.) no se propaga."""
        monkeypatch.setattr(thumbnail_extractor, "THUMBNAIL_DIR", tmp_path)
        with patch.object(Path, "unlink", side_effect=OSError("permission denied")):
            # Debe loggear el debug y retornar sin error
            delete_thumbnail(123)
