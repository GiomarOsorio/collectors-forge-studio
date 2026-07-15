"""
Tests para System Info (issue #140, pieza C).

Dos bloques:
1. `services/log_buffer.py` — handler deque puro, sin DB ni HTTP.
2. `routers/system.py` — endpoints vía HTTP con DB mockeada.
"""

import logging
from unittest.mock import AsyncMock, MagicMock, patch

from httpx import ASGITransport, AsyncClient

from app.database import get_db
from app.main import app
from app.services import log_buffer
from app.services.auth import get_admin_user


def _fake_user(role="admin"):
    u = MagicMock()
    u.id = 1
    u.role = role
    u.is_active = True
    return u


def _set_overrides(overrides: dict):
    for dep, override in overrides.items():
        app.dependency_overrides[dep] = override


def _clear_overrides():
    app.dependency_overrides.clear()


def _fake_db(session):
    async def _gen():
        yield session
    return _gen


# ---------------------------------------------------------------------------
# 1. log_buffer.py
# ---------------------------------------------------------------------------

class TestLogBuffer:
    def setup_method(self):
        log_buffer._BUFFER.clear()
        log_buffer.uninstall()
        # El root logger por default filtra por debajo de WARNING antes de
        # que cualquier handler lo vea — subir el nivel del logger de
        # pruebas para poder ejercitar mensajes INFO en estos tests.
        logging.getLogger("t").setLevel(logging.DEBUG)
        logging.getLogger("test.modulo").setLevel(logging.DEBUG)

    def teardown_method(self):
        log_buffer.uninstall()
        log_buffer._BUFFER.clear()

    def test_install_captura_logs_del_root_logger(self):
        log_buffer.install()
        logging.getLogger("test.modulo").warning("algo raro pasó")
        rows = log_buffer.get_logs()
        assert len(rows) == 1
        assert rows[0]["level"] == "WARNING"
        assert rows[0]["logger"] == "test.modulo"
        assert rows[0]["msg"] == "algo raro pasó"

    def test_install_es_idempotente(self):
        log_buffer.install()
        log_buffer.install()  # no debe duplicar el handler
        logging.getLogger("test.modulo").info("hola")
        assert len(log_buffer.get_logs()) == 1

    def test_uninstall_detiene_captura(self):
        log_buffer.install()
        log_buffer.uninstall()
        logging.getLogger("test.modulo").error("no debería capturarse")
        assert log_buffer.get_logs() == []

    def test_get_logs_mas_reciente_primero(self):
        log_buffer.install()
        logging.getLogger("t").info("uno")
        logging.getLogger("t").info("dos")
        rows = log_buffer.get_logs()
        assert rows[0]["msg"] == "dos"
        assert rows[1]["msg"] == "uno"

    def test_get_logs_filtra_por_nivel_minimo(self):
        log_buffer.install()
        logging.getLogger("t").info("info msg")
        logging.getLogger("t").warning("warning msg")
        logging.getLogger("t").error("error msg")
        rows = log_buffer.get_logs(level="WARNING")
        levels = {r["level"] for r in rows}
        assert levels == {"WARNING", "ERROR"}

    def test_get_logs_respeta_limit(self):
        log_buffer.install()
        for i in range(10):
            logging.getLogger("t").info(f"msg {i}")
        assert len(log_buffer.get_logs(limit=3)) == 3

    def test_buffer_tiene_maxlen_500(self):
        assert log_buffer._BUFFER.maxlen == 500


# ---------------------------------------------------------------------------
# 2. routers/system.py
# ---------------------------------------------------------------------------

class TestSystemInfoEndpoint:
    async def test_info_shape_y_migraciones_up_to_date(self):
        db = AsyncMock()

        db_size_result = MagicMock()
        db_size_result.scalar.return_value = "45 MB"

        top_tables_row = MagicMock(relname="print_queue", size_bytes=1024 * 1024)
        top_tables_result = MagicMock()
        top_tables_result.all.return_value = [top_tables_row]

        used_bytes_result = MagicMock()
        used_bytes_result.scalar.return_value = 5_000_000

        count_result = MagicMock()
        count_result.scalar.return_value = 7

        alembic_version_result = MagicMock()
        alembic_version_result.scalar.return_value = "abc123"

        db.execute.side_effect = [
            db_size_result, top_tables_result, used_bytes_result,
            count_result, count_result, count_result, count_result,
            alembic_version_result,
        ]

        _set_overrides({get_db: _fake_db(db), get_admin_user: lambda: _fake_user("admin")})
        try:
            with patch("app.routers.system._get_head_revision", return_value="abc123"):
                transport = ASGITransport(app=app)
                async with AsyncClient(transport=transport, base_url="http://test") as client:
                    resp = await client.get("/api/system/info")
            assert resp.status_code == 200
            body = resp.json()
            assert body["db"]["size_pretty"] == "45 MB"
            assert body["db"]["top_tables"][0]["name"] == "print_queue"
            assert body["minio"]["used_bytes"] == 5_000_000
            assert body["counts"]["model_files"] == 7
            assert body["migrations"]["current"] == "abc123"
            assert body["migrations"]["head"] == "abc123"
            assert body["migrations"]["up_to_date"] is True
            assert body["version"] == "dev"
        finally:
            _clear_overrides()

    async def test_info_migraciones_desactualizadas(self):
        db = AsyncMock()
        db_size_result = MagicMock(scalar=MagicMock(return_value="1 MB"))
        top_tables_result = MagicMock(all=MagicMock(return_value=[]))
        used_bytes_result = MagicMock(scalar=MagicMock(return_value=0))
        count_result = MagicMock(scalar=MagicMock(return_value=0))
        alembic_version_result = MagicMock(scalar=MagicMock(return_value="old_rev"))

        db.execute.side_effect = [
            db_size_result, top_tables_result, used_bytes_result,
            count_result, count_result, count_result, count_result,
            alembic_version_result,
        ]

        _set_overrides({get_db: _fake_db(db), get_admin_user: lambda: _fake_user("admin")})
        try:
            with patch("app.routers.system._get_head_revision", return_value="new_rev"):
                transport = ASGITransport(app=app)
                async with AsyncClient(transport=transport, base_url="http://test") as client:
                    resp = await client.get("/api/system/info")
            body = resp.json()
            assert body["migrations"]["up_to_date"] is False
        finally:
            _clear_overrides()

    async def test_no_admin_rechazado_403(self):
        db = AsyncMock()
        _set_overrides({get_db: _fake_db(db), get_admin_user: lambda: (_ for _ in ()).throw(
            __import__("fastapi").HTTPException(status_code=403, detail="admin only")
        )})
        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.get("/api/system/info")
            assert resp.status_code == 403
        finally:
            _clear_overrides()


