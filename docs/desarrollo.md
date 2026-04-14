# Guía de Desarrollo — Collector's Forge Studio

Setup del entorno local, convenciones, tests y flujo de trabajo.

---

## Requisitos previos

| Herramienta | Versión mínima | Notas |
|---|---|---|
| Python | 3.9+ | Se usa 3.11 en producción |
| Node.js | 18+ | 20+ recomendado |
| npm | 8+ | — |
| Git | 2.x | con GPG configurado |
| PostgreSQL | 16 | Solo para tests reales; SQLite sirve para dev |

---

## 1. Setup del backend

### 1.1 Entorno virtual

```bash
cd backend

python3 -m venv venv
source venv/bin/activate          # Linux/Mac
# venv\Scripts\activate           # Windows

pip install -r requirements.txt
```

### 1.2 Variables de entorno (desarrollo)

```bash
cp .env.example .env
```

El `.env.example` tiene valores de plantilla. Para desarrollo local completar al menos:

```env
DATABASE_URL=sqlite+aiosqlite:///./cfs.db
SECRET_KEY=una-clave-secreta-para-dev
SESSION_SECRET_KEY=otra-clave-secreta-para-dev
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
# OIDC — apuntar a tu instancia de Authentik (o cualquier proveedor OIDC)
OIDC_ISSUER=https://auth.tudominio.com/application/o/collectorsforge/
OIDC_CLIENT_ID=<client-id>
OIDC_CLIENT_SECRET=<client-secret>
OIDC_REDIRECT_URI=http://localhost:8000/api/auth/oidc/callback
```

> Para desarrollo local con SQLite no se necesita PostgreSQL.
> Para OIDC en local, registrar `http://localhost:8000/api/auth/oidc/callback` como Redirect URI adicional en Authentik.

### 1.3 Migraciones

```bash
# Aplicar todas las migraciones
alembic upgrade head

# Ver estado actual
alembic current

# Ver historial
alembic history --verbose
```

### 1.4 Arrancar el servidor

```bash
uvicorn app.main:app --reload --port 8000
```

- API: `http://localhost:8000`
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

Al arrancar por primera vez, el lifespan crea automáticamente:
- Empresa singleton "The Collector Forge" (UUID `000...0001`)
- AppSettings con valores por defecto
- Impresora BambuLab P2S Combo

Los usuarios se crean vía JIT provisioning al hacer login OIDC. No hay usuario `admin` predefinido — el primer usuario que inicia sesión recibe rol `admin`. `hashed_password` siempre es NULL.

> **No hay login con contraseña.** El flujo de auth es exclusivamente OIDC. Para desarrollo local, registrar `http://localhost:8000/api/auth/oidc/callback` como Redirect URI adicional en Authentik (o proveedor elegido).

---

## 2. Setup del frontend

```bash
cd frontend

npm install
npm run dev
```

Frontend disponible en `http://localhost:5173`.

El proxy de Vite redirige `/api/*` a `http://localhost:8000` automáticamente (configurado en `vite.config.js`).

### Scripts disponibles

```bash
npm run dev      # Servidor de desarrollo con HMR
npm run build    # Build de producción (genera dist/)
npm run preview  # Preview del build de producción
npm run lint     # ESLint
npm test         # Vitest (tests unitarios del frontend)
```

---

## 3. Ejecutar los tests

### Tests del backend

```bash
cd backend
source venv/bin/activate

# Todos los tests con coverage
python3 -m pytest tests/ -v --cov --cov-report=term-missing

# Test específico
python3 -m pytest tests/test_calculator.py -v

# Con threshold de cobertura (igual que CI)
python3 -m pytest tests/ --cov --cov-fail-under=80
```

**Resultado esperado:** 402 tests, todos PASS, coverage ≥ 80%.

### Tests del frontend

```bash
cd frontend
npm test
```

### Importante sobre los tests

Los tests del backend usan `MagicMock` para simular la base de datos (sin DB real). Esto significa que:

- ✅ El motor de cálculo está completamente testeado
- ✅ Los schemas Pydantic están testeados
- ✅ Los generadores de PDF están testeados
- ⚠️ Los bugs específicos de asyncpg/PostgreSQL **no son detectados por los tests**
- ⚠️ Las migraciones Alembic se testean en CI (con PostgreSQL real), no localmente

