# Referencia de API — Collector's Forge Studio

Base URL: `https://cfs.turtlenode.dev/api` (producción) · `http://localhost:8000/api` (local)

Todos los endpoints protegidos requieren el header:
```
Authorization: Bearer <access_token>
```

La documentación interactiva (Swagger UI) está disponible en `/docs`.

---

## Autenticación OIDC

El login es exclusivamente vía OIDC con PKCE. No hay login con contraseña. El flujo completo:
`GET /auth/oidc/login` → IdP → `GET /auth/oidc/callback` → `/auth/success?token=<JWT>` → frontend guarda token.

---

### `GET /auth/oidc/login`
Inicia el flujo OIDC. Redirige al proveedor de identidad (Authentik).

Genera `state`, `nonce` y `code_verifier` (PKCE S256), los guarda en la sesión del servidor y redirige.

**Response:** `302 Redirect` → Authentik (o proveedor OIDC configurado)

**Errors:**
- `503`: OIDC no configurado en el servidor

---

### `GET /auth/oidc/callback`
Callback del IdP. Intercambia el `code` por tokens, provisiona el usuario (JIT) y emite un JWT local.

**Query params:** `code`, `state` (enviados por el IdP)

**Response:**
- Éxito: `302 Redirect → /auth/success?token=<JWT>`
- Error:  `302 Redirect → /login?error=<código>`

Códigos de error posibles:
- `oidc_callback_failed` — fallo al intercambiar el code
- `missing_sub` — el ID token no contiene claim `sub`
- `provisioning_failed` — error al crear usuario JIT
- `user_inactive` — la cuenta está desactivada

---

### `GET /auth/oidc/logout`
Retorna la URL de logout del IdP. El frontend limpia el token local y redirige a esta URL.

**Response 200:**
```json
{
  "logout_url": "https://auth.turtlenode.dev/application/o/collectorsforge/end-session/?post_logout_redirect_uri=..."
}
```

---

### `GET /auth/me`
Devuelve el usuario autenticado actual.

**Response 200:**
```json
{
  "id": 1,
  "username": "giomar",
  "email": "giomar@turtlenode.dev",
  "is_active": true,
  "role": "admin",
  "created_at": "2026-04-13T10:00:00"
}
```

---

### `POST /auth/logout`
Invalida el token JWT actual (lo agrega a una blacklist en memoria hasta que expire).

**Response:** `204 No Content`

---

## Empresa

### `GET /company/`
Obtiene el perfil de la empresa del usuario autenticado.

**Response 200:**
```json
{
  "id": "uuid",
  "name": "The Collector's Forge",
  "slogan": "Forging Legends, One Piece at a Time.",
  "address": "Medellín, Colombia",
  "phone": "+57 300 000 0000",
  "email": "contacto@empresa.com",
  "nit": "900.000.000-1",
  "logo_url": "/api/company/logo?v=1700000000",
  "pdf_terms": "• Pago del 50% al aprobar la cotización.\n• Saldo antes del envío.",
  "pdf_palette": [
    {"name": "background", "hex": "#1A1A1A"},
    {"name": "gold", "hex": "#D1A054"},
    {"name": "metal", "hex": "#B67E3A"},
    {"name": "forge", "hex": "#A33221"},
    {"name": "text_light", "hex": "#FFFFFF"}
  ]
}
```

---

### `PUT /company/`
Actualiza el perfil de la empresa.

**Body** (todos los campos son opcionales):
```json
{
  "name": "The Collector's Forge",
  "slogan": "Forging Legends, One Piece at a Time.",
  "address": "Medellín, Colombia",
  "phone": "+57 300 000 0000",
  "email": "contacto@empresa.com",
  "nit": "900.000.000-1",
  "pdf_terms": "• Término 1\n• Término 2",
  "pdf_palette": [
    {"name": "background", "hex": "#1A1A1A"},
    {"name": "gold", "hex": "#D1A054"}
  ]
}
```

---

