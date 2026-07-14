# Base de Datos — Collector's Forge Studio

PostgreSQL 16 con SQLAlchemy 2.0 async + asyncpg. Migraciones gestionadas con Alembic.

---

## Conexión

**En contenedor (producción):**
```bash
# Shell interactivo
podman exec -it cfs-postgres psql -U collectorsforge -d collectorsforge

# Consulta directa
podman exec cfs-postgres \
  psql -U collectorsforge -d collectorsforge -c "SELECT now();"
```

**URL de conexión:**
```
postgresql+asyncpg://collectorsforge:<password>@cfs-postgres:5432/collectorsforge
```

---

## Historial de migraciones

Las migraciones están en `backend/alembic/versions/`. Se aplican con `alembic upgrade head`.

| Revisión | Archivo | Descripción |
|---|---|---|
| `a3f8d2c19b47` | `a3f8d2c19b47_initial_schema.py` | Schema inicial: users, filaments, printers, supplies, quotes, settings, electricity_tariffs |
| `f4a1b9c2d8e7` | `f4a1b9c2d8e7_add_company_id.py` | Multi-tenant: tabla `companies` (UUID PK), company_id en todas las entidades. Empresa por defecto UUID `000...0001` |
| `a7b8c9d0e1f2` | `a7b8c9d0e1f2_add_client_quotes.py` | Tabla `client_quotes`: cotizaciones multi-producto COT-XXXX |
| `b1c2d3e4f5a6` | `b1c2d3e4f5a6_add_inventory.py` | Tabla `inventory_items` (stock unificado) y `purchase_orders` / `purchase_order_items` |
| `b2c3d4e5f6a7` | `b2c3d4e5f6a7_add_tracking_data_to_purchase_orders.py` | Agrega `tracking_data`/`tracking_checked_at` en `purchase_orders` (eliminadas en `t4u5v6w7x8y9` al quitar el microservicio tracker) |
| `c2d3e4f5a6b7` | `c2d3e4f5a6b7_merge_filaments_supplies_to_inventory.py` | Migra filamentos e insumos a `inventory_items`; quotes pasan a referenciar `inventory_item_id` |
| `c3d4e5f6a7b8` | `c3d4e5f6a7b8_add_maintenance.py` | Tablas `maintenance_printers`, `maintenance_logs`, `maintenance_log_items` |
| `c3d5e7f9a1b3` | `c3d5e7f9a1b3_float_to_numeric.py` | Columnas de precio cambiadas de Float a Numeric(12,4) para precisión Decimal |
| `c4d5e6f7a8b9` | `c4d5e6f7a8b9_maintenance_use_printers.py` | maintenance_printers referencia a tabla `printers` en lugar de tener nombre propio |
| `d1e2f3a4b5c6` | `d1e2f3a4b5c6_add_printed_items.py` | Tabla `printed_items`: impresiones 3D con foto, precio y stock |
| `d3e4f5a6b7c8` | `d3e4f5a6b7c8_add_slicing_jobs.py` | Tabla `slicing_jobs`: trabajos de laminado STL/G-code (eliminada en `t4u5v6w7x8y9` al quitar el microservicio slicer) |
| `d5e6f7a8b9c0` | `d5e6f7a8b9c0_add_print_queue.py` | Tabla `print_queue`: cola de impresión con posición y deducción atómica de inventario |
| `e2f3a4b5c6d7` | `e2f3a4b5c6d7_quotes_jsonb_details.py` | Columna `details` JSONB en `quotes` para desglose completo de costos |
| `e6f7a8b9c0d1` | `e6f7a8b9c0d1_add_iva_to_client_quotes.py` | Campo `include_iva` (bool) y `usd_rate` en `client_quotes` |
| `f5a6b7c8d9e0` | `f5a6b7c8d9e0_add_company_profile.py` | Campos de perfil en `companies`: slogan, address, phone, email, nit, logo_url |
| `f7a8b9c0d1e2` | `f7a8b9c0d1e2_add_company_pdf_settings.py` | Tabla `company_templates`; campo `pdf_terms` en companies |
| `a0b1c2d3e4f5` | `a0b1c2d3e4f5_sprint3_queue_index.py` | Índice en `print_queue.quote_id` para queries de cola |
| `b1c2d3e4f5a7` | `b1c2d3e4f5a7_client_quote_items_jsonb.py` | Migra `client_quotes.items` de TEXT a JSONB |
| `c2d3e4f5a6b8` | `c2d3e4f5a6b8_company_id_not_null.py` | `company_id NOT NULL` en 7 tablas (posteriormente revertido por `h2i3j4k5l6m7`) |
| `d3e4f5a6b7c9` | `d3e4f5a6b7c9_add_updated_at_quotes.py` | Campo `updated_at` en `quotes` y `client_quotes` |
| `e4f5a6b7c8d0` | `e4f5a6b7c8d0_add_inventory_categories.py` | Tabla `inventory_categories` (7 categorías seed: Filamento con decimals, 6 sin decimales) |
| `a9b0c1d2e3f4` | `a9b0c1d2e3f4_palette_jsonb.py` | Campo `pdf_palette` JSONB en companies: `[{name, hex}]`; elimina los 4 campos de color fijos |
| `f5a6b7c8d9e1` | `f5a6b7c8d9e1_merge_palette_and_categories.py` | Merge: une rama `palette_jsonb` con rama `inventory_categories` |
| `a2b3c4d5e6f7` | `a2b3c4d5e6f7_add_consumable_fields.py` | Campos para consumibles en `inventory_items` + categoría Consumible |
| `b3c4d5e6f7a8` | `b3c4d5e6f7a8_add_model_files.py` | Tabla `model_files` para el Vault de archivos `.3mf` en MinIO |
| `a1b2c3d4e5f6` | `a1b2c3d4e5f6_add_usd_rate_to_client_quotes.py` | Campo `usd_rate` agregado en `client_quotes` para guardar la tasa USD/COP al momento de emisión |
| `c5d6e7f8a9b0` | `c5d6e7f8a9b0_merge_three_heads.py` | Merge de tres heads: `model_files`, `printed_items`, `usd_rate` |
| `c6d7e8f9a0b1` | `c6d7e8f9a0b1_add_plates_data.py` | Campo `plates_data` JSONB en `slicing_jobs` para multi-placa |
| `g1h2i3j4k5l6` | `g1h2i3j4k5l6_add_oidc_support.py` | Agrega `oidc_sub` (unique, indexed, nullable) y hace `hashed_password` nullable en `users` para soporte OIDC/JIT provisioning |
| `h2i3j4k5l6m7` | `h2i3j4k5l6m7_remove_multitenant_add_roles.py` | Elimina `company_id` de 17 tablas operativas. Reemplaza `is_admin` por `role` (`admin`/`operator`/`viewer`) en `users`. `companies` se mantiene como singleton |
| `i3j4k5l6m7n8` | `i3j4k5l6m7n8_add_local_thumbnail_path.py` | Columna `local_thumbnail_path` en `model_files` (luego renombrada a `thumbnail_key`) |
| `j4k5l6m7n8o9` | `j4k5l6m7n8o9_add_filament_design_fields.py` | Campos de diseño en filamentos |
| `k5l6m7n8o9p0` | `k5l6m7n8o9p0_add_sale_price.py` | Campo `sale_price` en `inventory_items` |
| `l6m7n8o9p0q1` | `l6m7n8o9p0q1_drop_printer_maintenance_fields.py` | Limpia campos de mantenimiento embebidos en `printers` |
| `m7n8o9p0q1r2` | `m7n8o9p0q1r2_vault_dual_files.py` | Slots dual `source_file` + `print_file` en `model_files` |
| `n8o9p0q1r2s3` | `n8o9p0q1r2s3_queue_vault_link.py` | FK `model_file_id` en `print_queue` |
| `o9p0q1r2s3t4` | `o9p0q1r2s3t4_rename_storage_columns_to_minio_keys.py` | Renombra `local_thumbnail_path → thumbnail_key`, `logo_url → logo_key`, `image_url → image_key` (los binarios ahora viven en MinIO, no en `/app/static`). NULLea filas existentes |
| `t4u5v6w7x8y9` | `t4u5v6w7x8y9_drop_slicer_and_tracker.py` | Elimina tabla `slicing_jobs` y columnas `tracking_data`/`tracking_checked_at` de `purchase_orders` al quitar los microservicios `slicer` y `tracker` |
| … | *(varias migraciones intermedias no documentadas aquí — ver `alembic history` para la cadena completa)* | |
| `2787aa619580` | `2787aa619580_vault_photos_notes_failure_reason.py` | Tabla `model_file_photos`, `model_files.notes`, `print_queue.failure_reason`/`failure_category` (issue #130) |
| `68c641f83b25` | `68c641f83b25_queue_batch_schedule.py` | `print_queue.batch_id` + `scheduled_at` (issue #133) |
| `82717e0701b3` | `82717e0701b3_print_queue_created_by.py` | `print_queue.created_by` FK→users (issue #131) |
| `8422a0c213e9` | `8422a0c213e9_inventory_spools.py` | **Head actual** — Tabla `spools`, `print_queue.spool_id`, `app_settings.spool_low_stock_threshold_g` (issue #134) |

**Aplicar todas las migraciones:**
```bash
alembic upgrade head
```

**Verificar versión actual:**
```bash
alembic current
# o
podman exec cfs-postgres \
  psql -U collectorsforge -d collectorsforge \
  -c "SELECT version_num FROM alembic_version;"
```

---

## Esquema completo de tablas

### `companies`

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | UUID PK | UUID fijo `000...0001` para empresa default |
| `name` | VARCHAR(200) | Nombre de la empresa |
| `slogan` | VARCHAR(500) | Eslogan (opcional) |
| `address` | TEXT | Dirección postal |
| `phone` | VARCHAR(50) | Teléfono |
| `email` | VARCHAR(200) | Correo electrónico |
| `nit` | VARCHAR(50) | NIT o número fiscal |
| `logo_key` | VARCHAR(500) | Key MinIO del logo (`companies/{uuid}.{ext}`). El API expone `logo_url` apuntando al proxy `GET /api/company/logo` |
| `pdf_terms` | TEXT | Términos de pago para el pie de cotización |
| `pdf_palette` | JSONB | Paleta de colores: `[{"name": "primary", "hex": "#1A1A1A"}, ...]` |
| `created_at` | TIMESTAMP | Fecha de creación |

### `company_templates`

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | INTEGER PK autoincrement | — |
| `company_id` | UUID FK → companies | — |
| `name` | VARCHAR(200) | Nombre del template |
| `description` | TEXT | Descripción opcional |
| `template_type` | VARCHAR(20) | `cot` \| `tfc` \| `all` |
| `content` | TEXT | HTML + Liquid completo |
| `is_default` | BOOLEAN | Si es el template activo para su tipo |
| `created_at` | TIMESTAMP | — |
| `updated_at` | TIMESTAMP | — |

### `users`

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | INTEGER PK | — |
| `username` | VARCHAR(50) UNIQUE | Tomado del claim `preferred_username` del IdP |
| `email` | VARCHAR(100) UNIQUE | — |
| `hashed_password` | VARCHAR(255) NULLABLE | Siempre NULL — login es solo vía OIDC |
| `oidc_sub` | VARCHAR(255) UNIQUE NULLABLE | Claim `sub` del ID token; identifica al usuario en el IdP |
| `is_active` | BOOLEAN | Si el usuario puede iniciar sesión |
| `role` | VARCHAR(20) | `admin` \| `operator` \| `viewer` |
| `created_at` | TIMESTAMP | — |

### `printers`

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | INTEGER PK | — |
| `name` | VARCHAR(200) | Nombre descriptivo |
| `model` | VARCHAR(200) | Modelo del equipo |
| `purchase_price` | NUMERIC(12,4) | Precio de compra en USD |
| `power_consumption_watts` | NUMERIC(12,4) | Consumo en W durante impresión |
| `estimated_lifespan_hours` | NUMERIC(12,4) | Vida útil estimada en horas |
| `current_hours` | NUMERIC(12,4) | Horas acumuladas de uso |
| `nozzle_price` | NUMERIC(12,4) | Precio de reemplazo de boquilla |
| `nozzle_lifespan_hours` | NUMERIC(12,4) | Vida útil de la boquilla |
| `buildplate_price` | NUMERIC(12,4) | Precio de la placa de construcción |
| `buildplate_lifespan_hours` | NUMERIC(12,4) | Vida útil de la placa |
| `other_maintenance_per_hour` | NUMERIC(12,4) | Otros costos de mant. por hora |
| `notes` | TEXT | Notas libres |

### `filaments` (legacy)

Tabla legacy reemplazada por `inventory_items` con `category="Filamento"`. Se mantiene por compatibilidad con cotizaciones antiguas.

| Columna | Tipo |
|---|---|
| `id` | INTEGER PK |
| `brand` | VARCHAR(100) |
| `type` | VARCHAR(50) |
| `color` | VARCHAR(50) |
| `price_per_kg` | NUMERIC(12,4) |
| `weight_per_roll` | NUMERIC(12,4) |
| `diameter` | NUMERIC(6,2) |
| `density` | NUMERIC(6,4) |
| `notes` | TEXT |

### `inventory_items`

Stock unificado para filamentos, insumos, herramientas y cualquier material.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | UUID PK | — |
| `name` | VARCHAR(200) | Nombre del ítem |
| `category` | VARCHAR(50) | `Filamento` \| `Insumo` \| `Herramienta` \| `Otro` |
| `brand` | VARCHAR(100) | Marca (opcional) |
| `material_type` | VARCHAR(50) | Tipo de material: PLA, PETG, etc. (para filamentos) |
| `color` | VARCHAR(50) | Color (para filamentos) |
| `unit` | VARCHAR(20) | Unidad: `kg`, `g`, `unidad`, `m`, etc. |
| `quantity` | NUMERIC(12,4) | Stock actual |
| `min_quantity` | NUMERIC(12,4) | Mínimo para alerta de reorden |
| `price_per_unit` | NUMERIC(12,4) | Precio por unidad en USD |
| `location` | VARCHAR(100) | Ubicación física |
| `notes` | TEXT | Notas |
| `needs_reorder` | BOOLEAN | Flag manual de "necesita compra" |
| `created_at` | TIMESTAMP | — |
| `updated_at` | TIMESTAMP | — |

### `purchase_orders`

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | UUID PK | — |
| `supplier` | VARCHAR(200) | Proveedor |
| `order_date` | TIMESTAMP | Fecha de pedido |
| `status` | VARCHAR(20) | `pending` \| `shipped` \| `arrived` |
| `total_usd` | NUMERIC(12,4) | Total en USD |
| `notes` | TEXT | — |
| `tracking_number` | VARCHAR(200) | Número de rastreo (texto libre, ingresado a mano) |
| `carrier` | VARCHAR(100) | Transportista |
| `arrived_at` | TIMESTAMP | Fecha de llegada efectiva |

### `purchase_order_items`

| Columna | Tipo |
|---|---|
| `id` | INTEGER PK |
| `purchase_order_id` | UUID FK |
| `inventory_item_id` | UUID FK → inventory_items |
| `quantity` | NUMERIC(12,4) |
| `unit_price` | NUMERIC(12,4) |

### `printed_items`

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | UUID PK | — |
| `name` | VARCHAR(200) | Nombre del modelo |
| `description` | TEXT | — |
| `unit_price` | NUMERIC(10,2) | Precio de venta |
| `quantity` | INTEGER | Stock disponible |
| `image_key` | VARCHAR(500) | Key MinIO de la imagen (`prints/{uuid}.{ext}`). El API expone `image_url` apuntando al proxy `GET /api/inventory/prints/{id}/image` |
| `notes` | TEXT | — |
| `created_at` | TIMESTAMP | — |

### `quotes`

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | INTEGER PK | — |
| `piece_name` | VARCHAR(200) | Nombre de la pieza |
| `description` | TEXT | — |
| `client_name` | VARCHAR(200) | — |
| `inventory_item_id` | UUID FK → inventory_items | Filamento principal |
| `printer_id` | INTEGER FK → printers | — |
| `weight_grams` | NUMERIC(12,4) | — |
| `print_time_hours` | NUMERIC(12,4) | — |
| `quantity` | INTEGER | — |
| `margin_percent` | NUMERIC(8,4) | — |
| `total_price` | NUMERIC(12,4) | Total calculado |
| `details` | JSONB | Desglose completo: {material_cost, electricity_cost, ...} |
| `created_at` | TIMESTAMP | — |

### `client_quotes`

Cotizaciones multi-producto para clientes (COT-XXXX).

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | INTEGER PK | — |
| `quote_number` | VARCHAR(20) | `COT-0001` (auto-incrementado) |
| `client_name` | VARCHAR(200) | — |
| `description` | TEXT | — |
| `quote_date` | TIMESTAMP | Fecha de emisión |
| `expiry_date` | TIMESTAMP | Fecha de vencimiento |
| `items` | JSONB | `[{name, quantity, unit_price, line_total}]` |
| `subtotal` | NUMERIC(12,4) | — |
| `iva_amount` | NUMERIC(12,4) | — |
| `total` | NUMERIC(12,4) | — |
| `include_iva` | BOOLEAN | Si aplica IVA (19%) |
| `usd_rate` | NUMERIC(12,4) | Tasa USD/COP al momento de emisión |
| `notes` | TEXT | — |
| `created_at` | TIMESTAMP | — |

### `app_settings`

Singleton — solo hay una fila (se consulta con `LIMIT 1`).

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | INTEGER PK | — |
| `electricity_rate` | NUMERIC(12,4) | USD/kWh |
| `failure_rate_percent` | NUMERIC(8,4) | % de absorción de fallos |
| `labor_cost_per_hour` | NUMERIC(12,4) | USD/hora de trabajo |
| `default_margin_percent` | NUMERIC(8,4) | % de margen por defecto |
| `currency` | VARCHAR(10) | `USD` |
| `spool_low_stock_threshold_g` | NUMERIC(8,1) | Umbral de alerta de bobinas bajas por material, en gramos (issue #134) |

### `electricity_tariffs`

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | INTEGER PK | — |
| `month_label` | VARCHAR(50) | `Enero 2026` |
| `stratum` | INTEGER | 1–6 |
| `rate_cop_kwh` | NUMERIC(12,4) | Tarifa en COP/kWh |
| `rate_usd_kwh` | NUMERIC(12,4) | Tarifa en USD/kWh |
| `multiplier` | NUMERIC(8,4) | Factor COP→USD aplicado |
| `scraped_at` | TIMESTAMP | Cuándo se obtuvo |

### `maintenance_printers`

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | INTEGER PK | — |
| `printer_id` | INTEGER FK → printers | — |

### `maintenance_logs`

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | INTEGER PK | — |
| `printer_id` | INTEGER FK → printers | — |
| `maintenance_type` | VARCHAR(100) | Tipo de mantenimiento |
| `notes` | TEXT | — |
| `performed_at` | TIMESTAMP | Fecha del mantenimiento |
| `cost_usd` | NUMERIC(10,2) | Costo en USD |

### `maintenance_log_items`

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | INTEGER PK | — |
| `log_id` | INTEGER FK → maintenance_logs | — |
| `inventory_item_id` | UUID FK → inventory_items | Ítem usado |
| `quantity` | NUMERIC(12,4) | Cantidad usada (se descuenta del stock) |

### `model_files`

Archivos `.3mf` / `.gcode.3mf` almacenados en MinIO (Vault de modelos).
Cada fila puede tener dos slots: `source_file` (`.3mf` editable) y
`print_file` (`.gcode.3mf` laminado). Al menos uno debe estar presente.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | INTEGER PK | — |
| `uploaded_by` | INTEGER FK → users SET NULL | Usuario que subió el archivo (nullable) |
| `source_file_key` | VARCHAR(500) | Key MinIO del `.3mf` editable (nullable) |
| `source_file_name` | VARCHAR(255) | Nombre original del `.3mf` editable |
| `source_file_size` | BIGINT | Tamaño en bytes del `.3mf` editable |
| `print_file_key` | VARCHAR(500) | Key MinIO del `.gcode.3mf` laminado (nullable) |
| `print_file_name` | VARCHAR(255) | Nombre original del `.gcode.3mf` |
| `print_file_size` | BIGINT | Tamaño en bytes del `.gcode.3mf` |
| `sliced_weight_g` | NUMERIC(10,2) | Gramos de filamento (parseado del `.gcode.3mf`) |
| `sliced_time_seconds` | INTEGER | Tiempo de impresión en segundos |
| `sliced_printer_model` | VARCHAR(100) | Modelo de impresora declarado en el slice |
| `sliced_filament_type` | VARCHAR(50) | Tipo de filamento (PLA/PETG/etc.) |
| `name` | VARCHAR(200) | Nombre de display editable |
| `description` | TEXT | — |
| `thumbnail_url` | VARCHAR(1000) | URL externa de miniatura (MakerWorld/Printables) |
| `thumbnail_key` | VARCHAR(500) | Key MinIO del PNG plate-render extraído del `.3mf` (`thumbnails/{id}.png`). El API expone `local_thumbnail_url` apuntando al proxy `GET /api/vault/{id}/thumbnail` |
| `tags` | JSONB | Array de etiquetas de texto libre |
| `source_url` | VARCHAR(1000) | URL de origen del modelo |
| `source_platform` | VARCHAR(50) | `makerworld` \| `printables` \| `thingiverse` \| `otro` |
| `creator_name` | VARCHAR(200) | Nombre del creador original |
| `creator_url` | VARCHAR(1000) | URL del perfil del creador |
| `created_at` | TIMESTAMP | — |
| `updated_at` | TIMESTAMP | — |

### `print_queue`

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | UUID PK | — |
| `quote_id` | INTEGER FK → quotes SET NULL | — |
| `status` | VARCHAR(20) | `pending` \| `printing` \| `done` \| `cancelled` |
| `position` | INTEGER | Orden en la cola (menor = primero) |
| `printer_id` | INTEGER FK nullable | Impresora asignada |
| `inventory_item_id` | UUID FK nullable | Filamento principal a descontar |
| `weight_grams` | NUMERIC(10,2) | — |
| `print_time_hours` | NUMERIC(10,4) | — |
| `additional_filaments_detail` | JSONB | `[{filament_id, name, weight_grams, material_cost}]` |
| `supplies_detail` | JSONB | `[{supply_id, name, unit, price_per_unit, quantity}]` |
| `notes` | TEXT | — |
| `added_at` | TIMESTAMP | — |
| `started_at` | TIMESTAMP | — |
| `completed_at` | TIMESTAMP | — |
| `failure_reason` | VARCHAR(200) nullable | Motivo de cancelación en texto libre (issue #130) |
| `failure_category` | VARCHAR(30) nullable | Categoría fija del motivo (issue #130) |
| `batch_id` | UUID nullable, indexado | Agrupa items como lote — compartido entre miembros (issue #133) |
| `scheduled_at` | TIMESTAMP nullable | Fecha/hora organizativa — NO dispara nada automático (issue #133) |
| `created_by` | INTEGER FK → users SET NULL, nullable | Usuario que creó el item — NULL en items pre-#131 (issue #131) |
| `spool_id` | INTEGER FK → spools SET NULL, nullable, indexado | Bobina física a consumir — reemplaza el descuento agregado normal (issue #134) |

---

### `spools` (issue #134)

Bobina física individual de filamento, hija de un `InventoryItem` de
categoría Filamento. **Regla de sincronía con el agregado (boundary-only,
en gramos — ver docstring completo en `backend/app/models/spool.py`)**:

- Alta: por defecto NO toca `InventoryItem.quantity` (bobinas creadas para
  trackear stock YA contado). Con `add_to_stock=true`, suma
  `initial_weight_g × count`.
- Consumo (marcar `done` con `spool_id` asignado): descuenta SOLO
  `remaining_weight_g` — el agregado NO se mueve. El descuento agregado
  normal se omite por completo para ese item (evita doble descuento).
- Agotamiento (`remaining_weight_g` llega a 0): `status='finished'` +
  resta `initial_weight_g` (no `remaining_weight_g`) del agregado.
- Insuficiente al consumir: floorea en 0 y devuelve un warning — NO bloquea
  (a diferencia del camino sin bobina, que sí lanza 400).

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | INTEGER PK | — |
| `inventory_item_id` | INTEGER FK → inventory_items CASCADE, indexado | Ítem de inventario padre |
| `label_code` | VARCHAR(12) UNIQUE | Código corto para etiquetas físicas, ej. `SP-0042` — asignado post-flush |
| `initial_weight_g` | NUMERIC(8,1) | Peso al abrir la bobina |
| `remaining_weight_g` | NUMERIC(8,1) | Peso restante actual |
| `cost` | NUMERIC(12,2) nullable | Costo de esta bobina; NULL hereda `price_per_kg` del padre |
| `extra_colors` | JSONB nullable | `{"stops": ["RRGGBB", ...]}` para gradiente/multicolor |
| `visual_effect` | VARCHAR(20) nullable | sparkle\|wood\|marble\|glow\|matte\|silk\|galaxy\|rainbow\|metal\|translucent\|gradient\|dual-color\|tri-color\|multicolor |
| `status` | VARCHAR(12) | `active` \| `finished` \| `archived` |
| `opened_at` | TIMESTAMP nullable | — |
| `finished_at` | TIMESTAMP nullable | Poblado automáticamente al agotarse |
| `notes` | VARCHAR(500) nullable | — |
| `created_at` / `updated_at` | TIMESTAMP | — |

---

## Comandos útiles en PostgreSQL

```sql
-- Ver todas las tablas
\dt

-- Contar registros por tabla
SELECT schemaname, tablename,
       n_live_tup AS rows
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;

-- Ver la versión de Alembic
SELECT * FROM alembic_version;

-- Ver todas las empresas
SELECT id, name FROM companies;

-- Ver usuarios y sus roles
SELECT username, email, role, is_active, created_at
FROM users
ORDER BY created_at;

-- Ver templates de cotización
SELECT id, name, template_type, is_default, length(content) AS content_len
FROM company_templates ORDER BY created_at;

-- Ver stock bajo mínimo
SELECT name, category, quantity, min_quantity
FROM inventory_items
WHERE quantity < min_quantity
ORDER BY (quantity / min_quantity);

-- Ver cola de impresión activa
SELECT id, status, position, notes, added_at
FROM print_queue
WHERE status IN ('pending', 'printing')
ORDER BY position;

-- Ver historial de cotizaciones de cliente
SELECT quote_number, client_name, total, created_at
FROM client_quotes
ORDER BY created_at DESC
LIMIT 10;
```

---

## Borrar todos los usuarios (migración de auth)

Cuando se necesita limpiar usuarios con `hashed_password` local para migrar a OIDC, hay que nullear todas las FK que apuntan a `users.id` primero. Ejecutar **cada statement por separado** (no en un solo `-c`) para evitar rollback en cadena por error en uno.

```bash
source ~/CollectorsForgeENV

# 1. Nullear todas las FKs (cada una separada)
podman exec -e PGPASSWORD="$POSTGRES_PASSWORD" cfs-postgres \
  psql -U "${POSTGRES_USER:-collectorsforge}" -d "${POSTGRES_DB:-collectorsforge}" \
  -c "UPDATE app_settings SET user_id = NULL WHERE user_id IS NOT NULL;"

podman exec -e PGPASSWORD="$POSTGRES_PASSWORD" cfs-postgres \
  psql -U "${POSTGRES_USER:-collectorsforge}" -d "${POSTGRES_DB:-collectorsforge}" \
  -c "UPDATE client_quotes SET user_id = NULL WHERE user_id IS NOT NULL;"

# quotes.user_id puede ser NOT NULL — hacerla nullable primero si es necesario:
# psql -c "ALTER TABLE quotes ALTER COLUMN user_id DROP NOT NULL;"
podman exec -e PGPASSWORD="$POSTGRES_PASSWORD" cfs-postgres \
  psql -U "${POSTGRES_USER:-collectorsforge}" -d "${POSTGRES_DB:-collectorsforge}" \
  -c "UPDATE quotes SET user_id = NULL WHERE user_id IS NOT NULL;"

podman exec -e PGPASSWORD="$POSTGRES_PASSWORD" cfs-postgres \
  psql -U "${POSTGRES_USER:-collectorsforge}" -d "${POSTGRES_DB:-collectorsforge}" \
  -c "UPDATE model_files SET uploaded_by = NULL WHERE uploaded_by IS NOT NULL;"

# 2. Borrar usuarios
podman exec -e PGPASSWORD="$POSTGRES_PASSWORD" cfs-postgres \
  psql -U "${POSTGRES_USER:-collectorsforge}" -d "${POSTGRES_DB:-collectorsforge}" \
  -c "DELETE FROM users;"
```

Para verificar qué tablas tienen FK hacia `users`:
```sql
SELECT tc.table_name, kcu.column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.referential_constraints AS rc ON tc.constraint_name = rc.constraint_name
JOIN information_schema.table_constraints AS ccu ON ccu.constraint_name = rc.unique_constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'users';
```

---

## Notas importantes sobre asyncpg

asyncpg 0.29.0 tiene comportamientos específicos:

1. **`TIMESTAMP WITHOUT TIME ZONE`**: Rechaza `datetime` con `tzinfo`. Siempre usar `.replace(tzinfo=None)`:
   ```python
   from datetime import datetime
   created_at = datetime.utcnow().replace(tzinfo=None)
   ```

2. **`Numeric` → `Decimal`**: asyncpg devuelve columnas `NUMERIC/DECIMAL` como `Decimal` de Python automáticamente. No convertir a float antes de cálculos.

3. **Transacciones y SAVEPOINT**: El `env.py` de Alembic usa `engine.connect()` (no `engine.begin()`) para evitar el problema del SAVEPOINT anidado que dejaba `alembic_version` sin actualizar.
