"""
Render de thumbnails 2D para archivos `.stl` subidos al Vault.

A diferencia de `.3mf`/`.gcode.3mf` (que traen el thumbnail embebido por
el slicer, ver `thumbnail_extractor.py`), un `.stl` es solo geometría —
no hay preview que extraer, hay que renderizarlo. Usamos matplotlib
(backend Agg, sin GPU/X11) + numpy-stl en vez de un motor 3D real
(trimesh+pyrender, Open3D) para no depender de EGL/OpenGL dentro del
container — el patrón de `Poly3DCollection(mesh.vectors)` es el que
numpy-stl documenta oficialmente para plotear STL con matplotlib.

matplotlib se importa DENTRO de la función (no al nivel de módulo) para
no pagar el costo de import (~60 MB de dependencia) en cada arranque del
proceso — solo se paga cuando alguien sube un STL.
"""

import io
import logging
from typing import Optional

logger = logging.getLogger(__name__)

#: Por encima de este número de triángulos se decima el mesh para el
#: render — el thumbnail no necesita exactitud, solo ser reconocible.
_MAX_TRIANGLES_FOR_RENDER = 500_000

#: Tamaño del PNG generado (cuadrado, pulgadas × DPI).
_FIGSIZE_INCHES = 4
_DPI = 128


def render_stl_thumbnail(stl_bytes: bytes) -> Optional[bytes]:
    """
    Renderiza un thumbnail PNG isométrico de un archivo `.stl`.

    Nunca levanta excepción — devuelve None si el STL es inválido, está
    vacío, o el render falla. Mismo contrato de tolerancia a fallos que
    `thumbnail_extractor.extract_plate_png`, para que el caller siga el
    mismo patrón `if png: ...`.

    Args:
        stl_bytes: Contenido binario completo del `.stl` (ASCII o binario).

    Returns:
        Bytes PNG con fondo transparente, o None si no se pudo generar.
    """
    try:
        import matplotlib
        matplotlib.use("Agg")
        # API orientada a objetos (Figure directo) en vez de `pyplot` — pyplot
        # mantiene estado global (stack de "figura actual") que NO es
        # thread-safe. Este render corre en un worker thread vía
        # `asyncio.to_thread`; con `pyplot.figure()`/`pyplot.close()` el
        # render fallaba en silencio ahí (atrapado por el except de abajo,
        # detectado en CI: pasaba llamado directo pero no vía to_thread) —
        # `Figure()` es un objeto plano, sin registro global que pisar.
        from matplotlib.figure import Figure
        from mpl_toolkits import mplot3d
        from stl import mesh as stl_mesh
    except ImportError:
        logger.warning(
            "numpy-stl/matplotlib no disponibles — no se puede renderizar thumbnail STL"
        )
        return None

    try:
        model = stl_mesh.Mesh.from_file("upload.stl", fh=io.BytesIO(stl_bytes))
    except Exception as exc:
        logger.debug("STL inválido, no se pudo parsear para thumbnail: %s", exc)
        return None

    vectors = model.vectors
    if vectors is None or len(vectors) == 0:
        return None

    render_vectors = vectors
    if len(vectors) > _MAX_TRIANGLES_FOR_RENDER:
        step = len(vectors) // _MAX_TRIANGLES_FOR_RENDER + 1
        render_vectors = vectors[::step]

    try:
        figure = Figure(figsize=(_FIGSIZE_INCHES, _FIGSIZE_INCHES), dpi=_DPI)
        axes = figure.add_subplot(projection="3d")
        collection = mplot3d.art3d.Poly3DCollection(
            render_vectors, facecolor="#F59E0B", linewidths=0,
        )
        axes.add_collection3d(collection)

        # Escala del bounding box del mesh COMPLETO (no del subset
        # decimado) para que el encuadre sea correcto en meshes grandes.
        scale = model.points.flatten()
        axes.auto_scale_xyz(scale, scale, scale)

        axes.view_init(elev=25, azim=45)  # cámara isométrica
        axes.set_axis_off()
        figure.patch.set_alpha(0.0)
        axes.patch.set_alpha(0.0)

        buf = io.BytesIO()
        figure.savefig(buf, format="png", transparent=True, bbox_inches="tight", pad_inches=0.15)
        return buf.getvalue()
    except Exception as exc:
        logger.warning("Fallo al renderizar thumbnail STL: %s", exc)
        return None
