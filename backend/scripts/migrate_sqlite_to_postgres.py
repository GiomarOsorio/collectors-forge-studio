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
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Optional

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    print("ERROR: psycopg2-binary no está instalado.")
    print("  Ejecuta: pip install psycopg2-binary")
    sys.exit(1)


# ---------------------------------------------------------------------------
# Columnas NUMERIC por tabla: columna → escala de cuantización como string.
# La escala coincide con la definición Numeric(precision, escala) del modelo ORM.
# Se usa para limpiar artefactos IEEE 754 de SQLite antes de insertar en PostgreSQL.
# ---------------------------------------------------------------------------

NUMERIC_COLS: dict = {
    "filaments": {
        "price_per_kg":    "0.0001",    # Numeric(12, 4)
        "weight_per_roll": "0.001",     # Numeric(10, 3)
        "diameter":        "0.001",     # Numeric(6,  3)
        "density":         "0.000001",  # Numeric(8,  6)
    },
    "printers": {
        "purchase_price":             "0.01",      # Numeric(12, 2)
        "power_consumption_watts":    "0.01",      # Numeric(10, 2)
        "estimated_lifespan_hours":   "0.01",      # Numeric(10, 2)
        "current_hours":              "0.01",      # Numeric(10, 2)
        "nozzle_price":               "0.01",      # Numeric(10, 2)
        "nozzle_lifespan_hours":      "0.01",      # Numeric(10, 2)
        "buildplate_price":           "0.01",      # Numeric(10, 2)
        "buildplate_lifespan_hours":  "0.01",      # Numeric(10, 2)
        "other_maintenance_per_hour": "0.000001",  # Numeric(10, 6)
    },
    "app_settings": {
        "electricity_rate":       "0.000001",  # Numeric(10, 6)
        "failure_rate_percent":   "0.01",      # Numeric(6,  2)
        "labor_cost_per_hour":    "0.01",      # Numeric(10, 2)
        "default_margin_percent": "0.01",      # Numeric(6,  2)
    },
    "supplies": {
        "price_per_unit": "0.0001",  # Numeric(12, 4)
        "pack_price":     "0.01",    # Numeric(12, 2)
    },
    "quotes": {
        "weight_grams":               "0.001",   # Numeric(10, 3)
        "print_time_hours":           "0.0001",  # Numeric(10, 4)
        "preparation_time_hours":     "0.0001",  # Numeric(10, 4)
        "post_processing_time_hours": "0.0001",  # Numeric(10, 4)
        "material_cost":              "0.01",    # Numeric(12, 2)
        "electricity_cost":           "0.01",    # Numeric(12, 2)
        "depreciation_cost":          "0.01",    # Numeric(12, 2)
        "maintenance_cost":           "0.01",    # Numeric(12, 2)
        "labor_cost":                 "0.01",    # Numeric(12, 2)
        "failure_cost":               "0.01",    # Numeric(12, 2)
        "subtotal":                   "0.01",    # Numeric(12, 2)
        "margin_percent":             "0.01",    # Numeric(6,  2)
        "margin_amount":              "0.01",    # Numeric(12, 2)
        "total_per_unit":             "0.01",    # Numeric(12, 2)
        "total_price":                "0.01",    # Numeric(12, 2)
        "supplies_cost":              "0.01",    # Numeric(12, 2)
        "usd_to_cop_rate":            "0.0001",  # Numeric(14, 4)
        "total_per_unit_cop":         "1",       # Numeric(14, 0) — COP entero
        "total_price_cop":            "1",       # Numeric(14, 0) — COP entero
    },
}


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


def round_numeric_cols(table_name: str, row_dict: dict) -> dict:
    """
    Limpia contaminación IEEE 754 en columnas float de SQLite antes de
    insertar en columnas NUMERIC de PostgreSQL.

    SQLite almacena valores Float con artefactos binarios (ej: 1.2400000000000002).
    PostgreSQL acepta esos valores en columnas Float, pero cuando las columnas
    son NUMERIC(precision, escala) los valores deben ser exactos.

    Estrategia de conversión segura:
        1. Decimal(str(valor))  → elimina la representación binaria IEEE 754
        2. .quantize(escala, ROUND_HALF_UP) → redondea a los decimales correctos

    NUNCA se usa Decimal(float_valor) directamente: eso propaga el artefacto
    binario (Decimal(1.24) == Decimal('1.2399999999999999911182158029987476766109466552734375')).

    La escala de cada columna está definida en NUMERIC_COLS y coincide con la
    definición Numeric(precision, escala) del modelo ORM.

    Args:
        table_name: Nombre de la tabla (clave en NUMERIC_COLS).
        row_dict:   Fila leída de SQLite como dict {columna: valor}.

    Returns:
        El mismo dict con las columnas numéricas reemplazadas por Decimal exactos.
        Columnas ausentes o con valor None se dejan sin cambios.
    """
    cols = NUMERIC_COLS.get(table_name, {})
    for col, scale_str in cols.items():
        if col not in row_dict or row_dict[col] is None:
            continue
        try:
            row_dict[col] = (
                Decimal(str(row_dict[col]))
                .quantize(Decimal(scale_str), rounding=ROUND_HALF_UP)
            )
        except Exception as exc:
            # Dejamos el valor original: el INSERT fallará con un error claro
            # en lugar de silenciar el problema con un valor incorrecto.
            print(f"  AVISO: No se pudo redondear {table_name}.{col}={row_dict[col]!r}: {exc}")

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
    # ON CONFLICT DO UPDATE: los datos del backup siempre sobreescriben los
    # valores auto-generados por create_default_data() en el arranque.
    update_set = ", ".join(
        [f'"{c}" = EXCLUDED."{c}"' for c in col_names if c != "id"]
    )
    sql = (
        f"INSERT INTO {table_name} ({col_list}) "
        f"VALUES ({placeholders}) "
        f"ON CONFLICT (id) DO UPDATE SET {update_set}"
    )

    pg_cur = pg_conn.cursor()
    inserted = 0
    updated = 0

    for raw_row in rows:
        row_dict = dict(zip(col_names, raw_row))
        row_dict = convert_row(row_dict, datetime_cols, bool_cols)
        row_dict = round_numeric_cols(table_name, row_dict)
        values = [row_dict[col] for col in col_names]

        pg_cur.execute(sql, values)
        if pg_cur.rowcount > 0:
            inserted += 1
        else:
            updated += 1

    pg_conn.commit()
    pg_cur.close()

    if updated > 0:
        print(f"  {table_name}: {inserted} insertadas, {updated} actualizadas (ON CONFLICT UPDATE)")
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