### `POST /company/logo`
Sube el logo de la empresa. El binario se persiste en MinIO bajo la
key `companies/{uuid}.{ext}`.

**Auth:** requiere `role='admin'`.

**Body** (`multipart/form-data`):
```
file: <archivo imagen>   (PNG/JPEG/WebP/GIF, máx. 10 MB)
```

**Response 200:** `CompanyResponse` completo (mismo formato que
`GET /company/`) con `logo_url` apuntando al endpoint proxy.

---

### `GET /company/logo`
Streamea el binario del logo desde MinIO. **Endpoint público** (sin
JWT) — los `<img>` tags del browser no envían el header `Authorization`.

**Response 200:** binario PNG/JPEG/WebP/GIF con
`Cache-Control: public, max-age=86400`. **404** si la empresa no tiene
logo cargado.

---

## Templates de cotización (Liquid)

### `GET /company/templates/`
Lista todos los templates de la empresa.

**Response 200:**
```json
[
  {
    "id": 1,
    "name": "Premium Dark",
    "description": "Diseño oscuro con paleta The Collector's Forge",
    "template_type": "cot",
    "is_default": true,
    "created_at": "2026-02-27T10:00:00",
    "updated_at": null
  }
]
```

---

### `POST /company/templates/`
Crea un nuevo template.

**Body:**
```json
{
  "name": "Mi Template",
  "description": "Descripción opcional",
  "template_type": "cot",
  "content": "<!DOCTYPE html><html>...</html>",
  "is_default": false
}
```

---

### `GET /company/templates/{id}`
Obtiene un template con su contenido completo.

---

### `PUT /company/templates/{id}`
Actualiza un template existente.

---

### `DELETE /company/templates/{id}`
Elimina un template.

---

### `POST /company/templates/{id}/set-default`
Marca este template como el activo para su tipo. Desactiva cualquier otro default del mismo tipo.

---

### `POST /company/templates/validate`
Valida el contenido Liquid de un template. Renderiza con datos de muestra y genera un PDF de preview.

**Body:**
```json
{
  "content": "<!DOCTYPE html>...",
  "template_type": "cot"
}
```

**Response 200:**
```json
{
  "ok": true,
  "errors": [],
  "warnings": ["Variable recomendada ausente: {{ total_fmt }}"],
  "preview_pdf_b64": "JVBERi0xLjQK..."
}
```

Si hay error de sintaxis Liquid:
```json
{
  "ok": false,
  "errors": ["unexpected tag 'endfor', expected 'endif'"],
  "warnings": [],
  "preview_pdf_b64": null
}
```

---

### `GET /company/templates/{id}/preview`
Descarga un PDF de muestra del template guardado.

**Response:** `application/pdf` (binary)

---

### `GET /company/templates/default-template`
Devuelve el contenido del template por defecto del sistema (para usar como punto de partida en el editor).

**Response 200:**
```json
{
  "content": "<!DOCTYPE html>..."
}
```

---

## Usuarios

### `GET /users/`
Lista todos los usuarios del sistema (solo admin).

**Response 200:** array de `UserResponse` (id, username, email, is_active, role, created_at)

---

### `PATCH /users/{id}`
Actualiza el rol de un usuario (solo admin). No se puede quitar el rol de admin propio.

**Body:**
```json
{
  "role": "operator"
}
```

Valores válidos para `role`: `"admin"` | `"operator"` | `"viewer"`

**Response 200:** `UserResponse` actualizado

---

### `PUT /users/me`
Actualiza el perfil del usuario autenticado: username y/o email.

**Body (todos opcionales):**
```json
{
  "username": "nuevo_nombre",
  "email": "nuevo@email.com"
}
```

**Response 200:** `UserResponse` actualizado

---

## Impresoras

### `GET /printers/`
Lista todas las impresoras de la empresa.

