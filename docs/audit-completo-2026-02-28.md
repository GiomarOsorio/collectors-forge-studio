# Auditoría Completa — Collector's Forge Studio

**Fecha:** 2026-02-28
**Alcance:** Backend FastAPI, Frontend React, Infraestructura Podman/Cloudflare
**Tipo:** Auditoría autorizada — codebase propio

Dos agentes corrieron en paralelo: uno de **seguridad** (exploits, vulnerabilidades, OWASP) y uno de **calidad de código** (bugs, rendimiento, deuda técnica). Este documento consolida los 72 hallazgos totales.

---

## Tabla Resumen

| Severidad  | Seguridad | Calidad | **Total** |
|------------|-----------|---------|-----------|
| CRÍTICO    | 3         | 5       | **8**     |
| ALTO       | 11        | 7       | **18**    |
| MEDIO      | 17        | 10      | **27**    |
| BAJO       | 7         | 10      | **17**    |
| INFO       | 2         | 0       | **2**     |
| **Total**  | **40**    | **32**  | **72**    |

---

## TOP 10 PRIORIDADES INMEDIATAS

| # | ID | Título | Por qué es urgente |
|---|----|--------|--------------------|
| 1 | SEC-A01+A02 | Secretos por defecto + .env en repo | Cualquiera con el repo puede forjar tokens JWT |
| 2 | SEC-C01+J01 | WeasyPrint LFI/SSRF via templates | Admin puede leer /app/.env, /etc/passwd |
| 3 | CAL-C02 | PDF bloquea el event loop | 1 descarga de PDF congela el servidor para todos |
| 4 | SEC-I01+I02 | Race conditions en inventario | Stock se corrompe con 2 usuarios concurrentes |
| 5 | CAL-M04 | Ruta /default-template inalcanzable | Bug de funcionalidad — el endpoint nunca responde |
| 6 | SEC-B02+E01 | Swagger UI expuesto sin auth | Mapa completo de la API para atacantes |
| 7 | SEC-A03+A04 | JWT sin revocación + localStorage | Token robado = 24h de acceso sin poder bloquearlo |
| 8 | CAL-C01 | Race condition en posición de cola | Dos items pueden tener la misma posición |
| 9 | SEC-G01 | python-jose abandonado (CVE-2024-33664) | Librería sin mantenimiento, migrar a PyJWT |
| 10 | CAL-C04 | Excepción WeasyPrint silenciada | Template roto en producción es invisible |

---

## PARTE 1 — AUDITORÍA DE SEGURIDAD

---

### A — Autenticación y Sesiones

---

```
[CRÍTICO] SEC-A01 — Secretos por defecto en podman-compose.yml
Archivo: podman-compose.yml:32-36
Descripción: Valores por defecto inseguros para SECRET_KEY, ADMIN_PASSWORD y
  POSTGRES_PASSWORD usando la sintaxis ${VAR:-default}. Si se despliega sin
  un archivo .env, el sistema arranca con credenciales conocidas públicamente.
Impacto: Un atacante que conozca el repo puede firmar tokens JWT arbitrarios,
  autenticarse como admin y acceder a PostgreSQL directamente.
Evidencia:
  SECRET_KEY=${SECRET_KEY:-cambiar-esta-clave-en-produccion-xyz789}
  ADMIN_PASSWORD=${ADMIN_PASSWORD:-admin123}
  POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-changeme_in_production}
Recomendación: Eliminar TODOS los valores por defecto de secretos. El compose
  debe fallar si las variables no están definidas. Agregar validación en
  deploy.sh que verifique que los secretos están definidos y son suficientemente
  largos (>= 32 caracteres).
```

---

```
[CRÍTICO] SEC-A02 — Archivo backend/.env con credenciales reales
Archivo: backend/.env
Descripción: Existe un archivo backend/.env con credenciales de desarrollo:
  ADMIN_PASSWORD=admin123, SECRET_KEY=dev-secret-key-..., POSTGRES_PASSWORD=dev-password-local.
  Adicionalmente, el Containerfile usa "COPY . ." que copiará el .env al contenedor
  si existe durante el build.
Impacto: Si el .env se filtra (backup, screenshot, acceso al servidor), todas las
  credenciales quedan comprometidas. La clave JWT permite forjar tokens.
Evidencia:
  SECRET_KEY=dev-secret-key-cambiar-en-produccion-abc123
  ADMIN_PASSWORD=admin123
Recomendación:
  1. Verificar: git ls-files backend/.env (si aparece, hacer git rm --cached backend/.env)
  2. Agregar "backend/.env" explícitamente al .gitignore
  3. Crear .containerignore con: .env, tests/, venv/, __pycache__/, .git/
  4. Usar claves aleatorias incluso en desarrollo: openssl rand -hex 32
  5. ROTAR TODAS las credenciales si alguna vez se subió al repo
```

---

```
[ALTO] SEC-A03 — Token JWT sin mecanismo de revocación (no hay logout real)
Archivo: backend/app/services/auth.py:71-94
Descripción: Los tokens JWT son stateless y no existe blacklist ni endpoint de logout.
  El frontend solo elimina el token del localStorage, pero el token sigue siendo
  válido 24 horas.
Impacto: Token comprometido (XSS, dispositivo robado) = 24 horas de acceso sin
  posibilidad de invalidar la sesión.
Evidencia:
  ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 horas
  # No hay tabla de tokens revocados ni endpoint /api/auth/logout
Recomendación:
  1. Reducir expiración del access token a 15-30 minutos
  2. Implementar refresh tokens con rotación
  3. Endpoint /api/auth/logout que agrega el JTI a una blacklist (Redis o tabla DB)
  4. Verificar blacklist en get_current_user()
```