class TestSystemLogsEndpoint:
    async def test_logs_endpoint_devuelve_buffer(self):
        log_buffer._BUFFER.clear()
        log_buffer.install()
        try:
            logging.getLogger("t").warning("test log line")
            _set_overrides({get_admin_user: lambda: _fake_user("admin")})
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.get("/api/system/logs")
            assert resp.status_code == 200
            body = resp.json()
            assert any(r["msg"] == "test log line" for r in body)
        finally:
            _clear_overrides()
            log_buffer.uninstall()
            log_buffer._BUFFER.clear()

    async def test_logs_endpoint_filtra_por_nivel(self):
        log_buffer._BUFFER.clear()
        log_buffer.install()
        try:
            logging.getLogger("t").info("info line")
            logging.getLogger("t").error("error line")
            _set_overrides({get_admin_user: lambda: _fake_user("admin")})
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.get("/api/system/logs?level=ERROR")
            body = resp.json()
            assert all(r["level"] == "ERROR" for r in body)
            assert any(r["msg"] == "error line" for r in body)
        finally:
            _clear_overrides()
            log_buffer.uninstall()
            log_buffer._BUFFER.clear()


# ---------------------------------------------------------------------------
# 3. Backup (issue #140, pieza E)
# ---------------------------------------------------------------------------

class TestPgDumpDsn:
    def test_convierte_asyncpg_a_dsn_plano(self):
        from app.config import settings
        from app.routers.system import _pg_dump_dsn

        original = settings.DATABASE_URL
        try:
            settings.DATABASE_URL = "postgresql+asyncpg://user:pass@cfs-postgres:5432/collectorsforge"
            assert _pg_dump_dsn() == "postgresql://user:pass@cfs-postgres:5432/collectorsforge"
        finally:
            settings.DATABASE_URL = original

    def test_preserva_password_url_encoded(self):
        from app.config import settings
        from app.routers.system import _pg_dump_dsn

        original = settings.DATABASE_URL
        try:
            settings.DATABASE_URL = "postgresql+asyncpg://user:p%40ss@host:5432/db"
            assert _pg_dump_dsn() == "postgresql://user:p%40ss@host:5432/db"
        finally:
            settings.DATABASE_URL = original


def _fake_pg_dump_process(chunks, returncode=0, stderr=b""):
    """Simula el `Process` de `asyncio.create_subprocess_exec` para pg_dump."""
    stdout = MagicMock()
    remaining = list(chunks)

    async def _read(n):
        if remaining:
            return remaining.pop(0)
        return b""
    stdout.read = AsyncMock(side_effect=_read)

    stderr_mock = MagicMock()
    stderr_mock.read = AsyncMock(return_value=stderr)

    process = MagicMock()
    process.stdout = stdout
    process.stderr = stderr_mock
    process.wait = AsyncMock(return_value=returncode)
    return process


class TestBackupEndpoint:
    async def test_backup_streamea_bytes_del_dump(self):
        fake_process = _fake_pg_dump_process([b"PGDMP-chunk-1", b"chunk-2"])
        _set_overrides({get_admin_user: lambda: _fake_user("admin")})
        try:
            with patch("app.routers.system.asyncio.create_subprocess_exec", AsyncMock(return_value=fake_process)):
                transport = ASGITransport(app=app)
                async with AsyncClient(transport=transport, base_url="http://test") as client:
                    resp = await client.get("/api/system/backup")
            assert resp.status_code == 200
            assert resp.content == b"PGDMP-chunk-1chunk-2"
            assert resp.headers["content-type"] == "application/octet-stream"
            assert "cfs-backup-" in resp.headers["content-disposition"]
            assert ".dump" in resp.headers["content-disposition"]
        finally:
            _clear_overrides()

    async def test_backup_no_admin_rechazado_403(self):
        _set_overrides({get_admin_user: lambda: (_ for _ in ()).throw(
            __import__("fastapi").HTTPException(status_code=403, detail="admin only")
        )})
        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.get("/api/system/backup")
            assert resp.status_code == 403
        finally:
            _clear_overrides()

    async def test_stream_pg_dump_loguea_error_si_falla(self, caplog):
        from app.routers.system import _stream_pg_dump

        fake_process = _fake_pg_dump_process([], returncode=1, stderr=b"pg_dump: error: connection failed")
        with patch("app.routers.system.asyncio.create_subprocess_exec", AsyncMock(return_value=fake_process)):
            with caplog.at_level("ERROR"):
                chunks = [c async for c in _stream_pg_dump()]
        assert chunks == []
        assert "connection failed" in caplog.text