**Response 200:**
```json
[
  {
    "id": 1,
    "name": "Mi BambuLab P2S",
    "model": "BambuLab P2S Combo",
    "purchase_price": 799.0,
    "power_consumption_watts": 180.0,
    "estimated_lifespan_hours": 5000.0,
    "current_hours": 0.0,
    "nozzle_price": 8.0,
    "nozzle_lifespan_hours": 500.0,
    "buildplate_price": 35.0,
    "buildplate_lifespan_hours": 2000.0,
    "other_maintenance_per_hour": 0.01,
    "notes": "Impresora principal"
  }
]
```

### `POST /printers/`
Crea una nueva impresora.

### `GET /printers/{id}`
Obtiene una impresora por ID.

### `PUT /printers/{id}`
Actualiza una impresora.

### `DELETE /printers/{id}`
Elimina una impresora.

---

## Configuración

### `GET /settings/`
Obtiene la configuración de la empresa.

**Response 200:**
```json
{
  "id": 1,
  "electricity_rate": 0.105,
  "failure_rate_percent": 5.0,
  "labor_cost_per_hour": 10.0,
  "default_margin_percent": 30.0,
  "currency": "USD"
}
```

### `PUT /settings/`
Actualiza la configuración.

---

### `GET /settings/exchange-rate`
Tasa de cambio USD/COP actual (caché 1 hora, desde open.er-api.com).

**Response 200:**
```json
{
  "market_rate": 4200.50,
  "markup": 1.02,
  "rate_used": 4284.51,
  "source": "open.er-api.com",
  "cached_at": "2026-02-27T10:00:00"
}
```

---

### `GET /settings/electricity-tariff`
Tarifa EPM del mes actual. Si no está en caché, descarga y procesa el PDF de EPM.

**Response 200:**
```json
{
  "available": true,
  "month_label": "Enero 2026",
  "estratos": [
    {"stratum": 1, "rate_cop_kwh": 419.5, "rate_usd_kwh": 0.098},
    {"stratum": 2, "rate_cop_kwh": 488.2, "rate_usd_kwh": 0.114},
    {"stratum": 3, "rate_cop_kwh": 610.3, "rate_usd_kwh": 0.142},
    {"stratum": 4, "rate_cop_kwh": 717.8, "rate_usd_kwh": 0.167},
    {"stratum": 5, "rate_cop_kwh": 817.1, "rate_usd_kwh": 0.190},
    {"stratum": 6, "rate_cop_kwh": 817.1, "rate_usd_kwh": 0.190}
  ],
  "multiplier": 0.000233
}
```

---

### `GET /settings/electricity-tariffs`
Historial completo de tarifas EPM guardadas en DB.

---

## Cotizaciones de costo (internas)

### `POST /quotes/calculate`
Calcula el costo sin guardar. Devuelve el desglose completo.

**Body:**
```json
{
  "piece_name": "Figura personalizada",
  "client_name": "Juan Pérez",
  "inventory_item_id": "uuid-del-filamento",
  "printer_id": 1,
  "weight_grams": 85.5,
  "print_time_hours": 3.5,
  "preparation_time_hours": 0.5,
  "post_processing_time_hours": 0.25,
  "quantity": 2,
  "margin_percent": 35.0,
  "supplies": [
    {"inventory_item_id": "uuid-insumo", "quantity": 4}
  ],
  "additional_filaments": [
    {"inventory_item_id": "uuid-filamento2", "weight_grams": 12.0}
  ]
}
```

**Response 200:**
```json
{
  "material_cost": 2.14,
  "electricity_cost": 0.066,
  "depreciation_cost": 0.049,
  "maintenance_cost": 0.075,
  "labor_cost": 7.50,
  "failure_cost": 0.49,
  "subtotal": 10.84,
  "margin_percent": 35.0,
  "margin_amount": 3.79,
  "total_per_unit": 7.32,
  "quantity": 2,
  "total_price": 14.63,
  "supplies_cost": 0.40,
  "supplies_detail": [
    {"name": "Argolla 25mm", "unit": "unidad", "quantity": 4, "unit_price": 0.10, "subtotal": 0.40}
  ],
  "usd_to_cop_rate": 4284.51,
  "total_per_unit_cop": 31361,
  "total_price_cop": 62722
}
```