---

```
[ALTO] SEC-A04 — Token JWT almacenado en localStorage (vulnerable a XSS)
Archivo: frontend/src/pages/LoginPage.jsx:56
Descripción: El token se guarda en localStorage, accesible por cualquier script JS
  en la misma origin. Un XSS (directo o via dependencia) puede robarlo.
Impacto: Robo de sesión completa durante 24 horas.
Evidencia:
  localStorage.setItem('token', res.data.access_token);  // LoginPage.jsx:56
  const token = localStorage.getItem('token');            // api.js:38
Recomendación: Migrar a cookies HttpOnly+Secure+SameSite=Strict. Las cookies
  HttpOnly no son accesibles por JavaScript, eliminando el vector de robo via XSS.
```

---

```
[MEDIO] SEC-A05 — JWT usa username como sub (no user_id)
Archivo: backend/app/routers/auth.py:75
Descripción: El token contiene {"sub": username}. Si el username cambia, el token
  existente se invalida sin aviso. Además, cada request requiere una query a la DB
  para cargar el usuario completo.
Recomendación: Usar user_id (inmutable) como sub. Incluir company_id y is_admin
  como claims para reducir queries por request.
```

---

```
[MEDIO] SEC-A06 — Sin política de complejidad de contraseña
Archivo: backend/app/schemas/user.py:34
Descripción: Solo se verifica min_length=8. Contraseñas como "12345678" o "password"
  son aceptadas.
Evidencia:
  password: str = Field(..., min_length=8, max_length=128)
Recomendación: Requerir al menos: 1 mayúscula, 1 minúscula, 1 número, 1 carácter especial.
  Considerar verificar contra las top-10k contraseñas más comunes (zxcvbn library).
```

---

```
[BAJO] SEC-A07 — Rate limiting por IP puede ser evadido detrás de Cloudflare
Archivo: backend/app/routers/auth.py:37
Descripción: El rate limiting de login usa get_remote_address. Detrás de
  Cloudflare Tunnel, la IP puede ser siempre la misma IP interna del contenedor.
Recomendación: Usar header CF-Connecting-IP cuando esté disponible. Agregar
  rate limiting por username además de por IP.
```

---

### B — Autorización

---

```
[ALTO] SEC-B01 — Swagger UI y ReDoc expuestos en producción sin autenticación
Archivo: backend/app/main.py:67-72
Descripción: FastAPI expone /docs y /redoc con toda la estructura de la API:
  endpoints, schemas, modelos, enumeraciones. No hay restricción en producción.
Impacto: Un atacante mapea toda la superficie de ataque sin acceso al código fuente.
Recomendación:
  docs_url=None if settings.ENV == "production" else "/docs"
  redoc_url=None if settings.ENV == "production" else "/redoc"
```

---

```
[ALTO] SEC-B02 — GET /api/health revela información innecesaria
Archivo: backend/app/main.py:111-119
Descripción: El health check público retorna nombre de la app y confirma tecnología.
Recomendación: Retornar solo {"status": "ok"}.
```

---

```
[MEDIO] SEC-B03 — Tarifas eléctricas no filtran por company_id
Archivo: backend/app/routers/settings.py:172-216
Descripción: GET /api/settings/electricity-tariffs retorna todas las tarifas sin
  filtro de company_id. Rompe el patrón de aislamiento multi-tenant.
Recomendación: Documentar que la tabla es compartida (datos públicos de EPM), o
  agregar company_id si cada empresa debe tener su propio historial.
```

---

```
[MEDIO] SEC-B04 — _build_response en queue accede a Quotes sin filtro de company_id
Archivo: backend/app/routers/queue.py:78-80
Descripción: La query interna para cargar la Quote asociada al item de cola no filtra
  por company_id, inconsistente con el resto de routers.
Evidencia:
  select(Quote).where(Quote.id == item.quote_id)
  # Falta: Quote.company_id == company_id
Recomendación: Agregar filtro de company_id en la query de Quote dentro de _build_response.
```

---

### C — Inyección

---

```
[CRÍTICO] SEC-C01 — Liquid template injection + WeasyPrint SSRF/LFI
Archivo: backend/app/services/liquid_pdf.py:460-465
Descripción: Un template Liquid malicioso puede incluir URLs que WeasyPrint resuelve:
  - SSRF: <img src="http://169.254.169.254/latest/meta-data/">
  - LFI: <img src="file:///app/.env"> o CSS url("file:///etc/passwd")
  WeasyPrint está configurado con base_url="file://{_STATIC_DIR}/" lo que permite
  la resolución de rutas locales.
Impacto: Un administrador malicioso puede leer cualquier archivo accesible por el
  proceso del contenedor (secretos, código fuente, /etc/passwd) e incrustarlo en
  el PDF generado. También puede sondear servicios internos.
Evidencia:
  base_url = f"file://{_STATIC_DIR}/"
  return WeasyprintHTML(string=html, base_url=base_url).write_pdf()
Recomendación: Implementar url_fetcher personalizado:
  def safe_url_fetcher(url):
      if url.startswith('file://') and not url.startswith(f'file://{_STATIC_DIR}'):
          raise ValueError("Acceso a archivo local no permitido")
      private_ranges = ['http://localhost', 'http://127.', 'http://10.', 'http://192.168.']
      if any(url.startswith(p) for p in private_ranges):
          raise ValueError("Acceso a URL interna no permitido")
      return default_url_fetcher(url)
  Y sanitizar el HTML eliminando <script>, <iframe>, <object>, <embed> antes de
  pasarlo a WeasyPrint.
```

