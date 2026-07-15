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
  "currency": "USD",
  "spool_low_stock_threshold_g": 200.0,
  "smtp_host": null,
  "smtp_port": null,
  "smtp_user": null,
  "smtp_password": null,
  "smtp_from": null,
  "smtp_tls": true,
  "quiet_hours_start": null,
  "quiet_hours_end": null,
  "digest_hour": null
}
```

Campos `smtp_*` / `quiet_hours_*` / `digest_hour` son de notificaciones
(issue #137, ver sección dedicada abajo) — un solo servidor SMTP y un solo
rango de quiet hours para todo el estudio, no por canal.

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

## Bobinas individuales (Spools, issue #134)

Tracking por-bobina física: peso restante, costo, colores/efectos
visuales. Ver `docs/base-de-datos.md#spools-issue-134` para la regla
completa de sincronía con el agregado (`InventoryItem.quantity`).

### `GET /inventory/spools/`
Lista bobinas con datos del ítem padre embebidos.

**Query params** (todos opcionales): `inventory_item_id`, `status` (CSV,
ej. `active,finished`), `material`, `q`.

### `POST /inventory/spools/`
Alta masiva (1-100 bobinas idénticas).

**Body:**
```json
{
  "inventory_item_id": 5,
  "count": 5,
  "initial_weight_g": 1000,
  "cost": 25.50,
  "visual_effect": "sparkle",
  "extra_colors": { "stops": ["ff0000", "00ff00"] },
  "add_to_stock": false
}
```
`add_to_stock`: si `true`, suma `initial_weight_g × count` al agregado
del padre (compra nueva). Default `false` (bobinas para stock ya contado).

### `PUT /inventory/spools/{id}`
Edita una bobina — peso restante manual ("pesé la bobina"), stops,
efecto, notas o status. NO toca el agregado del padre.

### `DELETE /inventory/spools/{id}`
(admin) Elimina una bobina — bloqueado si algún ítem de la cola
`printing` la referencia.

### `GET /inventory/spools/low-stock`
Gramos restantes de bobinas activas por `filament_type` vs. el umbral
configurado (`AppSettings.spool_low_stock_threshold_g`).

**Response 200:**
```json
[
  { "filament_type": "PLA", "total_remaining_g": 150.0, "threshold_g": 200.0, "below": true }
]
```

### `spool_id` en `POST /queue/from-vault`
Si se setea, el consumo al marcar `done` va SOLO a esa bobina — reemplaza
el descuento agregado normal. Debe pertenecer al mismo `inventory_item_id`
que `filament_id` (si ambos vienen); si solo viene `spool_id`,
`filament_id` se deriva automáticamente.