---

### `POST /quotes/`
Calcula y guarda la cotización en el historial.

### `GET /quotes/`
Lista el historial de cotizaciones de costo.

### `GET /quotes/{id}`
Obtiene una cotización por ID con desglose completo.

### `GET /quotes/{id}/pdf`
Descarga el PDF de cotización de costo (ReportLab, formato interno TFC-XXXX).

**Response:** `application/pdf`

### `PUT /quotes/{id}`
Actualiza una cotización guardada.

### `DELETE /quotes/{id}`
Elimina una cotización.

---

## Cotizaciones de cliente (COT-XXXX)

### `POST /client-quotes/`
Crea una cotización multi-producto para entregar al cliente.

**Body:**
```json
{
  "client_name": "Juan Pérez",
  "description": "Pedido de figuras para colección",
  "quote_date": "2026-02-27",
  "expiry_days": 30,
  "include_iva": false,
  "notes": "Preferencia de empaque especial",
  "items": [
    {"name": "Figura Darth Vader 15cm", "quantity": 2, "unit_price": 45000},
    {"name": "Soporte para figura",      "quantity": 2, "unit_price": 15000}
  ]
}
```

**Response 201:**
```json
{
  "id": 1,
  "quote_number": "COT-0001",
  "client_name": "Juan Pérez",
  "subtotal": 120000,
  "iva_amount": 0,
  "total": 120000,
  "include_iva": false,
  "usd_rate": 4284.51,
  "created_at": "2026-02-27T10:00:00"
}
```

---

### `GET /client-quotes/`
Lista todas las cotizaciones de cliente de la empresa.

### `GET /client-quotes/{id}`
Obtiene una cotización de cliente por ID.

### `DELETE /client-quotes/{id}`
Elimina una cotización de cliente.

### `GET /client-quotes/{id}/pdf`
Genera y descarga el PDF de la cotización. Si la empresa tiene un template Liquid activo, lo usa. Si no, usa el generador ReportLab por defecto.

**Response:** `application/pdf`

---

## Inventario

### `GET /inventory/items/`
Lista todos los ítems de inventario. Filtros opcionales:

```
GET /inventory/items/?category=Filamento
GET /inventory/items/?needs_reorder=true
```

**Response 200:** array de `InventoryItem`

---

### `POST /inventory/items/`
Crea un ítem de inventario.

**Body:**
```json
{
  "name": "PLA Negro Bambu Lab",
  "category": "Filamento",
  "brand": "Bambu Lab",
  "material_type": "PLA",
  "color": "Negro",
  "unit": "kg",
  "quantity": 2.5,
  "min_quantity": 0.5,
  "price_per_unit": 24.99,
  "location": "Estante A",
  "notes": "Filamento básico para la mayoría de proyectos"
}
```

---

### `PUT /inventory/items/{id}`
Actualiza un ítem de inventario.

### `DELETE /inventory/items/{id}`
Elimina un ítem.

### `PATCH /inventory/items/{id}/flag`
Alterna el flag `needs_reorder` del ítem.

### `PATCH /inventory/items/{id}/adjust`
Ajusta la cantidad de stock.

**Body:** `{"quantity": -0.5}` (negativo para restar, positivo para sumar)

### `GET /inventory/items/export`
Exporta todo el inventario como JSON.

**Response:** `application/json` (blob)

### `POST /inventory/items/import`
Importa inventario desde JSON exportado previamente.

---

## Pedidos de compra

### `GET /inventory/purchases/`
Lista todos los pedidos de compra.

### `POST /inventory/purchases/`
Crea un pedido de compra.

**Body:**
```json
{
  "supplier": "Amazon",
  "order_date": "2026-02-27T10:00:00",
  "total_usd": 89.99,
  "notes": "Filamentos PLA y PETG",
  "items": [
    {"inventory_item_id": "uuid", "quantity": 3.0, "unit_price": 24.99}
  ]
}
```