---

```
[BAJO] SEC-C02 — SSRF en MakerWorld fetcher (mitigado por diseño)
Archivo: backend/app/services/makerworld_fetcher.py:148,207
Descripción: El endpoint acepta URLs de usuario pero extract_model_id() solo extrae
  dígitos con regex r"(\d+)" y construye URLs fijas de makerworld.com. No hay SSRF.
Impacto: NINGUNO — la implementación actual es segura.
Recomendación: Documentar la decisión de diseño para que futuros cambios no introduzcan SSRF.
```

---

```
[MEDIO] SEC-C03 — Zip Slip en .3mf (mitigado — solo lectura en memoria)
Archivo: backend/app/services/slicer_parser.py:196-216
Descripción: parse_3mf_file() abre ZIPs y lee en memoria (no extrae al disco).
  Nombres de archivo maliciosos como "../../etc/passwd" no causan extracción real.
Impacto: BAJO — no hay extracción al disco en el código de parseo.
Recomendación: Mantener la práctica de solo leer en memoria sin extraer archivos.
```

---

### D — Subida de Archivos

---

```
[ALTO] SEC-D01 — Extensión de archivo de imagen no validada contra whitelist
Archivo: backend/app/routers/company.py:154
         backend/app/routers/printed_items.py:349
Descripción: La extensión se extrae del filename del usuario con Path(file.filename).suffix
  y se usa directamente en el nombre del archivo guardado. El content-type y magic bytes
  se validan, pero la extensión no.
Impacto: Un archivo con magic bytes JPEG pero extensión .html se guarda como UUID.html
  y nginx lo serviría como text/html, permitiendo XSS stored.
Evidencia:
  extension = Path(file.filename).suffix.lower() if file.filename else ".png"
  filename = f"{uuid.uuid4()}{extension}"
  # Sin validación: if extension not in {'.jpg', '.jpeg', '.png', '.webp', '.gif'}
Recomendación:
  ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp', '.gif'}
  if extension not in ALLOWED_EXTENSIONS:
      extension = '.jpg'
  Agregar en nginx: add_header X-Content-Type-Options "nosniff" always; (ya existe)
  Y configurar tipos MIME explícitos para /static/.
```

---

```
[MEDIO] SEC-D02 — Archivos del slicer persisten indefinidamente en disco
Archivo: backend/app/routers/slicer.py:296,393
Descripción: Archivos .gcode/.3mf/.stl hasta 250MB nunca se limpian automáticamente.
Impacto: Con cientos de subidas, el disco del volumen se llena → denegación de servicio.
Recomendación: Cron job que elimine archivos en /slicer_jobs/ con más de 7 días. O
  límite por empresa en cantidad de jobs activos.
```

---

```
[BAJO] SEC-D03 — Imágenes eliminadas no se borran del disco
Archivo: backend/app/routers/printed_items.py:219-243
Descripción: Al eliminar un PrintedItem o reemplazar su imagen, el archivo anterior
  en /app/static/prints/ no se elimina. El código lo reconoce con un comentario.
Recomendación: Al subir nueva imagen, eliminar la anterior. Al eliminar un PrintedItem,
  eliminar la imagen asociada.
```

---

### E — Exposición de Datos

---

```
[MEDIO] SEC-E01 — Backend corre como root en el contenedor
Archivo: backend/Containerfile:1-22
Descripción: No se especifica USER. Por defecto, el proceso corre como root.
  Si hay ejecución remota de código (via WeasyPrint, python-liquid, o dependencias),
  el atacante tiene acceso root dentro del contenedor.
Recomendación:
  RUN useradd -r -s /bin/false appuser
  RUN chown -R appuser:appuser /app /slicer_jobs /app/static
  USER appuser
```

---

```
[MEDIO] SEC-E02 — Mensajes de error revelan estructura interna
Archivo: backend/app/routers/slicer.py:235
Descripción: str(e)[:200] se guarda en job.error_message y puede revelar stack traces,
  paths internos o nombres de tablas de la BD.
Recomendación: Loguear el error completo internamente y retornar mensaje genérico al usuario.
```

---

```
[BAJO] SEC-E03 — /api/slicer/cli-help revela versión de OrcaSlicer
Archivo: backend/app/routers/slicer.py:240-248
Descripción: Endpoint de depuración que retorna salida completa de "OrcaSlicer --help",
  incluyendo versión exacta y opciones internas.
Recomendación: Remover en producción o restringir a administradores.
```

---

### F — CORS, CSRF, Headers

---

```
[MEDIO] SEC-F01 — Sin Content-Security-Policy (CSP)
Archivo: frontend/nginx.conf:8-13
Descripción: nginx incluye X-Frame-Options, X-Content-Type-Options, HSTS, Referrer-Policy,
  pero NO Content-Security-Policy. CSP es la defensa principal contra XSS.
Recomendación:
  add_header Content-Security-Policy "default-src 'self'; script-src 'self';
    style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:;
    font-src 'self'; connect-src 'self'; frame-ancestors 'none';" always;
```

---

```
[MEDIO] SEC-F02 — Sin protección CSRF explícita (riesgo latente)
Archivo: backend/app/main.py:79-89
Descripción: Con JWT via header Authorization hay protección implícita. Pero si se
  migra a cookies (recomendado en SEC-A04), se necesitaría CSRF protection explícita.
Recomendación: Documentar la dependencia de CSRF en el header de Authorization.
  Si se migra a cookies, implementar double submit cookie pattern.
```

---