### `POST /inventory/spools/labels` (issue #135)
Genera un PDF de etiquetas con QR (deep-link a `/inventory/spools?spool=<id>`)
para las bobinas pedidas. Adaptado de bambuddy
(`backend/app/services/label_renderer.py`, AGPL-3.0) — 6 plantillas reales
(no las 4 del README viejo de bambuddy, corregidas en su issue #1426):
`ams_holder_74x33`, `ams_holder_75x55`, `box_40x30`, `box_62x29`,
`avery_5160` (US Letter, 30/hoja), `avery_l7160` (A4, 21/hoja).

**Body:**
```json
{
  "spool_ids": [1, 2, 3],
  "template": "avery_l7160",
  "monochrome": false
}
```
`monochrome`: quita el swatch de color (impresoras térmicas B/N) y
ensancha la columna de texto. El orden de `spool_ids` se preserva en el
PDF (una hoja Avery coincide con el orden elegido en pantalla).

**Response:** `application/pdf`, `Content-Disposition: inline`, 404 si
algún id no existe (lista los faltantes en el detail).

El deep-link usa `PUBLIC_URL` (`.env`) si está configurado — necesario en
prod porque `request.url` cae detrás del Cloudflare Tunnel y puede
resolver a una dirección interna; sin `PUBLIC_URL`, usa
`request.url.scheme://request.url.netloc` (suficiente en dev).

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

## Recordatorios de mantenimiento (Schedules, issue #138)

Recordatorio recurrente por impresora, por horas de impresión o por días.
El progreso (`progress_pct`) y `status` (`ok` | `due_soon` ≥80% | `overdue`
≥100%) se calculan en cada response, no se persisten.

### `GET /maintenance/schedules/`
Lista recordatorios con progreso calculado. **Query params:** `?printer_id=1` (opcional).

### `GET /maintenance/schedules/due`
Lista global de recordatorios habilitados con `status != 'ok'` (para badges de sidebar/home).

**Response 200:**
```json
[
  {
    "id": 1,
    "printer_id": 1,
    "printer_name": "P2S del estudio",
    "task_name": "Lubricar ejes XY",
    "description": null,
    "interval_type": "print_hours",
    "interval_value": 300,
    "last_done_at": "2026-01-01T00:00:00",
    "last_done_hours": 0,
    "enabled": true,
    "created_at": "2026-01-01T00:00:00",
    "updated_at": "2026-01-01T00:00:00",
    "progress_pct": 83.3,
    "status": "due_soon"
  }
]
```

### `POST /maintenance/schedules/` (admin)
Crea un recordatorio. Baseline: `last_done_at`/`last_done_hours` se fijan
al momento de creación (progreso arranca en 0%).

**Body:**
```json
{
  "printer_id": 1,
  "task_name": "Lubricar ejes XY",
  "description": null,
  "interval_type": "print_hours",
  "interval_value": 300
}
```

### `PUT /maintenance/schedules/{id}` (admin)
Edita campos del recordatorio (no reasigna la impresora). Todos los campos son opcionales.

### `DELETE /maintenance/schedules/{id}` (admin)
Elimina un recordatorio.

### `POST /maintenance/schedules/{id}/complete`
Marca el recordatorio como hecho: resetea `last_done_at`/`last_done_hours`
al estado actual de la impresora y crea un `MaintenanceLog` automático
(`maintenance_type=task_name`, sin ítems) para no perder trazabilidad.

### Integración con `POST /maintenance/logs/`

El body de `POST /maintenance/logs/` acepta `schedule_ids: [int]` opcional.
Además, cualquier schedule habilitado de esa impresora cuyo `task_name`
coincida (case-insensitive) con `maintenance_type` se resetea
automáticamente en la misma transacción. La response incluye
`matched_schedules: [int]` con los ids efectivamente reseteados.

---

## Stats — analytics de impresión y costos (issue #132)

Agregación de solo-lectura sobre `PrintQueueItem` (status `done`/`cancelled`).
Replica exactamente la lógica de descuento de `_deduct_inventory_and_update_printer`
/ `_deduct_vault_item` (routers/queue.py) para que "gramos consumidos" coincida
con lo que de verdad se descontó del inventario (no con `Quote.material_cost`,
que es el costo de un solo plato, sin multiplicar por `quantity`).

**Query params comunes:** `date_from`/`date_to` en formato `YYYY-MM-DD` (día
calendario en América/Bogotá, mismo criterio que `/queue/log` de #131). Sin
rango, se agregan TODOS los items done/cancelled históricos.

### `GET /stats/overview`
Resumen agregado: tasa de éxito, horas totales, gramos/costo por tipo de
filamento, desglose por impresora y por usuario, fallos por categoría,
costo de material y de electricidad. Acepta `?format=csv`.

**Response 200:**
```json
{
  "prints_done": 42,
  "prints_cancelled": 5,
  "success_rate_pct": 89.36,
  "total_hours": 210.5,
  "grams_by_filament_type": [
    {"filament_type": "PLA", "grams": 4200.0, "cost_cop": 84000.0}
  ],
  "by_printer": [
    {"printer_id": 1, "printer_name": "P2S del estudio", "prints": 30, "hours": 150.0}
  ],
  "by_user": [
    {"user_id": 1, "username": "giomar", "prints": 42}
  ],
  "failure_breakdown": [
    {"category": "warping", "count": 3}
  ],
  "material_cost_cop": 84000.0,
  "electricity_cost_cop": 12000.0
}
```

### `GET /stats/trends?bucket=day|week|month`
Serie temporal de prints y gramos, agrupada por bucket (bucketing en
zona horaria América/Bogotá). Acepta `?format=csv`.

**Response 200:**
```json
{
  "bucket": "day",
  "series": [
    {"bucket_start": "2026-01-15", "prints_done": 3, "prints_cancelled": 1, "grams": 350.0}
  ]
}
```

Auth: `get_current_user` (lectura para todos los roles).

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

### Queue avanzada (issue #133)

#### `PUT /queue/reorder`
Reordena la cola de `pending` por drag-and-drop. `item_ids` debe ser la lista
COMPLETA de ids `pending` actuales, en el nuevo orden — se valida que sea
exactamente el mismo conjunto antes de aplicar ningún cambio.

**Body:**
```json
{ "item_ids": [3, 1, 2] }
```

#### `POST /queue/batch`
Agrupa ≥2 ítems `pending` como lote — asigna un `batch_id` (UUID) nuevo y
compartido a todos.

**Body:**
```json
{ "item_ids": [1, 2, 3] }
```

#### `DELETE /queue/batch/{batch_id}`
Desagrupa un lote — pone `batch_id=NULL` a todos sus miembros.

#### `POST /queue/{id}/duplicate`
Clona un ítem de la cola (de cualquier estado) como uno nuevo `pending` al
final de la cola.

#### `PUT /queue/{id}/schedule`
Programa (o quita programación de, con `scheduled_at: null`) un ítem.
Puramente organizativo — no dispara nada automático.

**Body:**
```json
{ "scheduled_at": "2026-08-01T10:00:00" }
```

#### `split_copies` en `POST /queue/from-vault`
Si `split_copies: true` y `quantity > 1`, crea `quantity` items
independientes (`quantity=1` cada uno) con un `batch_id` compartido, en vez
de un solo item con `quantity=N` — permite repartir las copias entre
impresoras/horarios distintos.

### Print Log (issue #131)

#### `GET /queue/log`
Bitácora global de impresiones — TODOS los estados (a diferencia de
`/queue/history`, que solo trae `done`/`cancelled` sin filtros). Ordenado
por `created_at` descendente.

**Query params** (todos opcionales):
```
?q=&printer_id=&status=&user_id=&date_from=&date_to=&page=&page_size=&format=
```
- `q`: busca en el nombre de la pieza (ILIKE, cubre items de Quote y de Vault).
- `status`: CSV de estados, ej. `done,cancelled`.
- `date_from`/`date_to`: `YYYY-MM-DD`, día calendario América/Bogotá (ambos límites inclusive), comparado contra `created_at`.
- `page`/`page_size` (default 1/25): ignorados si `format=csv`.
- `format=csv`: descarga el set filtrado COMPLETO (sin paginar) como `text/csv`.

**Response 200 (sin `format=csv`):**
```json
{
  "items": [ /* mismo shape que GET /queue/ */ ],
  "total": 137,
  "page": 1,
  "page_size": 25
}
```

Cada item incluye `created_by` (id) y `created_by_username` — el usuario
que creó el item (`POST /queue/` o `POST /queue/from-vault`). `null` en
items anteriores a esta migración o si el usuario fue borrado después.

---

## Proyectos (issue #136)

Agrupador organizativo de ítems de la cola (`print_queue.project_id`) — no
afecta costos ni inventario. Implementado en 3 sub-tickets: metadata
(cover, color, link externo, cotización vinculada), vínculo a archivos
de Vault, y export/import ZIP.

### `GET /projects/`
Lista proyectos con conteo de items de cola por estado + `client_quote_code`/
`client_quote_client_name` si `client_quote_id` resuelve a una cotización real.

### `POST /projects/` (operator)
**Body:**
```json
{
  "name": "Encargo boda Ana & Luis",
  "client_name": "Ana Gómez",
  "color": "#F59E0B",
  "external_url": "https://makerworld.com/models/123",
  "client_quote_id": 7,
  "notes": null
}
```
404 si `client_quote_id` no existe. `color` debe ser `#RRGGBB` (422 si no).

### `GET /projects/{id}` · `PUT /projects/{id}` (operator) · `DELETE /projects/{id}` (operator)
Mismos campos que `POST`, todos opcionales en `PUT`. `DELETE` no borra
los items de cola, solo los desagrupa (`project_id=NULL`).

### `GET /projects/{id}/items`
Lista los ítems de cola (cualquier estado) asociados al proyecto.

### `POST /projects/{id}/cover` (admin)
Sube/reemplaza la foto de portada — multipart, un solo archivo por
proyecto (a diferencia de las fotos de modelo de #130, que son una
colección). Máx. 10 MB, `image/jpeg`/`png`/`webp`.

### `GET /projects/{id}/cover`
Proxy público de la foto de portada (sin JWT — los `<img>` no mandan
`Authorization`, mismo criterio que el thumbnail de Vault). 404 si el
proyecto no tiene portada.

### `GET /projects/{id}/files` (issue #136, sub-ticket 2/3)
Archivos de Vault vinculados al proyecto — vista mínima read-only
(`id`, `name`, `local_thumbnail_url`, `is_print_ready`). No reusa
`ModelFileResponse` de Vault (ese schema carga metadata sliced/tags/
print_count que este detalle no necesita).

### `POST /projects/{id}/files` (operator)
Añade archivos al puente `project_model_files` — **idempotente** (si un
id ya estaba vinculado, se ignora sin error).

**Body:**
```json
{ "model_file_ids": [10, 11, 12] }
```
404 con los ids que no existen en Vault, listados en el detail.

### `DELETE /projects/{id}/files/{model_file_id}` (operator)
Quita un archivo del puente. No borra el `ModelFile` de Vault.

### `GET /projects/{id}/export` (issue #136, sub-ticket 3/3)
Exporta el proyecto a un ZIP: `manifest.json` (metadata del proyecto +
de cada archivo vinculado, incluyendo tags) + los binarios de MinIO bajo
`files/<idx>/source_<nombre>` / `files/<idx>/print_<nombre>`. NO exporta
`cover_photo_key` ni `client_quote_id` (datos locales de esta instancia).
Si un archivo ya no está en MinIO, se omite del ZIP sin bloquear el resto.

**Formato del manifest (version 1):**
```json
{
  "version": 1,
  "project": { "name": "...", "description": "...", "color": "#F59E0B", "external_url": "..." },
  "files": [
    { "name": "...", "description": null, "notes": null, "tags": ["Halloween"],
      "source_file_name": "calabaza.3mf", "print_file_name": null }
  ]
}
```

### `POST /projects/import` (admin)
Recrea un proyecto desde un ZIP exportado con `GET /{id}/export` — multipart,
límite 2 GB. Si ya existe un proyecto con el mismo nombre, el importado se
crea con sufijo " (importado)" (nunca sobreescribe). Los archivos se
re-suben a MinIO con keys nuevas. 400 si el ZIP es inválido, falta
`manifest.json`, o la versión no es soportada; 507 si excede la cuota
configurada del Vault (`VAULT_QUOTA_GB`).

---

## Notificaciones (issue #137)

Sistema multi-canal de avisos (Telegram, Discord, ntfy, email, webhook)
para eventos de negocio. Todo el módulo es admin-only. El dispatcher
(`app/services/notifier.py`) es fire-and-forget (`asyncio.create_task`) —
un evento nunca bloquea ni puede reventar la request que lo originó.

**Matriz de eventos**: `queue.item_done`, `queue.item_cancelled`,
`inventory.low_stock`, `inventory.spool_low`, `maintenance.due`,
`purchase_order.status_changed`, `client_quote.created`.

### `GET /notifications/events`
Lista la matriz de eventos disponibles (array de strings).

### `GET /notifications/channels`
Lista todos los canales configurados.

### `POST /notifications/channels`
Crea un canal. `config` se valida según `type` (schemas discriminados:
`TelegramConfig{bot_token,chat_id}`, `DiscordConfig{webhook_url}`,
`NtfyConfig{server,topic,priority?,token?}`,
`EmailChannelConfig{recipients:[]}`, `WebhookConfig{url,secret?}`).

**Request:**
```json
{
  "type": "ntfy",
  "name": "Avisos del taller",
  "config": {"server": "https://ntfy.sh", "topic": "cfs-estudio"},
  "enabled": true,
  "events": ["queue.item_done", "inventory.low_stock"],
  "defer_to_digest": false
}
```

### `PUT /notifications/channels/{id}`
Actualización parcial (`exclude_unset`).

### `DELETE /notifications/channels/{id}`
204 sin contenido.

### `POST /notifications/channels/{id}/test`
Envía un mensaje de prueba real de forma síncrona.

**Response 200:** `{"ok": true, "error": null}` — `ok: false` con `error`
poblado si el provider falló (nunca lanza 4xx/5xx por fallo del canal).

### `GET /notifications/templates/{event}`
Template Liquid del evento. Si no hay uno personalizado, retorna el
default hardcoded con `is_default: true`.

### `PUT /notifications/templates/{event}`
Guarda un template personalizado. 400 si la sintaxis Liquid es inválida o
falla al renderizar contra el payload de muestra del evento.

### `POST /notifications/templates/{event}/preview`
`{"body": "..."}` → `{"ok": bool, "rendered": str|null, "error": str|null}`
— renderiza contra datos dummy del evento sin guardar.

**Quiet hours + digest**: configurados en `AppSettings` (`quiet_hours_start`,
`quiet_hours_end`, `digest_hour`, ver sección Configuración). Un evento que
cae en quiet hours se descarta, salvo que el canal tenga
`defer_to_digest: true` — en ese caso se encola en
`notification_digest_queue` y se envía agrupado a la hora de `digest_hour`
(America/Bogota).

---

## MakerWorld / Bambu Cloud (issue #139)

Import completo de modelos de MakerWorld al Vault (descarga el `.3mf` real,
no solo metadata — a diferencia de `POST /vault/fetch-metadata` que ya
existía). Requiere login con una cuenta de Bambu Lab. Adaptado de
bambuddy (AGPL-3.0) — solo interoperabilidad, sin afiliación con
MakerWorld/Bambu Lab.

**Instancia vs. plate**: cada instancia de MakerWorld es un perfil de
impresión distinto para el mismo diseño (no un plate dentro de un mismo
`.3mf`). Importar una instancia descarga SU `.3mf` propio; "importar
todas" crea un `ModelFile` por instancia.

`resolve`/`recent`/`thumbnail` funcionan para cualquier usuario
autenticado (metadata pública de MakerWorld). `import`/`import-all`/
`auth/*` requieren admin. `thumbnail` es deliberadamente **público sin
auth** — un `<img>` no puede mandar el header Authorization (mismo
criterio que el proxy de portada de proyectos, #136); SSRF guard con
allowlist de host del CDN de MakerWorld.

### `GET /makerworld/auth/status`
`{configured, email_masked, expires_at}`.

### `POST /makerworld/auth/login`
`{email, password}` → `{status: "ok"|"verify_code"|"tfa", message, tfa_key?}`.
Bambu Cloud puede exigir un código por email o TOTP según la cuenta.

### `POST /makerworld/auth/verify`
`{code, tfa_key?}` — completa el login iniciado en `/auth/login`. Sin
`tfa_key` se asume verificación por código de email.

### `DELETE /makerworld/auth`
Cierra sesión (borra tokens). 204.

### `POST /makerworld/resolve`
`{url}` → `{design_id, title, author, images: [], instances: [{id,
profile_id, title, thumbnail}], already_imported_model_ids: []}`.
Funciona sin credenciales (metadata pública de MakerWorld).

### `POST /makerworld/import`
`{design_id, profile_id?, folder_id?}` → `ModelFileResponse`-like con
`was_existing`. Si `profile_id` se omite, usa la primera instancia
disponible. Dedupe por `source_url` canónico
(`https://makerworld.com/models/{id}#profileId-{n}`) — reimportar la
misma instancia retorna el archivo existente sin volver a descargar.
409 si no hay credenciales configuradas.

### `POST /makerworld/import-all`
`{design_id, folder_id?}` → `{imported: [], failed: []}`. Descarga TODAS
las instancias del diseño, secuencialmente, con rate limit (semáforo 2
concurrentes + 1s entre descargas — cortesía con la API de Bambu).

### `GET /makerworld/recent?limit=10`
Últimos imports (máx 50), más reciente primero.

### `GET /makerworld/thumbnail?url=`
Proxy de imagen del CDN de MakerWorld (`makerworld.bblmw.com` /
`public-cdn.bblmw.com`) — evita hotlink directo (CSP `img-src`).

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

## System Info (issue #140, pieza C)

Todo el módulo es admin-only. Consultas de solo lectura al catálogo de
PostgreSQL (`pg_database_size`, `pg_stat_user_tables`) — sin parámetros de
usuario en el SQL crudo.

### `GET /system/info`
```json
{
  "version": "a1b2c3d4e5f6",
  "uptime_seconds": 12345.6,
  "db": {
    "size_pretty": "145 MB",
    "top_tables": [{"name": "print_queue", "size_pretty": "12.3 MB", "size_bytes": 12894720}]
  },
  "minio": {"used_bytes": 524288000},
  "counts": {"model_files": 42, "queue_items_done": 310, "client_quotes": 58, "spools": 15},
  "migrations": {"current": "d4e5f6a7b8c0", "head": "d4e5f6a7b8c0", "up_to_date": true}
}
```
`version` = SHA del commit embebido en el build (`ARG GIT_SHA` en el
Containerfile, inyectado por CI vía `--build-arg`) — `"dev"` si no está
seteado (build local sin el arg).

### `GET /system/logs?level=&limit=200`
Snapshot del buffer de log en memoria (`collections.deque(maxlen=500)`,
registrado como `logging.Handler` en el lifespan) — sin streaming, refresh
manual desde la UI. `level` filtra por severidad mínima (`WARNING` incluye
`WARNING`/`ERROR`/`CRITICAL`). `limit` clamped a `[1, 500]`.

```json
[{"ts": "2026-07-15T10:00:00+00:00", "level": "ERROR", "logger": "app.routers.queue", "msg": "..."}]
```

### `GET /system/backup` (issue #140, pieza E — recortada)
Descarga un dump de la BD (`pg_dump -Fc`, restaurable con `pg_restore`)
streameado como `application/octet-stream`, filename
`cfs-backup-YYYYMMDD-HHMM.dump`. **Solo descarga on-demand** — sin restore
ni schedule desde la UI (`docs/despliegue.md` ya documenta backup
programado por cron + restore por CLI; duplicar eso en la UI agregaría
superficie de riesgo sin sumar nada). DSN derivado de
`settings.DATABASE_URL` quitando el driver `+asyncpg` (`pg_dump` usa
libpq, no entiende el driver de SQLAlchemy).

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