### `POST /inventory/purchases/{id}/arrive`
Marca un pedido como llegado. Actualiza el stock de todos sus ítems automáticamente.

---

## Impresiones (Printed Items)

### `GET /inventory/prints/`
Lista las impresiones 3D disponibles para venta.

### `POST /inventory/prints/`
Registra una impresión terminada.

### `GET /inventory/prints/{id}`
Obtiene una impresión por ID.

### `PUT /inventory/prints/{id}`
Actualiza datos de una impresión.

### `DELETE /inventory/prints/{id}`
Elimina una impresión del catálogo.

### `POST /inventory/prints/{id}/image`
Sube una foto de la impresión. El binario se persiste en MinIO bajo la
key `prints/{uuid}.{ext}`. La imagen anterior (si la había) se borra
best-effort.

**Auth:** requiere `role='operator'` o superior.

**Body** (`multipart/form-data`): `file: <PNG/JPEG/WebP/GIF, máx. 10 MB>`

**Response 200:** `{"image_url": "/api/inventory/prints/{id}/image?v=..."}`

### `GET /inventory/prints/{id}/image`
Streamea el binario de la imagen desde MinIO. **Endpoint público** (sin
JWT) — los `<img>` tags del browser no envían el header `Authorization`.

**Response 200:** binario con `Cache-Control: public, max-age=86400`.
**404** si el ítem no tiene imagen cargada.

### `POST /inventory/prints/{id}/sell`
Registra una venta (decrementa el stock).

**Body:** `{"quantity": 1}`

---

## Mantenimiento

### `GET /maintenance/summary/`
Resumen del estado de mantenimiento por impresora (para el dashboard).

**Response 200:**
```json
[
  {
    "printer_id": 1,
    "printer_name": "Mi BambuLab P2S",
    "last_maintenance_by_type": {
      "limpieza_nozzle": "2026-02-20T10:00:00",
      "lubricacion_ejes": "2026-01-15T10:00:00"
    },
    "alerts": ["lubricacion_ejes: hace más de 30 días"]
  }
]
```

---

### `GET /maintenance/logs/`
Lista registros de mantenimiento.

**Query params:** `?printer_id=1` para filtrar por impresora.

### `POST /maintenance/logs/`
Crea un registro de mantenimiento. Descuenta automáticamente del inventario los ítems usados.

**Body:**
```json
{
  "printer_id": 1,
  "maintenance_type": "limpieza_nozzle",
  "notes": "Limpieza con filamento de purga",
  "performed_at": "2026-02-27T10:00:00",
  "cost_usd": 0.50,
  "items_used": [
    {"inventory_item_id": "uuid-purga", "quantity": 10}
  ]
}
```

### `GET /maintenance/logs/{id}`
Obtiene un registro por ID.

### `DELETE /maintenance/logs/{id}`
Elimina un registro.

---

## Cola de impresión

### `GET /queue/`
Lista los ítems activos (pending + printing), ordenados por posición.

**Response 200:**
```json
[
  {
    "id": "uuid",
    "status": "printing",
    "position": 1,
    "notes": "Figura cliente Juan",
    "printer": {"id": 1, "name": "Mi BambuLab P2S"},
    "quote": {"id": 5, "piece_name": "Figura Darth Vader"},
    "added_at": "2026-02-27T08:00:00"
  }
]
```

---

### `POST /queue/`
Agrega un ítem a la cola de impresión.

**Body:**
```json
{
  "quote_id": 5,
  "printer_id": 1,
  "notes": "Figura cliente Juan",
  "inventory_item_id": "uuid-filamento",
  "weight_grams": 85.5,
  "print_time_hours": 3.5,
  "additional_filaments_detail": [],
  "supplies_detail": []
}
```

---

### `PUT /queue/{id}/status`
Cambia el estado de un ítem.

**Body:**
```json
{
  "status": "done"
}
```

Al marcar como `done`:
- Se descuenta del inventario el filamento principal (`weight_grams`)
- Se descuenta del inventario los filamentos adicionales
- Se descuenta del inventario los insumos usados
- Se suman `print_time_hours` a `printer.current_hours`