```
[BAJO] SEC-F03 — allow_headers=["*"] en CORS es demasiado permisivo
Archivo: backend/app/main.py:88
Recomendación: Restringir a: allow_headers=["Authorization", "Content-Type", "Accept"]
```

---

### G — Dependencias y Secretos

---

```
[ALTO] SEC-G01 — python-jose abandonado (CVE-2024-33664)
Archivo: backend/requirements.txt:6
Descripción: python-jose==3.3.0 es la última versión publicada. El proyecto lleva
  sin mantenimiento activo desde 2021 y tiene vulnerabilidades conocidas de
  verificación de firmas JWT.
Evidencia:
  python-jose[cryptography]==3.3.0
Recomendación: Migrar a PyJWT (pyjwt>=2.8.0), activamente mantenido.
  La migración es directa: jwt.encode/jwt.decode con interfaz similar.
```

---

```
[MEDIO] SEC-G02 — Containerfile copia TODO incluyendo .env y tests/
Archivo: backend/Containerfile:16
Descripción: "COPY . ." copia el directorio completo sin filtrar archivos innecesarios
  o sensibles.
Recomendación: Crear backend/.containerignore:
  .env
  .env.*
  tests/
  __pycache__/
  *.pyc
  .coveragerc
  venv/
  .git/
```

---

```
[BAJO] SEC-G03 — httpx 0.27.2 puede tener vulnerabilidades menores
Archivo: backend/requirements.txt:16
Recomendación: Actualizar a httpx>=0.28.0. Ejecutar pip-audit o safety check
  regularmente.
```

---

### H — Infraestructura y Deploy

---

```
[MEDIO] SEC-H01 — PostgreSQL sin SSL entre contenedores
Archivo: podman-compose.yml:6-20
Descripción: La contraseña se transmite en texto plano entre backend y PostgreSQL
  en la red interna de contenedores.
Impacto: Si cualquier contenedor es comprometido, un atacante puede sniffear el
  tráfico y obtener las credenciales de la BD.
Recomendación: Agregar sslmode=require en DATABASE_URL y habilitar SSL en PostgreSQL.
  En red interna confiable, documentar el riesgo aceptado.
```

---

```
[MEDIO] SEC-H02 — El tracker usa las mismas credenciales de DB que el backend
Archivo: podman-compose.yml:53-54
Descripción: El microservicio tracker tiene acceso completo a todas las tablas
  con las mismas credenciales del backend principal.
Recomendación: Crear un usuario PostgreSQL separado para el tracker con permisos
  limitados (SELECT/UPDATE solo en las tablas que necesita).
```

---

```
[MEDIO] SEC-H03 — deploy.sh hace source del .env exponiendo secretos en el entorno shell
Archivo: deploy.sh:27
Descripción: "source $ENV_FILE" carga todas las variables en el entorno del proceso.
  Quedan visibles en /proc/PID/environ para otros procesos con acceso.
Recomendación: Pasar variables directamente via --env-file a los comandos que las
  necesiten, sin cargar en el entorno del shell de deploy.
```

---

```
[BAJO] SEC-H04 — Credenciales de CI hardcodeadas en deploy.yml
Archivo: .github/workflows/deploy.yml:30-34
Descripción: SECRET_KEY y ADMIN_PASSWORD de CI están en el YAML del repo.
Recomendación: Usar GitHub Actions Secrets para credenciales de CI.
```

---

### I — Lógica de Negocio

---

```
[ALTO] SEC-I01 — Race condition en deducción de inventario al completar queue items
Archivo: backend/app/routers/queue.py:116-186
Descripción: _deduct_inventory_and_update_printer() lee el inventario, calcula la
  nueva cantidad y la guarda sin SELECT FOR UPDATE. Dos requests concurrentes
  que completen items con el mismo filamento producen un descuento simple en
  lugar de doble.
Impacto: Stock puede quedar incorrecto (más alto de lo real) o negativo.
Evidencia:
  inv = await db.get(InventoryItem, quote.inventory_item_id)
  inv.quantity = (inv.quantity or Decimal("0")) - deduct
  # Sin with_for_update()
Recomendación:
  result = await db.execute(
      select(InventoryItem).where(InventoryItem.id == id).with_for_update()
  )
  inv = result.scalar_one_or_none()
```

---

```
[ALTO] SEC-I02 — Race condition en mark_order_arrived (duplicación de stock)
Archivo: backend/app/routers/purchase_orders.py:238-301
Descripción: mark_order_arrived() incrementa el stock sin bloqueo. Un doble-click
  del usuario podría duplicar el stock del inventario.
Recomendación: Igual que SEC-I01 — agregar with_for_update() en las queries de
  lectura de InventoryItem dentro de la transacción.
```

---

```
[MEDIO] SEC-I03 — Race condition en mantenimiento (deducción de insumos)
Archivo: backend/app/routers/maintenance.py:152-243
Descripción: create_log() descuenta inventario sin bloqueo. Dos logs de
  mantenimiento concurrentes con el mismo insumo producen descuento incorrecto.
Recomendación: Misma solución que SEC-I01.
```

---

```
[MEDIO] SEC-I04 — Posición de cola sin garantía de unicidad bajo concurrencia
Archivo: backend/app/routers/queue.py:260-267
Descripción: MAX(position) + 1 sin bloqueo puede generar dos items con la misma
  posición si dos requests llegan simultáneamente.
Recomendación: Usar SEQUENCE de PostgreSQL o constraint UNIQUE en
  (company_id, position) condicionado a status activo.
```

---

### J — WeasyPrint / ReportLab

---