Si encontrás un bug que solo aparece en producción pero no en tests, probablemente es un problema de asyncpg (ver la sección de problemas conocidos en MEMORY.md).

---

## 4. Crear una migración de base de datos

Cuando se agrega un campo nuevo a un modelo ORM:

```bash
cd backend
source venv/bin/activate

# 1. Editar el modelo en app/models/
# 2. Generar la migración automáticamente
alembic revision --autogenerate -m "descripcion_del_cambio"

# 3. Revisar el archivo generado en alembic/versions/
# 4. Ajustar manualmente si es necesario (drop column, data migration, etc.)

# 5. Aplicar
alembic upgrade head

# 6. Verificar
alembic current
```

**Convenciones para migraciones:**
- El nombre del archivo es auto-generado por Alembic (hash + descripción)
- La descripción usa `snake_case`
- Siempre revisar el `downgrade()` generado antes de mergear
- Para columnas JSONB, especificar `type_=postgresql.JSONB(astext_type=sa.Text())` manualmente

**Nota sobre asyncpg y `TIMESTAMP WITHOUT TIME ZONE`:**
- asyncpg 0.29.0 rechaza `datetime` con `tzinfo` en columnas sin zona horaria
- Siempre usar `.replace(tzinfo=None)` antes de asignar fechas a modelos
- O usar `DateTime(timezone=True)` en el modelo si querés guardar con zona horaria

---

## 5. Convenciones del código

### Python (backend)

- **Sintaxis de tipos:** `Optional[str]` en lugar de `str | None` (compatibilidad Python 3.9 en Mac dev)
- **Documentación:** docstrings en español en todos los módulos, funciones y clases
- **Imports:** sin imports circulares; los modelos se importan desde `app.models.__init__`
- **Async:** todas las funciones de router y DB son `async def`
- **Decimal:** el motor de cálculo usa exclusivamente `Decimal`; nunca `float` en aritmética
- **Fechas:** siempre `datetime.utcnow().replace(tzinfo=None)` para PostgreSQL

### JavaScript/React (frontend)

- **Documentación:** JSDoc en español en todos los módulos y funciones exportadas
- **Componentes:** funciones arrow exportadas por defecto
- **Estado:** `useState` + `useEffect` + `useCallback`; no Redux
- **API calls:** siempre a través de `src/services/api.js` (nunca `fetch` directo)
- **Errores:** `toast.error(apiErrorMsg(err, 'Mensaje por defecto'))` para errores de API
- **Formularios sucios:** registrar con `DirtyStateContext` antes de navegar

### CSS / TailwindCSS

El proyecto usa clases custom con prefijo `tf-*` definidas en `index.css`:

| Clase | Uso |
|---|---|
| `tf-card` | Tarjeta/panel con fondo oscuro y borde |
| `tf-input` | Input de formulario |
| `tf-btn-primary` | Botón principal |
| `tf-btn-secondary` | Botón secundario |
| `tf-page-title` | Título de página H2 |
| `tf-table` | Tabla de datos |
| `tf-badge-*` | Badges de estado |

Colores principales del tema:
- `forge-black` (`#0d1014`) — fondo principal
- `tech-white` (`#F2F4F6`) — texto principal
- `steel` (`#8A8F96`) — texto secundario
- `gunmetal` (`#4B4F55`) — texto terciario
- `accent-green` (`#3FAF4C`) — acento Cost

---

## 6. Agregar una nueva app

Para agregar una nueva sección al Studio:

### 6.1 Registrar la app en `apps.js`

```js
// frontend/src/config/apps.js
{
  id: 'mi-app',
  name: 'Mi App',
  shortDescription: 'Descripción corta',
  description: 'Descripción completa para StudioHomePage',
  icon: AlgunIcono,        // de lucide-react
  route: '/mi-app/',
  color: '#HEX',
  badge: null,
}
```

### 6.2 Crear el Layout

```bash
# Copiar un layout existente como base
cp frontend/src/components/QueueLayout.jsx frontend/src/components/MiAppLayout.jsx
# Ajustar navItems, APP_COLOR y título
```

