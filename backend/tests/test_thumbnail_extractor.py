"""
Tests del extractor de thumbnails embebidos en archivos `.3mf`.

Cubre los 6 caminos del extractor: plate_number explícito, fallback
plate_1.png, fallback thumbnail.png, fallback model_thumbnail.png, regex
plate_N para placas no canónicas, y caso ZIP inválido / sin PNG.

También verifica save_thumbnail + delete_thumbnail contra MinIO mockeado
(no hay disco involucrado tras el refactor a object storage).
"""

import io
import zipfile
from unittest.mock import AsyncMock, patch

import pytest

from app.services.thumbnail_extractor import (
    delete_thumbnail,
    extract_plate_png,
    save_thumbnail,
    thumbnail_key,
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


# ─── thumbnail_key ──────────────────────────────────────────────────────────


@pytest.mark.unit
class TestThumbnailKey:
    def test_formato_canonico(self):
        for mid in [1, 42, 9999, 100_000]:
            assert thumbnail_key(mid) == f"thumbnails/{mid}.png"


# ─── save_thumbnail ─────────────────────────────────────────────────────────


@pytest.mark.unit
@pytest.mark.asyncio
class TestSaveThumbnail:
    async def test_sube_a_minio_y_devuelve_key(self):
        with patch(
            "app.services.thumbnail_extractor.upload_file",
            new=AsyncMock(),
        ) as mock_upload:
            key = await save_thumbnail(42, PNG_FIXTURE_A)
            assert key == "thumbnails/42.png"
            mock_upload.assert_awaited_once_with(
                "thumbnails/42.png", PNG_FIXTURE_A, content_type="image/png"
            )

    async def test_key_consistente_por_id(self):
        with patch(
            "app.services.thumbnail_extractor.upload_file",
            new=AsyncMock(),
        ):
            for mid in [1, 42, 9999, 100_000]:
                key = await save_thumbnail(mid, PNG_FIXTURE_A)
                assert key == f"thumbnails/{mid}.png"


# ─── delete_thumbnail ───────────────────────────────────────────────────────


@pytest.mark.unit
@pytest.mark.asyncio
class TestDeleteThumbnail:
    async def test_borra_objeto_en_minio(self):
        with patch(
            "app.services.thumbnail_extractor.delete_file",
            new=AsyncMock(),
        ) as mock_delete:
            await delete_thumbnail(7)
            mock_delete.assert_awaited_once_with("thumbnails/7.png")

    async def test_silencia_excepcion_del_backend(self):
        """Si MinIO falla al borrar, no se propaga."""
        with patch(
            "app.services.thumbnail_extractor.delete_file",
            new=AsyncMock(side_effect=Exception("connection refused")),
        ):
            # No debe lanzar
            await delete_thumbnail(123)