```
[ALTO] SEC-J01 — WeasyPrint base_url permite Local File Inclusion
Archivo: backend/app/services/liquid_pdf.py:464,497
Descripción: El parámetro base_url="file://{_STATIC_DIR}/" permite a templates
  maliciosos referenciar archivos locales del contenedor.
  Ejemplos de exploit:
    <img src="file:///app/.env">
    <link rel="stylesheet" href="file:///etc/passwd">
    url("file:///app/app/config.py") en CSS
Impacto: LFI — lectura de cualquier archivo accesible por el proceso del contenedor,
  embebido silenciosamente en el PDF generado.
Recomendación: Ver SEC-C01 — implementar url_fetcher personalizado que restrinja
  el acceso a solo el directorio de estáticos de la empresa.
```

---

```
[MEDIO] SEC-J02 — Datos de usuario sin sanitización HTML en contexto Liquid
Archivo: backend/app/services/liquid_pdf.py:357-359
Descripción: client_name, description y notes se insertan en el contexto sin HTML
  encoding. python-liquid auto-escapa con {{ variable }}, pero si un template usa
  {{ variable | raw }}, se permite inyección HTML.
Recomendación: Documentar que python-liquid auto-escapa por defecto. Añadir advertencia
  en el editor de templates sobre | raw. Considerar html.escape() en los datos.
```

---

### K — Hallazgos Adicionales

---

```
[MEDIO] SEC-K01 — Archivos estáticos sin autenticación (UUIDs semi-públicos)
Archivo: backend/app/main.py:108
Descripción: Logos e imágenes en /static/ son accesibles sin autenticación.
  Cualquiera con la URL puede acceder a archivos de cualquier empresa.
Recomendación: Opción 1: Servir via endpoint autenticado que verifique company_id.
  Opción 2: Aceptar el riesgo documentando que las URLs son "semi-públicas" por obscuridad.
```

---

```
[MEDIO] SEC-K02 — Tracker sin autenticación interna en la ruta /scan
Archivo: backend/app/routers/purchase_orders.py:327-329
Descripción: El endpoint /scan del tracker se invoca sin API key. Si el tracker
  se expone accidentalmente, cualquier servicio puede disparar scraping masivo.
Recomendación: Agregar un API key compartida entre backend y tracker.
```

---

```
[BAJO] SEC-K03 — /api/inventory/items/import sin límite de tamaño de payload
Archivo: backend/app/routers/inventory.py:203-298
Descripción: Acepta JSON potencialmente grande sin límite explícito de items.
Recomendación:
  inventory_items: List[...] = Field(max_length=1000)
  printed_items: List[...] = Field(max_length=1000)
```

---

```
[BAJO] SEC-K04 — Sin auditoría (audit log) de acciones administrativas
Descripción: No hay registro de: creación/eliminación de usuarios, cambios de roles,
  cambios de contraseña, eliminación masiva de datos, cambios de configuración.
Impacto: Sin trazabilidad forense en caso de incidente.
Recomendación: Modelo AuditLog con campos: user_id, action, resource_type,
  resource_id, details, ip_address, timestamp.
```

---

```
[INFO] SEC-K05 — Sin backup automático de la base de datos
Descripción: No hay pg_dump periódico configurado. Si se corrompe el volumen
  PostgreSQL, se pierden todos los datos.
Recomendación:
  podman exec cfs-postgres pg_dump -U collectorsforge collectorsforge > backup_$(date +%Y%m%d).sql
  Agregar cron job diario o usar pgBackRest para backups incrementales.
```

---

```
[INFO] SEC-K06 — uvicorn single-process (nota de escalabilidad)
Archivo: backend/Containerfile:22
Descripción: uvicorn corre con un solo worker. El caché en memoria funciona
  correctamente con un worker, pero no escalaría con múltiples.
Recomendación: Si se escala, migrar el caché a Redis y usar --workers N.
```

---

---

## PARTE 2 — AUDITORÍA DE CALIDAD DE CÓDIGO

---

### Bugs y Correctness

---

```
[CRÍTICO] CAL-C01 — Race condition en asignación de posición en la cola
Archivo: backend/app/routers/queue.py:260-266
Descripción: MAX(position) + 1 sin bloqueo atómico. Dos solicitudes concurrentes
  pueden obtener el mismo max_pos e insertar con la misma posición.
Evidencia:
  max_pos = max_result.scalar() or 0
  item = PrintQueueItem(position=max_pos + 1)  # puede duplicarse
Recomendación: SEQUENCE de PostgreSQL o SELECT FOR UPDATE sobre la posición máxima.
  Alternativa pragmática: UNIQUE en (company_id, position, status=active).
```

---

```
[CRÍTICO] CAL-C02 — PDF y validación de templates bloquean el event loop
Archivo: backend/app/routers/quotes.py:372
         backend/app/routers/client_quotes.py:244-250
         backend/app/routers/company_templates.py:262
Descripción: generate_quote_pdf() (ReportLab) y render_client_quote_pdf() (WeasyPrint)
  son funciones síncronas CPU/IO intensivas llamadas directamente dentro de funciones
  async def, bloqueando el event loop durante 1-5 segundos por llamada.
Impacto: Mientras un usuario descarga un PDF, todas las otras solicitudes al servidor
  quedan suspendidas.
Evidencia:
  pdf_bytes = generate_quote_pdf(quote, company)           # quotes.py:372 — BLOQUEA
  pdf_bytes = render_client_quote_pdf(...)                  # client_quotes.py:244 — BLOQUEA
  result = validate_template(data.content, company)        # company_templates.py:262 — BLOQUEA
Recomendación: Usar asyncio.to_thread (ya se usa en el slicer con fetch_makerworld):
  pdf_bytes = await asyncio.to_thread(generate_quote_pdf, quote, company)
  pdf_bytes = await asyncio.to_thread(render_client_quote_pdf, ...)
  result = await asyncio.to_thread(validate_template, data.content, company)
```