---

### `DELETE /queue/{id}`
Elimina un ítem de la cola (solo si está en estado `pending` o `cancelled`).

### `GET /queue/history`
Lista los últimos 50 ítems completados o cancelados.

---

## Vault de modelos .3mf

Almacenamiento de archivos `.3mf` en MinIO. Todas las operaciones de escritura requieren rol `admin`.

### `GET /vault/`
Lista archivos del Vault con paginación y búsqueda opcional.

**Query params:**
- `q` — substring case-insensitive sobre `name + description + tags` (opcional)
- `print_ready_only` — si `true`, solo retorna modelos con `print_file` presente (usado por el picker de la Cola)
- `page` — página (default 1)
- `page_size` — ítems por página (default 20, max 100)

**Response 200:**
```json
{
  "items": [
    {
      "id": 1,
      "uploaded_by": 1,
      "uploaded_by_username": "giomar",
      "source_file_name": "figura_darth_vader.3mf",
      "source_file_size": 2456789,
      "print_file_name": "figura_darth_vader.gcode.3mf",
      "print_file_size": 8754321,
      "sliced_weight_g": 42.5,
      "sliced_time_seconds": 12600,
      "sliced_printer_model": "Bambu Lab P2S",
      "sliced_filament_type": "PLA",
      "is_print_ready": true,
      "name": "Darth Vader 15cm",
      "description": "Figura articulada con base",
      "thumbnail_url": "https://cdn.makerworld.com/...",
      "local_thumbnail_url": "/api/vault/1/thumbnail?v=1700000000",
      "tags": ["star wars", "figura"],
      "source_url": "https://makerworld.com/models/12345",
      "source_platform": "makerworld",
      "creator_name": "PrintMaster",
      "creator_url": "https://makerworld.com/u/printmaster",
      "created_at": "2026-04-13T10:00:00",
      "updated_at": "2026-04-13T10:00:00"
    }
  ],
  "total": 42,
  "page": 1,
  "page_size": 20
}
```

---

### `GET /vault/{id}/thumbnail`
Streamea el PNG plate-render extraído del `.3mf` (key MinIO
`thumbnails/{id}.png`). **Endpoint público** (sin JWT) — los `<img>`
tags del browser no envían `Authorization`.

**Response 200:** binario PNG con `Cache-Control: public, max-age=86400`.
**404** si el modelo no tiene `thumbnail_key` o el objeto no está en
MinIO — el frontend cae al `thumbnail_url` externo (MakerWorld) o al
placeholder.

---

### `GET /vault/stats`
Uso y cuota de almacenamiento.

**Response 200:**
```json
{
  "used_bytes": 1073741824,
  "quota_bytes": 53687091200,
  "percent": 2.0
}
```

---

### `POST /vault/fetch-metadata`
Extrae metadatos de un modelo desde su URL (MakerWorld, Printables, OpenGraph).

**Body:**
```json
{
  "url": "https://makerworld.com/models/12345"
}
```

**Response 200:** `VaultMetadataResponse` con name, description, thumbnail_url, tags, source_platform, creator_name, creator_url

---

### `POST /vault/upload` (admin)
Sube un archivo `.3mf` con sus metadatos.

**Body** (`multipart/form-data`):
```
file: archivo.3mf
metadata: {"name": "Nombre display", "description": "...", "tags": ["tag1"], "source_url": "...", "source_platform": "makerworld", "creator_name": "...", "thumbnail_url": "..."}
```

Límite: 1 GB. Verifica cuota antes de subir.

**Response 201:** `ModelFileResponse`

**Errors:**
- `400`: El archivo no es `.3mf`
- `413`: Supera el límite de 1 GB
- `507`: Sin espacio disponible (cuota excedida)

---

### `GET /vault/{id}/download/source`
Descarga el slot `source_file` (`.3mf` editable). 404 si el modelo no
tiene ese slot.

