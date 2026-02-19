#!/usr/bin/env python3
"""
Script de migración de datos de SQLite a PostgreSQL para TurtleForge Cost.

PREREQUISITO: Ejecutar `alembic upgrade head` en PostgreSQL ANTES de este script.
              Las tablas deben existir en PostgreSQL con el esquema correcto.

USO:
    # Desde el directorio backend/
    pip install psycopg2-binary  # solo para este script
    python scripts/migrate_sqlite_to_postgres.py \\
        --sqlite ./data/calculator3d.db \\
        --postgres "postgresql://turtleforge:password@localhost:5432/turtleforge"

ORDEN DE MIGRACIÓN (respeta FK):
    1. users
    2. filaments            (sin FK)
    3. printers             (sin FK)
    4. supplies             (sin FK)
    5. electricity_tariffs  (sin FK)
    6. app_settings         (FK → users)
    7. quotes               (FK → users, filaments, printers)

IDEMPOTENCIA:
    Usa INSERT ... ON CONFLICT DO NOTHING.
    Es seguro ejecutar múltiples veces: filas existentes no se duplican.

SEQUENCES:
    Al finalizar, resetea los contadores de autoincremento de PostgreSQL
    al máximo ID de cada tabla para evitar conflictos en futuros INSERTs.
"""

import argparse
import sqlite3
import sys
from datetime import datetime
from typing import Any, Optional

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    print("ERROR: psycopg2-binary no está instalado.")
    print("  Ejecuta: pip install psycopg2-binary")
    sys.exit(1)


# ---------------------------------------------------------------------------
# Definición de tablas: nombre, columnas datetime, columnas boolean
# ---------------------------------------------------------------------------

TABLES = [
    {
        "name": "users",
        "datetime_cols": ["created_at"],
        "bool_cols": ["is_active", "is_admin"],
    },
    {
        "name": "filaments",
        "datetime_cols": ["created_at", "updated_at"],
        "bool_cols": [],
    },
    {
        "name": "printers",
        "datetime_cols": ["created_at", "updated_at"],
        "bool_cols": [],
    },
    {
        "name": "supplies",
        "datetime_cols": ["created_at"],
        "bool_cols": [],
    },
    {
        "name": "electricity_tariffs",
        "datetime_cols": ["scraped_at"],
        "bool_cols": [],
    },
    {
        "name": "app_settings",
        "datetime_cols": ["updated_at"],
        "bool_cols": [],
    },
    {
        "name": "quotes",
        "datetime_cols": ["created_at"],
        "bool_cols": [],
    },
]


# ---------------------------------------------------------------------------
# Conversión de tipos SQLite → Python/PostgreSQL
# ---------------------------------------------------------------------------

def parse_datetime(value: Any) -> Optional[datetime]:
    """
    Convierte un valor datetime de SQLite (string) a objeto datetime.

    SQLite puede guardar datetimes como:
      - "2024-01-15 10:30:00"
      - "2024-01-15 10:30:00.123456"
      - "2024-01-15T10:30:00"
      - "2024-01-15T10:30:00.123456"
    """
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    if not isinstance(value, str):
        return value

    formats = [
        "%Y-%m-%d %H:%M:%S.%f",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%dT%H:%M:%S.%f",
        "%Y-%m-%dT%H:%M:%S",
    ]
    for fmt in formats:
        try:
            return datetime.strptime(value, fmt)
        except (ValueError, TypeError):
            continue

    print(f"  AVISO: No se pudo parsear datetime '{value}', se conserva como string.")
    return value


def convert_row(row_dict: dict, datetime_cols: list, bool_cols: list) -> dict:
    """
    Convierte los tipos de una fila de SQLite a tipos compatibles con PostgreSQL.

    - Columnas datetime: string → datetime object
    - Columnas boolean: 0/1 → False/True
    - Resto: sin cambios
    """
    for col in datetime_cols:
        if col in row_dict:
            row_dict[col] = parse_datetime(row_dict[col])

    for col in bool_cols:
        if col in row_dict and row_dict[col] is not None:
            row_dict[col] = bool(row_dict[col])

    return row_dict


# ---------------------------------------------------------------------------
# Migración de una tabla
# ---------------------------------------------------------------------------