---

```
[CRÍTICO] CAL-C03 — Secreto SECRET_KEY con default inseguro (ver también SEC-A01)
Archivo: podman-compose.yml:32-36
Ver hallazgo SEC-A01 — clasificado también en calidad por afectar el arranque seguro.
```

---

```
[CRÍTICO] CAL-C04 — Excepción WeasyPrint silenciada al generar PDF
Archivo: backend/app/routers/client_quotes.py:243-248
Descripción: El bloque except Exception en el fallback de WeasyPrint no registra el
  error. Si el template activo falla, el usuario recibe un PDF de ReportLab sin
  ninguna indicación de que el template está roto.
Impacto: Errores de templates en producción son invisibles para el operador.
Evidencia:
  try:
      pdf_bytes = render_client_quote_pdf(active_tpl.content, cq, company, usd_rate)
  except Exception:
      # Error completamente silenciado
      pdf_bytes = generate_client_quote_pdf(cq, company, usd_rate)
Recomendación:
  except Exception as exc:
      logging.error("WeasyPrint falló para template %s: %s", active_tpl.id, exc, exc_info=True)
      pdf_bytes = generate_client_quote_pdf(cq, company, usd_rate)
```

---

```
[CRÍTICO] CAL-C05 — company_id nullable en modelos que deberían ser NOT NULL
Archivo: backend/app/models/printer.py:84
         backend/app/models/quote.py:41
         backend/app/models/queue.py:45
Descripción: company_id es nullable=True en varios modelos donde debería ser NOT NULL
  (residuo de antes de la migración multi-tenant). La BD no rechaza registros sin
  company_id, rompiendo el aislamiento.
Recomendación: Migrar a nullable=False en Printer, Quote y PrintQueueItem una vez
  confirmado que todos los registros existentes tienen company_id poblado.
```

---

```
[ALTO] CAL-A01 — N+1 queries en _build_response de la cola
Archivo: backend/app/routers/queue.py:67-113
Descripción: list_queue() y list_queue_history() cargan N items y luego llaman a
  _build_response() por cada uno, ejecutando hasta 2 queries adicionales por item
  (Quote + Printer). Con 50 items: ~101 queries vs las 1-3 que deberían ser.
Evidencia:
  return [await _build_response(item, db) for item in items]  # N+1
Recomendación: Usar selectinload/joinedload en la query principal, o hacer batch
  queries (WHERE id IN (...)) para quotes y printers.
```

---

```
[ALTO] CAL-A02 — NullPointerError potencial en comparación min_quantity en maintenance.py
Archivo: backend/app/routers/maintenance.py:237
Descripción: inv_item.min_quantity puede ser None. La comparación directa
  inv_item.quantity < inv_item.min_quantity falla con TypeError. El router de queue
  lo verifica correctamente con if inv.min_quantity is not None.
Evidencia:
  if inv_item.quantity < inv_item.min_quantity:  # TypeError si min_quantity es None
Recomendación:
  if inv_item.min_quantity is not None and inv_item.quantity < inv_item.min_quantity:
```

---

```
[ALTO] CAL-A03 — Idempotencia rota en mark_order_arrived cuando inv_item es None
Archivo: backend/app/routers/purchase_orders.py:268-298
Descripción: Si un InventoryItem referenciado en una orden fue eliminado antes de
  marcar la orden como llegada, el código lo omite silenciosamente: actualiza el
  pedido a "llegado" pero sin sumar el stock del item eliminado.
Recomendación: Registrar warning cuando inv_item es None para un inventory_item_id
  no nulo. Retornar en la respuesta la lista de items no procesados.
```

---

```
[ALTO] CAL-A04 — Archivos STL huérfanos en disco cuando falla el commit de DB
Archivo: backend/app/routers/slicer.py:292-339
Descripción: El archivo se escribe en disco ANTES del commit a la BD. Si el commit
  falla, el archivo queda en disco sin registro y nunca se elimina.
Evidencia:
  temp_path.write_bytes(contenido)  # escrito en disco
  db.add(job)
  await db.commit()  # si falla, el archivo queda huérfano
Recomendación: Envolver en try/except para limpiar el archivo si el commit falla:
  try:
      await db.commit()
  except Exception:
      temp_path.unlink(missing_ok=True)
      raise
```

---

```
[ALTO] CAL-A05 — Sin índice en quote_id de print_queue
Archivo: backend/app/models/queue.py:48-50
Descripción: PrintQueueItem.quote_id no tiene index=True. Se consulta frecuentemente
  en _build_response y en status updates. Sin índice → sequential scan en tablas grandes.
Recomendación: Agregar index=True y generar migración Alembic.
```

---

```
[ALTO] CAL-A06 — items de ClientQuote como TEXT en lugar de JSONB
Archivo: backend/app/models/client_quote.py:53
Descripción: El campo items es Text (no JSONB). Requiere json.loads() explícito en
  Python y no es consultable desde la BD. Si el JSON se corrompe, el error se
  manifiesta solo en lectura, no en escritura.
Evidencia:
  items: Mapped[str] = mapped_column(Text, ...)
  # Luego: items = json.loads(client_quote.items)  # pdf_generator.py:542
Recomendación: Migrar a JSONB como ya se usa en Quote.supplies_detail.
```

---

```
[ALTO] CAL-A07 — validate_template bloquea el event loop (igual que CAL-C02)
Archivo: backend/app/routers/company_templates.py:262
Ver CAL-C02 — la validación de templates es igualmente bloqueante.
```

