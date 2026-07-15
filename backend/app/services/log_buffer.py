"""
Buffer de log en memoria para el visor de System Info (issue #140, pieza C).

`collections.deque(maxlen=500)` registrado como `logging.Handler` en el
root logger durante el lifespan de la app. Snapshot con refresh manual
desde la UI — sin streaming en vivo (fuera de alcance del issue).
"""

import logging
from collections import deque
from datetime import datetime, timezone
from typing import List, Optional, TypedDict


class LogRow(TypedDict):
    ts: str
    level: str
    logger: str
    msg: str


_BUFFER: "deque[LogRow]" = deque(maxlen=500)


class _DequeLogHandler(logging.Handler):
    """Handler que apenda cada registro emitido al buffer en memoria."""

    def emit(self, record: logging.LogRecord) -> None:
        try:
            _BUFFER.append({
                "ts": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
                "level": record.levelname,
                "logger": record.name,
                "msg": record.getMessage(),
            })
        except Exception:
            # Un handler de logging JAMÁS debe poder reventar la app —
            # si formatear el mensaje falla, se descarta esa línea en silencio.
            pass


_handler: Optional[_DequeLogHandler] = None


def install() -> None:
    """Registra el handler en el root logger. Llamar una vez en el lifespan."""
    global _handler
    if _handler is not None:
        return
    _handler = _DequeLogHandler()
    _handler.setLevel(logging.DEBUG)
    logging.getLogger().addHandler(_handler)


def uninstall() -> None:
    """Desregistra el handler. Llamar al shutdown del lifespan."""
    global _handler
    if _handler is None:
        return
    logging.getLogger().removeHandler(_handler)
    _handler = None


def get_logs(level: Optional[str] = None, limit: int = 200) -> List[LogRow]:
    """
    Últimas `limit` líneas del buffer, más reciente primero. `level` filtra
    por severidad mínima (ej. "WARNING" incluye WARNING/ERROR/CRITICAL).
    """
    rows = list(_BUFFER)
    if level:
        min_level = logging.getLevelName(level.upper())
        if isinstance(min_level, int):
            rows = [r for r in rows if logging.getLevelName(r["level"]) >= min_level]
    rows.reverse()
    return rows[: max(1, min(500, limit))]
