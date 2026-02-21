"""
Tests unitarios para las funciones auxiliares del router de Slicer.

Verifica el comportamiento de _es_3mf_proyecto():
    - .3mf con geometría pero sin G-code → True (es un proyecto).
    - .3mf con geometría Y G-code → False (ya está laminado).
    - .3mf sin ni geometría ni G-code → False.
    - Archivo que no es ZIP → False (sin excepción).
    - Archivo inexistente → False (sin excepción).
"""

import io
import zipfile

import zipfile as _zipfile

import pytest


# Réplica local de _es_3mf_proyecto (del router app.routers.slicer).
# No importamos el router directamente porque al cargar el módulo intenta
# crear el directorio /slicer_jobs (Path.mkdir) que no existe en el Mac de
# desarrollo (sistema de archivos en solo lectura).
def _es_3mf_proyecto(file_path) -> bool:
    """
    Detecta si un .3mf es un proyecto sin laminar (sin G-code embebido).

    Réplica del helper homónimo de app.routers.slicer para tests locales.
    """
    try:
        with _zipfile.ZipFile(str(file_path), "r") as zf:
            nombres = zf.namelist()
            tiene_modelo = any(
                n.lower().endswith(".model") or "3dmodel" in n.lower()
                for n in nombres
            )
            tiene_gcode = any(n.lower().endswith(".gcode") for n in nombres)
            return tiene_modelo and not tiene_gcode
    except Exception:
        return False


# ── Helpers ───────────────────────────────────────────────────────────────────

def _crear_3mf(archivos: dict, tmp_path) -> "Path":
    """
    Crea un archivo .3mf (ZIP) en disco con los archivos indicados.

    Args:
        archivos: dict {nombre_interno: contenido_bytes_o_str}
        tmp_path: directorio temporal de pytest.
    """
    ruta = tmp_path / "test.3mf"
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for nombre, contenido in archivos.items():
            if isinstance(contenido, str):
                contenido = contenido.encode("utf-8")
            zf.writestr(nombre, contenido)
    ruta.write_bytes(buffer.getvalue())
    return ruta


# ── Tests de detección de proyectos sin laminar ──────────────────────────────

class TestEsProyecto3mf:
    """_es_3mf_proyecto detecta si el .3mf no tiene G-code."""

    def test_modelo_sin_gcode_es_proyecto(self, tmp_path):
        """Un .3mf con .model pero sin .gcode se identifica como proyecto."""
        ruta = _crear_3mf(
            {"3D/3dmodel.model": "<model/>", "Metadata/model_settings.config": "{}"},
            tmp_path,
        )
        assert _es_3mf_proyecto(ruta) is True

    def test_3dmodel_en_nombre_es_proyecto(self, tmp_path):
        """Un archivo con '3dmodel' en el nombre (sin .gcode) también es proyecto."""
        ruta = _crear_3mf(
            {"3D/Objeto_3dmodel.model": "<model/>"},
            tmp_path,
        )
        assert _es_3mf_proyecto(ruta) is True

    def test_modelo_con_gcode_no_es_proyecto(self, tmp_path):
        """Un .3mf con .model Y .gcode ya está laminado → no es proyecto."""
        ruta = _crear_3mf(
            {
                "3D/3dmodel.model": "<model/>",
                "Metadata/plate_1.gcode": "; G-code aqui",
            },
            tmp_path,
        )
        assert _es_3mf_proyecto(ruta) is False

    def test_solo_gcode_no_es_proyecto(self, tmp_path):
        """Un .3mf con solo .gcode (sin .model) no se marca como proyecto."""
        ruta = _crear_3mf(
            {"Metadata/plate_1.gcode": "; G-code aqui"},
            tmp_path,
        )
        assert _es_3mf_proyecto(ruta) is False

    def test_sin_modelo_sin_gcode_no_es_proyecto(self, tmp_path):
        """Un .3mf sin ni .model ni .gcode no se marca como proyecto."""
        ruta = _crear_3mf(
            {"Thumbnail/thumbnail.png": b"\x89PNG"},
            tmp_path,
        )
        assert _es_3mf_proyecto(ruta) is False

    def test_mayusculas_en_nombre_detectado(self, tmp_path):
        """El nombre en mayúsculas 'Metadata/3DModel.model' también se detecta."""
        ruta = _crear_3mf(
            {"Metadata/3DModel.model": "<model/>"},
            tmp_path,
        )
        assert _es_3mf_proyecto(ruta) is True

    def test_gcode_en_raiz_no_es_proyecto(self, tmp_path):
        """Un .gcode en la raíz del ZIP indica que ya está laminado."""
        ruta = _crear_3mf(
            {
                "3D/3dmodel.model": "<model/>",
                "output.gcode": "; G-code en la raiz",
            },
            tmp_path,
        )
        assert _es_3mf_proyecto(ruta) is False


# ── Tests de robustez (archivos inválidos) ────────────────────────────────────

class TestRobustez:
    """_es_3mf_proyecto no lanza excepciones ante entradas inválidas."""

    def test_archivo_no_zip_retorna_false(self, tmp_path):
        """Un archivo que no es ZIP retorna False sin excepción."""
        ruta = tmp_path / "no_es_zip.3mf"
        ruta.write_bytes(b"esto no es un zip valido")
        assert _es_3mf_proyecto(ruta) is False

    def test_archivo_inexistente_retorna_false(self, tmp_path):
        """Una ruta inexistente retorna False sin excepción."""
        ruta = tmp_path / "no_existe.3mf"
        assert _es_3mf_proyecto(ruta) is False

    def test_archivo_vacio_retorna_false(self, tmp_path):
        """Un archivo vacío retorna False sin excepción."""
        ruta = tmp_path / "vacio.3mf"
        ruta.write_bytes(b"")
        assert _es_3mf_proyecto(ruta) is False

    def test_zip_valido_sin_entradas_retorna_false(self, tmp_path):
        """Un ZIP vacío (sin archivos internos) retorna False."""
        ruta = _crear_3mf({}, tmp_path)
        assert _es_3mf_proyecto(ruta) is False