---

### Rendimiento

---

```
[MEDIO] CAL-M01 — Sin paginación en list_inventory_items y list_maintenance_logs
Archivo: backend/app/routers/inventory.py:80-104
         backend/app/routers/maintenance.py:118-149
Descripción: Cargan TODOS los registros sin limit ni offset. Con 1000+ items
  (posible en un negocio activo), la respuesta puede ser muy grande.
Recomendación: Agregar parámetros skip y limit (default 100) siguiendo el patrón
  ya usado en list_quotes, list_client_quotes y list_jobs.
```

---

### Mantenibilidad y Deuda Técnica

---

```
[MEDIO] CAL-M02 — Código duplicado del patrón get_or_create AppSettings
Archivo: backend/app/routers/quotes.py:418-429
         backend/app/routers/settings.py:61-68, 99-107
Descripción: El patrón "buscar AppSettings por company_id, y si no existe, crearlo"
  está duplicado en al menos 3 lugares distintos.
Recomendación: Extraer a:
  async def get_or_create_settings(db, user) -> AppSettings
  en un módulo de servicios.
```

---

```
[MEDIO] CAL-M03 — quantity de InventoryItem puede bajar a negativo (TOCTOU)
Archivo: backend/app/routers/queue.py:137-141
Descripción: La asignación inv.quantity = ... - deduct ocurre antes de verificar
  si el resultado es negativo. Con concurrencia, la verificación puede pasar
  incorrectamente.
Evidencia:
  inv.quantity = (inv.quantity or Decimal("0")) - deduct  # asigna antes de verificar
  if inv.quantity < 0:
      raise HTTPException(...)
Recomendación: UPDATE atómico: "UPDATE inventory_items SET quantity = quantity - :deduct
  WHERE id = :id AND quantity >= :deduct RETURNING quantity".
```

---

```
[MEDIO] CAL-M04 — Ruta /default-template inalcanzable por conflicto con /{template_id}
Archivo: backend/app/routers/company_templates.py:122-142, 310
Descripción: FastAPI registra rutas en orden de declaración. GET /{template_id}
  se declara ANTES de GET /default-template, por lo que "default-template" se
  parsea como template_id entero y falla con 422.
Impacto: El endpoint GET /api/company/templates/default-template NUNCA es alcanzado.
  El frontend llama a este endpoint para obtener el template base al crear uno nuevo.
Evidencia:
  @router.get("/{template_id}", ...)  # declarado primero en línea ~122
  @router.get("/default-template", ...)  # declarado después en línea ~310 — INALCANZABLE
Recomendación: Mover GET /default-template ANTES de GET /{template_id} en el archivo,
  o renombrar a GET /system/default-template.
```

---

```
[MEDIO] CAL-M05 — _fmt_cop duplicada en pdf_generator.py y liquid_pdf.py
Archivo: backend/app/services/pdf_generator.py:142-144
         backend/app/services/liquid_pdf.py:250-252
Descripción: Función idéntica en dos archivos. Cambios de formato (símbolo de moneda,
  separador) deben hacerse en dos lugares.
Recomendación: Mover a app/services/formatters.py e importar en ambos servicios.
```

---

```
[MEDIO] CAL-M06 — Archivos leídos completos en memoria antes de verificar tamaño
Archivo: backend/app/routers/slicer.py:292-295
         backend/app/routers/company.py:132-137
Descripción: await file.read() lee hasta 250MB en memoria ANTES de verificar
  el límite de tamaño. Un atacante puede enviar múltiples solicitudes de 250MB
  simultáneamente para agotar la RAM del servidor.
Evidencia:
  contenido = await file.read()        # Lee 250MB en memoria
  if len(contenido) > MAX_UPLOAD_BYTES:  # Solo entonces verifica
Recomendación: Leer en chunks y contar mientras se lee, o usar el header
  Content-Length como primera verificación rápida.
```

---

```
[MEDIO] CAL-M07 — Lógica de negocio de insumos mezclada con capa de presentación
Archivo: backend/app/routers/quotes.py:453-538
Descripción: _resolve_supplies() y _resolve_additional_filaments() son funciones
  de lógica de negocio (lookup + validación de inventario) que viven en el router.
Recomendación: Mover a services/inventory_resolver.py para reutilización y testabilidad.
```

---

```
[MEDIO] CAL-M08 — Sin manejo de error en get_usd_to_cop() en flujos críticos
Archivo: backend/app/routers/client_quotes.py:94
         backend/app/routers/quotes.py:86
Descripción: Si el servicio de tipo de cambio falla, la excepción no se captura
  y el endpoint retorna 500 opaco.
Recomendación: Capturar la excepción y retornar 503 con mensaje claro:
  "Servicio de tipo de cambio no disponible. Intente de nuevo en unos minutos."
```

---

```
[MEDIO] CAL-M09 — Token JWT en localStorage (ver también SEC-A04)
Archivo: frontend/src/services/api.js:38-41
Descripción: Vulnerable a XSS. Para un sistema interno con usuarios conocidos,
  el riesgo es bajo pero existe.
```

---

```
[MEDIO] CAL-M10 — Sin deploy rollback automático en fallo
Archivo: .github/workflows/deploy.yml:80-89
Descripción: Si deploy.sh falla a mitad, el sistema puede quedar en estado
  inconsistente (nuevo código + BD sin migrar o viceversa).
Recomendación: Agregar manejo de error en el step de deploy con notificación
  y verificación de salud post-deploy.
```

---

### Hallazgos Bajos