def migrate_table(
    sqlite_conn: sqlite3.Connection,
    pg_conn: psycopg2.extensions.connection,
    table_name: str,
    datetime_cols: list,
    bool_cols: list,
) -> int:
    """
    Lee todos los registros de una tabla en SQLite e inserta en PostgreSQL.

    Usa INSERT ... ON CONFLICT DO NOTHING para manejar re-ejecuciones.

    Returns:
        int: Número de filas procesadas desde SQLite.
    """
    sqlite_cur = sqlite_conn.cursor()
    sqlite_cur.execute(f"SELECT * FROM {table_name}")
    rows = sqlite_cur.fetchall()

    if not rows:
        print(f"  {table_name}: vacía — omitida")
        return 0

    col_names = [desc[0] for desc in sqlite_cur.description]
    col_list = ", ".join([f'"{c}"' for c in col_names])
    placeholders = ", ".join(["%s"] * len(col_names))
    sql = (
        f"INSERT INTO {table_name} ({col_list}) "
        f"VALUES ({placeholders}) "
        f"ON CONFLICT DO NOTHING"
    )

    pg_cur = pg_conn.cursor()
    inserted = 0
    skipped = 0

    for raw_row in rows:
        row_dict = dict(zip(col_names, raw_row))
        row_dict = convert_row(row_dict, datetime_cols, bool_cols)
        values = [row_dict[col] for col in col_names]

        pg_cur.execute(sql, values)
        if pg_cur.rowcount > 0:
            inserted += 1
        else:
            skipped += 1

    pg_conn.commit()
    pg_cur.close()

    if skipped > 0:
        print(f"  {table_name}: {inserted} insertadas, {skipped} omitidas (ON CONFLICT)")
    else:
        print(f"  {table_name}: {inserted} insertadas")

    return len(rows)


# ---------------------------------------------------------------------------
# Reset de sequences en PostgreSQL
# ---------------------------------------------------------------------------

def reset_sequences(pg_conn: psycopg2.extensions.connection, table_names: list) -> None:
    """
    Actualiza los contadores de autoincremento de PostgreSQL.

    Después de insertar filas con IDs explícitos, la secuencia SERIAL
    sigue en 1. El siguiente INSERT sin ID explícito fallaría con
    'duplicate key'. setval() corrige esto al máximo ID actual.

    Usa COALESCE(MAX(id), 1) para tablas vacías (donde MAX retorna NULL).
    """
    print("\n[3/3] Reseteando sequences de PostgreSQL...")
    pg_cur = pg_conn.cursor()

    for table in table_names:
        try:
            pg_cur.execute(f"""
                SELECT setval(
                    pg_get_serial_sequence('{table}', 'id'),
                    COALESCE((SELECT MAX(id) FROM {table}), 1)
                )
            """)
            pg_conn.commit()
            print(f"  {table}: sequence actualizada")
        except Exception as e:
            pg_conn.rollback()
            print(f"  {table}: AVISO — no se pudo resetear sequence: {e}")

    pg_cur.close()


# ---------------------------------------------------------------------------
# Validación final: conteo de registros
# ---------------------------------------------------------------------------

