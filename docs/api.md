# Referencia de API — TurtleForge Studio

Base URL: `https://3d.turtlenode.dev/api` (producción) · `http://localhost:8000/api` (local)

Todos los endpoints protegidos requieren el header:
```
Authorization: Bearer <access_token>
```

La documentación interactiva (Swagger UI) está disponible en `/docs`.

---

## Autenticación

### `POST /auth/login`
Inicia sesión. Devuelve un JWT válido por 24 horas.

**Body** (`application/x-www-form-urlencoded`):
```
username=admin&password=mi-password
```

**Response 200:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

---

### `GET /auth/me`
Devuelve el usuario autenticado actual.

**Response 200:**
```json
{
  "id": "uuid-del-usuario",
  "username": "admin",
  "email": "admin@turtlenode.dev",
  "is_admin": true,
  "company_id": "00000000-0000-0000-0000-000000000001"
}
```

---

### `POST /auth/register`
Registra un nuevo usuario (solo admins pueden hacerlo, según configuración).

**Body:**
```json
{
  "username": "nuevo_usuario",
  "email": "nuevo@email.com",
  "password": "password123"
}
```

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
  "logo_url": "/static/companies/uuid/logo.png",
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
Sube el logo de la empresa.

**Body** (`multipart/form-data`):
```
file: <archivo imagen>
```

**Response 200:**
```json
{
  "logo_url": "/static/companies/uuid/logo.png"
}
```

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
Lista todos los usuarios de la empresa (solo admin).

### `PATCH /users/{id}`
Actualiza un usuario (solo admin). Puede cambiar `is_admin`, `email`, `password`.

### `PUT /users/me`
Actualiza el perfil del usuario autenticado actual.

**Body:**
```json
{
  "email": "nuevo@email.com",
  "password": "nueva-password"
}
```

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
    "notes": "Impresora principal",
    "company_id": "uuid"
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

### `POST /inventory/purchases/scan-tracking`
Lanza escaneo masivo de tracking en el microservicio tracker.

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
Sube una foto de la impresión.

**Body** (`multipart/form-data`): `file: <imagen>`

### `POST /inventory/prints/{id}/sell`
Registra una venta (decrementa el stock).

**Body:** `{"quantity": 1}`

---

## Slicer

### `POST /slicer/upload-gcode`
Sube un archivo `.gcode` o `.3mf` ya laminado para extraer sus metadatos.

**Body** (`multipart/form-data`): `file: <archivo>`

**Response 200:**
```json
{
  "id": "uuid-job",
  "status": "done",
  "weight_grams": 85.3,
  "print_time_hours": 3.47,
  "filament_type": "PLA",
  "layer_height": 0.2,
  "infill_percent": 15
}
```

---

### `POST /slicer/upload-stl`
Envía un STL al microservicio OrcaSlicer para laminarlo.

**Body** (`multipart/form-data`):
```
file: archivo.stl
printer_preset: Bambu Lab P1S 0.4 nozzle
filament_preset: Bambu PLA Basic @BBL X1C
config_preset: 0.20mm Standard @BBL X1C
```

**Response 200:** `SlicingJob` con status `pending` o `processing`. Hacer polling a `GET /slicer/jobs/{id}` hasta que status sea `done`.

---

### `POST /slicer/makerworld`
Obtiene metadatos de un modelo de MakerWorld.

**Body:** `{"url": "https://makerworld.com/models/12345"}`

---

### `GET /slicer/jobs`
Lista los trabajos de laminado de la empresa.

### `GET /slicer/jobs/{id}`
Obtiene el estado de un trabajo específico.

### `DELETE /slicer/jobs/{id}`
Elimina un trabajo del historial.

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

## Health Check

### `GET /api/health`
Verifica que la API está funcionando.

**Response 200:**
```json
{
  "status": "ok",
  "app": "TurtleForge Cost"
}
```

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