### 6.3 Crear las páginas

```bash
mkdir -p frontend/src/pages/mi-app/
# Crear MiAppPage.jsx, etc.
```

### 6.4 Registrar rutas en `App.jsx`

```jsx
// En AppRoutes():
import MiAppLayout from './components/MiAppLayout';
import MiAppPage from './pages/mi-app/MiAppPage';

// En el return:
<Route path="/mi-app" element={<PrivateRoute><MiAppLayout /></PrivateRoute>}>
  <Route index element={<MiAppPage />} />
</Route>
```

### 6.5 Backend

```bash
# Crear modelo, schema y router
backend/app/models/mi_entidad.py
backend/app/schemas/mi_entidad.py
backend/app/routers/mi_entidad.py

# Registrar en main.py
app.include_router(mi_entidad_router)

# Crear migración
alembic revision --autogenerate -m "add_mi_entidad"
alembic upgrade head
```

### 6.6 Actualizar `alembic/env.py`

Agregar el nuevo modelo a los imports para que Alembic lo detecte:

```python
from app.models import (
    ...,
    MiEntidad,  # noqa: F401
)
```

---

## 7. Flujo de trabajo Git

```bash
# Trabajo en rama feature (opcional, el repo usa main directamente)
git checkout -b feature/nombre-de-feature

# Código, tests, ...

# Verificar tests antes del commit
cd backend && python3 -m pytest tests/ -q

# Commit con GPG signing (configurado globalmente)
git add archivo1.py archivo2.jsx
git commit -m "feat(scope): descripción del cambio"

# Si la caché GPG expiró:
echo "test" | gpg --sign > /dev/null
# Introducir passphrase en el prompt

# Push
git push origin feature/nombre-de-feature
# o directamente a main si tienes permisos
git push origin main
```

### Convención de commits (Conventional Commits)

```
tipo(scope): descripción corta

Tipos: feat, fix, refactor, docs, test, chore
Scopes: calc, pdf, templates, inventory, queue, maintenance, company, auth, infra
```

Ejemplos:
```
feat(templates): rediseño premium del template de cotización Liquid
fix(maintenance): corregir limpieza de placa PEI
docs(api): agregar referencia de endpoints de queue
```

---

## 8. Estructura de una respuesta API

Todas las respuestas siguen el schema Pydantic del router correspondiente. Los errores siguen el formato de FastAPI:

```json
// Error 422 Validation Error
{
  "detail": [
    {
      "type": "missing",
      "loc": ["body", "nombre_campo"],
      "msg": "Field required",
      "input": {}
    }
  ]
}

// Error 400/404/409
{
  "detail": "Mensaje descriptivo del error"
}
```

En el frontend, `apiErrorMsg(err, fallback)` extrae el primer mensaje de error de estas estructuras:

```js
// utils/apiError.js
import { apiErrorMsg } from '../../utils/apiError';
toast.error(apiErrorMsg(err, 'Error al guardar'));
```

---

## 9. Depuración

### Ver SQL generado por SQLAlchemy

En `database.py`, cambiar `echo=False` a `echo=True` temporalmente:
```python
engine = create_async_engine(settings.DATABASE_URL, echo=True)
```

### Probar un endpoint directamente

El login es exclusivamente vía OIDC. Para obtener un token en desarrollo:
1. Arrancar el backend con las variables OIDC configuradas para localhost
2. Abrir `http://localhost:5173` en el navegador (el frontend auto-redirige al IdP)
3. Completar el login en Authentik
4. Copiar el token de `localStorage`:

```js
// En la consola del navegador (después de hacer login)
localStorage.getItem('token')
```

```bash
# Usar el token copiado
TOKEN="eyJ..."

# Llamar endpoint
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/company/ | python3 -m json.tool
```

Alternativamente, usar Swagger UI en `http://localhost:8000/docs` → Authorize → Bearer `<token>`.

### Frontend: ver estado de autenticación

```js
// En la consola del navegador
localStorage.getItem('token')
JSON.parse(atob(localStorage.getItem('token').split('.')[1]))
```

### Swagger UI

`http://localhost:8000/docs` → Authorize → Bearer `<token>`

Permite probar todos los endpoints interactivamente.