def validate_counts(
    sqlite_conn: sqlite3.Connection,
    pg_conn: psycopg2.extensions.connection,
    table_names: list,
) -> bool:
    """
    Compara el conteo de registros entre SQLite y PostgreSQL.

    Returns:
        bool: True si todos los conteos coinciden, False si hay diferencias.
    """
    print("\n[Validación] Comparando conteos de registros...")
    sqlite_cur = sqlite_conn.cursor()
    pg_cur = pg_conn.cursor()

    all_ok = True
    print(f"  {'Tabla':<30} {'SQLite':>8} {'PostgreSQL':>12} {'Estado':>8}")
    print(f"  {'-'*30} {'-'*8} {'-'*12} {'-'*8}")

    for table in table_names:
        sqlite_cur.execute(f"SELECT COUNT(*) FROM {table}")
        sqlite_count = sqlite_cur.fetchone()[0]

        pg_cur.execute(f"SELECT COUNT(*) FROM {table}")
        pg_count = pg_cur.fetchone()[0]

        estado = "OK" if sqlite_count == pg_count else "DIFERENTE"
        if estado == "DIFERENTE":
            all_ok = False

        print(f"  {table:<30} {sqlite_count:>8} {pg_count:>12} {estado:>8}")

    sqlite_cur.close()
    pg_cur.close()

    return all_ok


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Migra datos de SQLite a PostgreSQL para TurtleForge Cost",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--sqlite",
        required=True,
        help="Ruta al archivo SQLite. Ej: ./data/calculator3d.db",
    )
    parser.add_argument(
        "--postgres",
        required=True,
        help='URL de PostgreSQL. Ej: "postgresql://user:pass@localhost:5432/turtleforge"',
    )
    args = parser.parse_args()

    print("=" * 60)
    print("TurtleForge Cost — Migración SQLite → PostgreSQL")
    print("=" * 60)
    print(f"  SQLite:     {args.sqlite}")
    print(f"  PostgreSQL: {args.postgres}")
    print()

    # --- Conectar a SQLite ---
    print("[1/3] Conectando a SQLite...")
    try:
        sqlite_conn = sqlite3.connect(args.sqlite)
        sqlite_conn.row_factory = sqlite3.Row
        print(f"  Conectado a: {args.sqlite}")
    except Exception as e:
        print(f"ERROR: No se pudo conectar a SQLite: {e}")
        sys.exit(1)

    # Verificar que las tablas esperadas existan en SQLite
    sqlite_cur = sqlite_conn.cursor()
    sqlite_cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
    existing_tables = {row[0] for row in sqlite_cur.fetchall()}
    expected_tables = {t["name"] for t in TABLES}
    missing = expected_tables - existing_tables
    if missing:
        print(f"  AVISO: Las siguientes tablas no existen en SQLite y serán omitidas: {missing}")
    sqlite_cur.close()

    # --- Conectar a PostgreSQL ---
    print("\n[2/3] Conectando a PostgreSQL...")
    try:
        pg_conn = psycopg2.connect(args.postgres)
        pg_conn.autocommit = False
        print(f"  Conectado a: {args.postgres}")
    except Exception as e:
        print(f"ERROR: No se pudo conectar a PostgreSQL: {e}")
        print("  Asegúrate de que PostgreSQL está corriendo y que la URL es correcta.")
        print("  Asegúrate de haber ejecutado: alembic upgrade head")
        sqlite_conn.close()
        sys.exit(1)

    # --- Migrar tablas ---
    print("\n[2/3] Migrando datos...")
    table_names = []
    for table_def in TABLES:
        table_name = table_def["name"]
        if table_name not in existing_tables:
            print(f"  {table_name}: no existe en SQLite — omitida")
            continue

        table_names.append(table_name)
        try:
            migrate_table(
                sqlite_conn=sqlite_conn,
                pg_conn=pg_conn,
                table_name=table_name,
                datetime_cols=table_def["datetime_cols"],
                bool_cols=table_def["bool_cols"],
            )
        except Exception as e:
            pg_conn.rollback()
            print(f"\nERROR al migrar tabla '{table_name}': {e}")
            print("  La transacción fue revertida. Corrige el error y ejecuta el script de nuevo.")
            sqlite_conn.close()
            pg_conn.close()
            sys.exit(1)

    # --- Resetear sequences ---
    reset_sequences(pg_conn, table_names)

    # --- Validar ---
    ok = validate_counts(sqlite_conn, pg_conn, table_names)

    sqlite_conn.close()
    pg_conn.close()

    print()
    if ok:
        print("✓ Migración completada exitosamente. Todos los conteos coinciden.")
        print()
        print("Próximos pasos:")
        print("  1. Verifica que la app arranque correctamente con PostgreSQL.")
        print("  2. Haz una prueba de login y de cotización.")
        print("  3. Una vez verificado, puedes eliminar el archivo SQLite.")
    else:
        print("✗ ADVERTENCIA: Algunos conteos no coinciden.")
        print("  Revisa los registros con ON CONFLICT DO NOTHING que fueron omitidos.")
        print("  Puede indicar datos duplicados o conflictos de clave única.")
        sys.exit(1)


if __name__ == "__main__":
    main()