### `GET /vault/{id}/download/print`
Descarga el slot `print_file` (`.gcode.3mf` laminado). 404 si el modelo
no tiene ese slot.

**Response:** `application/octet-stream` (el filename se infiere del
header `Content-Disposition`).

---

### `PUT /vault/{id}` (admin)
Actualiza metadatos de un archivo (nombre, descripción, tags, etc.). No reemplaza el archivo.

**Body (todos opcionales):**
```json
{
  "name": "Nuevo nombre",
  "description": "Nueva descripción",
  "tags": ["tag1", "tag2"]
}
```

---

### `POST /vault/{id}/replace/source` (admin)
Reemplaza el slot `source_file` (`.3mf` editable) conservando los
metadatos. Sube nuevo archivo, actualiza DB, borra el anterior de MinIO.

**Body** (`multipart/form-data`): `file: nuevo_archivo.3mf`

### `POST /vault/{id}/replace/print` (admin)
Reemplaza el slot `print_file` (`.gcode.3mf`) y re-parsea los
metadatos sliced (peso, tiempo, filamento, impresora). Re-extrae
también el thumbnail plate-render.

**Body** (`multipart/form-data`): `file: nuevo_archivo.gcode.3mf`

---

### `DELETE /vault/{id}` (admin)
Elimina el archivo de MinIO y el registro en DB.

**Response:** `204 No Content`

---

## Health Check

### `GET /api/health`
Verifica que el proceso de la API está arriba y respondiendo. No toca la
base de datos ni MinIO — siempre responde 200 si el proceso vive, aunque
sus dependencias estén caídas. Útil como liveness check básico, no como
señal de "todo funciona".

**Response 200:**
```json
{
  "status": "ok",
  "app": "Collector's Forge Studio"
}
```

### `GET /api/health/full`
Health check completo — verifica Postgres, MinIO y la versión de Alembic
aplicada. Pensado para monitores externos (Uptime Kuma, etc.) que necesitan
saber si el servicio está *realmente* sano, no solo si el proceso responde.
No requiere autenticación.

**Response 200 (`status: ok`)** — Postgres y MinIO respondieron bien:
```json
{
  "status": "ok",
  "checks": {
    "db": "ok",
    "minio": "ok",
    "alembic": "5f3a2b1c9d0e"
  }
}
```

**Response 503 (`status: degraded`)** — si Postgres o MinIO fallan, el
código HTTP baja a 503 y el campo del check que falló trae
`"error: <NombreDeLaExcepción>"` en vez de `"ok"`:
```json
{
  "status": "degraded",
  "checks": {
    "db": "error: OperationalError",
    "minio": "ok",
    "alembic": "5f3a2b1c9d0e"
  }
}
```

- `db`: `"ok"` o `"error: <ExceptionType>"` — `SELECT 1` contra Postgres.
- `minio`: `"ok"` o `"error: <ExceptionType>"` — `head_bucket` contra el bucket configurado.
- `alembic`: la revisión actual aplicada (string), o `"error: <ExceptionType>"` si no se pudo leer la tabla `alembic_version`.
- `status` es `"degraded"` si `db` o `minio` fallan (`alembic` no baja el status, es informativo).

**Monitoreo con Uptime Kuma:** un monitor HTTP simple a este endpoint
(esperando 200) solo distingue "sano" de "degradado", sin decir cuál
falló. Para alertas que sí indiquen el componente exacto, usar 3 monitores
tipo **Json Query** (Kuma ≥1.21) apuntando todos a `/api/health/full`, cada
uno evaluando `checks.db`, `checks.minio` y `checks.alembic` contra `"ok"`
respectivamente.

---

## Códigos de error comunes

| Código | Significado |
|---|---|
| `400` | Request inválido (ver `detail`) |
| `401` | No autenticado o token expirado |
| `403` | Sin permisos (requiere admin) |
| `404` | Recurso no encontrado |
| `409` | Conflicto (ej: username duplicado) |
| `422` | Error de validación Pydantic |
| `429` | Rate limit excedido (slowapi) |
| `500` | Error interno del servidor |