---

```
[BAJO] CAL-B01 — company_id nullable en modelos multi-tenant (residuo)
Archivo: backend/app/models/printer.py, quote.py, queue.py
Descripción: company_id nullable donde debería ser NOT NULL. Residuo de antes
  de la migración multi-tenant.
Recomendación: Migrar a nullable=False con verificación previa de datos existentes.
```

---

```
[BAJO] CAL-B02 — Doble commit innecesario en create_default_data
Archivo: backend/app/main.py:149-152
Descripción: await db.commit() seguido de await db.refresh() donde bastaría
  await db.flush() para obtener el ID sin hacer commit.
```

---

```
[BAJO] CAL-B03 — Endpoint /tracking documentado pero no implementado
Archivo: backend/app/routers/purchase_orders.py:16
Descripción: El docstring menciona GET /api/inventory/purchases/{id}/tracking
  pero no hay implementación de ese endpoint.
```

---

```
[BAJO] CAL-B04 — Historial de cola sin paginación configurable
Archivo: backend/app/routers/queue.py:200-210
Descripción: El historial limita a 50 items con .limit(50) sin exponer parámetros
  skip/limit al cliente. No hay forma de ver items más antiguos.
```

---

```
[BAJO] CAL-B05 — getInventorySupplies() no filtra por categoría en el servidor
Archivo: frontend/src/services/api.js:492
Descripción: Retorna todos los items sin filtro de categoría; el componente debe
  filtrar en el cliente.
```

---

```
[BAJO] CAL-B06 — _MAGIC_CHECKS duplicado en dos routers
Archivo: backend/app/routers/printed_items.py:332-337
         backend/app/routers/company.py:139-144
Descripción: Diccionario de magic bytes para validación de imágenes idéntico en dos
  lugares. Cambios deben hacerse dos veces.
Recomendación: Mover a app/services/file_utils.py.
```

---

```
[BAJO] CAL-B07 — Sin timeout en validate_template (posible loop infinito Liquid)
Archivo: backend/app/services/liquid_pdf.py:492-503
Descripción: Un template con loop infinito podría correr indefinidamente bloqueando
  el thread.
Recomendación: Envolver en asyncio.wait_for con timeout de 30 segundos.
```

---

```
[BAJO] CAL-B08 — Dependencias críticas con especificador >= en lugar de ==
Archivo: backend/requirements.txt:14-15
Descripción: python-liquid>=1.12.0 y weasyprint>=62.0 pueden romperse con updates
  mayores en el próximo rebuild del contenedor.
Recomendación: Fijar versiones exactas (==) para todas las dependencias en producción.
```

---

```
[BAJO] CAL-B09 — Sin campo updated_at en Quote y ClientQuote
Archivo: backend/app/models/quote.py, client_quote.py
Descripción: Solo tienen created_at. Quote tiene endpoint PUT de actualización
  pero no hay forma de saber cuándo fue la última modificación.
```

---

```
[BAJO] CAL-B10 — _build_response en queue no verifica company_id de la Quote
Archivo: backend/app/routers/queue.py:78-80
Descripción: Inconsistencia con el patrón de todos los demás routers. Ver SEC-B04.
```

---

---

## Plan de Acción Sugerido

### Sprint 1 — Crítico (esta semana)

| # | Acción | Archivos |
|---|--------|----------|
| 1 | Eliminar defaults de secretos en podman-compose.yml | podman-compose.yml |
| 2 | Crear .containerignore para excluir .env del build | backend/.containerignore |
| 3 | Implementar url_fetcher seguro en WeasyPrint | liquid_pdf.py |
| 4 | Mover GET /default-template antes de GET /{template_id} | company_templates.py |
| 5 | Loguear excepción silenciada en fallback WeasyPrint | client_quotes.py |
| 6 | asyncio.to_thread en todas las llamadas a ReportLab/WeasyPrint | quotes.py, client_quotes.py, company_templates.py |

### Sprint 2 — Alto (próximas 2 semanas)

| # | Acción |
|---|--------|
| 7 | SELECT FOR UPDATE en deducción de inventario (queue, purchases, maintenance) |
| 8 | Deshabilitar /docs y /redoc en producción |
| 9 | Reducir expiración JWT a 30 min + implementar logout con blacklist |
| 10 | Migrar python-jose → PyJWT |
| 11 | Validar extensión de archivo contra whitelist en subida de imágenes |
| 12 | Agregar USER no-root en Containerfiles |
| 13 | Fix N+1 queries en list_queue / list_queue_history |

### Sprint 3 — Medio (próximo mes)

| # | Acción |
|---|--------|
| 14 | Content-Security-Policy en nginx |
| 15 | Paginación en inventory y maintenance logs |
| 16 | Refactorizar _fmt_cop a módulo compartido |
| 17 | Refactorizar _MAGIC_CHECKS a módulo compartido |
| 18 | Migrar items de ClientQuote de TEXT a JSONB |
| 19 | index=True en PrintQueueItem.quote_id |
| 20 | Cron job de limpieza de archivos slicer (TTL 7 días) |
| 21 | Manejo de error explícito en get_usd_to_cop() |

### Sprint 4 — Bajo / Deuda técnica

| # | Acción |
|---|--------|
| 22 | Backup automático de PostgreSQL |
| 23 | Audit log de acciones administrativas |
| 24 | Fijar versiones de dependencias (== en lugar de >=) |
| 25 | Migrar company_id a nullable=False |
| 26 | updated_at en Quote y ClientQuote |
| 27 | Timeout en validate_template |

---

*Generado automáticamente — revisión humana requerida antes de implementar cambios.*
