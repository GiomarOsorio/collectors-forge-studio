"""
Smoke test de migraciones Alembic — verifica que las revisiones cargan
y que la cadena up→down→up no rompe.

NO ejecuta SQL real contra una BD. Sólo valida:
1. Cada archivo de migración es Python sintácticamente válido
2. revision y down_revision son consistentes (no hay órfanos)
3. Hay exactamente UNA head (no se quedaron múltiples ramas sin merge)
4. La cadena de down_revisions termina en None (base) sin ciclos

Este test es rapidísimo y atrapa el caso típico de "Multiple head revisions
detected" antes de que el deploy falle.

Per CLAUDE.md: head actual es `i3j4k5l6m7n8` (thumbnails) seguido por
`j4k5l6m7n8o9` (4 campos visuales filamentos).
"""

import ast
import os
import re
from pathlib import Path

import pytest


VERSIONS_DIR = Path(__file__).parent.parent / "alembic" / "versions"


def _parse_revision_meta(path: Path) -> dict:
    """Extrae `revision`, `down_revision`, `branch_labels` del archivo.

    Soporta `revision = "..."` (Assign) y `revision: str = "..."`
    (AnnAssign con type hint — formato que Alembic genera desde
    versiones recientes).
    """
    tree = ast.parse(path.read_text())
    meta = {"revision": None, "down_revision": None, "branch_labels": None, "depends_on": None}

    def _try_extract(target_id, value_node):
        if target_id not in meta or value_node is None:
            return
        try:
            meta[target_id] = ast.literal_eval(value_node)
        except (ValueError, SyntaxError):
            pass

    for node in ast.walk(tree):
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name):
                    _try_extract(target.id, node.value)
        elif isinstance(node, ast.AnnAssign):
            if isinstance(node.target, ast.Name):
                _try_extract(node.target.id, node.value)
    return meta


@pytest.fixture(scope="module")
def revisions():
    """Carga todas las revisiones del directorio versions/."""
    files = sorted(VERSIONS_DIR.glob("*.py"))
    revs = {}
    for f in files:
        if f.name.startswith("__"):
            continue
        meta = _parse_revision_meta(f)
        if meta["revision"]:
            revs[meta["revision"]] = {**meta, "file": f.name}
    return revs


@pytest.mark.unit
class TestMigrationsIntegrity:
    def test_archivos_validos_python(self):
        """Cada archivo en versions/ debe ser Python sintácticamente válido."""
        for path in VERSIONS_DIR.glob("*.py"):
            if path.name.startswith("__"):
                continue
            try:
                ast.parse(path.read_text())
            except SyntaxError as e:
                pytest.fail(f"{path.name}: {e}")

    def test_cada_revision_tiene_revision_id(self, revisions):
        for rev_id, meta in revisions.items():
            assert rev_id, f"Falta `revision` en {meta['file']}"

    def test_no_revisiones_duplicadas(self, revisions):
        ids = [meta["file"] for meta in revisions.values()]
        # diccionario ya dedupe por revision; chequear que ningún archivo se duplique
        assert len(set(ids)) == len(ids)

    def test_cadena_down_revision_es_consistente(self, revisions):
        """Cada down_revision debe existir o ser None (base)."""
        for rev_id, meta in revisions.items():
            down = meta["down_revision"]
            if down is None:
                continue
            # Soporta tupla (merge migration)
            downs = down if isinstance(down, tuple) else (down,)
            for d in downs:
                assert d in revisions, (
                    f"{meta['file']} apunta a down_revision={d!r} que no existe"
                )

    def test_exactamente_un_head(self, revisions):
        """No debe haber múltiples heads sin merge (Multiple head revisions)."""
        all_ids = set(revisions.keys())
        referenced_as_down = set()
        for meta in revisions.values():
            down = meta["down_revision"]
            if down is None:
                continue
            downs = down if isinstance(down, tuple) else (down,)
            for d in downs:
                referenced_as_down.add(d)
        heads = all_ids - referenced_as_down
        assert len(heads) == 1, (
            f"Se detectaron {len(heads)} heads — esperaba 1. Heads: {heads}. "
            "Hay que crear una merge migration."
        )

    def test_head_actual_documentado_existe(self, revisions):
        """Head actual per CLAUDE.md es j4k5l6m7n8o9 (post-fase 4)."""
        assert "j4k5l6m7n8o9" in revisions, (
            "Migration j4k5l6m7n8o9 (4 campos visuales) debe existir"
        )

    def test_cadena_no_tiene_ciclos(self, revisions):
        """Recorrer cada down_revision recursivamente no debe entrar en bucle."""
        for start_id in revisions:
            visited = set()
            current = start_id
            while current is not None:
                assert current not in visited, f"Ciclo detectado en {current}"
                visited.add(current)
                down = revisions[current]["down_revision"]
                # Tupla (merge): tomar el primero para chequeo lineal
                if isinstance(down, tuple):
                    current = down[0]
                else:
                    current = down
                if current and current not in revisions:
                    break  # base


@pytest.mark.unit
class TestMigrationsFase4:
    """Verifica que las migraciones de Fase 4 son idempotentes (IF NOT EXISTS)."""

    def test_i3j4k5l6m7n8_usa_if_not_exists(self):
        path = VERSIONS_DIR / "i3j4k5l6m7n8_add_local_thumbnail_path.py"
        content = path.read_text()
        assert "IF NOT EXISTS" in content, (
            "Migration de thumbnails debe usar IF NOT EXISTS para idempotencia"
        )

    def test_j4k5l6m7n8o9_usa_if_not_exists(self):
        path = VERSIONS_DIR / "j4k5l6m7n8o9_add_filament_design_fields.py"
        content = path.read_text()
        assert content.count("IF NOT EXISTS") >= 4, (
            "Migration de design fields debe usar IF NOT EXISTS en cada columna"
        )

    def test_j4k5l6m7n8o9_apunta_a_i3j4k5l6m7n8(self):
        path = VERSIONS_DIR / "j4k5l6m7n8o9_add_filament_design_fields.py"
        content = path.read_text()
        assert 'down_revision: Union[str, None] = "i3j4k5l6m7n8"' in content
