# Guía de Despliegue — Collector's Forge Studio

Cubre: instalación desde cero, actualización, reinicio de servicios, rollback, backup y migración a otro servidor.

---

## Requisitos del servidor

| Componente | Mínimo | Recomendado |
|---|---|---|
| OS | Ubuntu 22.04 / Fedora 38 / Debian 12 | Ubuntu 24.04 LTS |
| RAM | 2 GB | 4 GB |
| Disco | 20 GB | 50 GB |
| CPU | 2 cores | 4 cores |
| Podman | 4.0+ | 5.x |
| Git | 2.x | — |
| Acceso internet | saliente TCP 443 | — |

> El servidor **no** necesita puertos abiertos hacia internet. Cloudflare Tunnel usa conexión saliente.

---

## 1. Instalación desde cero

### 1.1 Instalar Podman

**Ubuntu 22.04 / 24.04:**
```bash
sudo apt-get update
sudo apt-get install -y podman
```

**Fedora:**
```bash
sudo dnf install -y podman
```

Verificar:
```bash
podman --version
# podman version 5.x.x
```

### 1.2 Clonar el repositorio

```bash
# En el servidor de producción
git clone git@github.com:GiomarOsorio/collectors-forge-studio.git ~/collectors-forge-studio
cd ~/collectors-forge-studio
```

> Si el servidor no tiene clave SSH configurada para GitHub, usar HTTPS:
> ```bash
> git clone https://github.com/GiomarOsorio/collectors-forge-studio.git ~/collectors-forge-studio
> ```

### 1.3 Configurar secretos

`deploy.sh` obtiene secretos en este orden de prioridad:

1. **Infisical** (recomendado): si `INFISICAL_CLIENT_ID` + `INFISICAL_CLIENT_SECRET` están en el entorno y Infisical responde en `http://127.0.0.1:8080`, jala todos los secretos desde ahí y genera `~/CollectorsForgeENV` automáticamente.
2. **`~/CollectorsForgeENV`** (fallback manual): archivo fuera del repo.
3. **`$DEPLOY_PATH/.env`** (último recurso).

#### Opción A — Infisical (recomendada)

Crear los siguientes secretos en Infisical — **proyecto `homelab`**, environment `prod`, **carpeta `/collectorsforge`**:

| Nombre en Infisical | Descripción |
|---|---|
| `SECRET_KEY` | Clave JWT (`openssl rand -hex 32`) |
| `POSTGRES_PASSWORD` | Contraseña PostgreSQL |
| `SESSION_SECRET_KEY` | Clave SessionMiddleware (`openssl rand -hex 32`) |
| `OIDC_ISSUER` | URL issuer Authentik |
| `OIDC_CLIENT_ID` | Client ID de Authentik |
| `OIDC_CLIENT_SECRET` | Client Secret de Authentik |
| `OIDC_REDIRECT_URI` | `https://3d.turtlenode.dev/api/auth/oidc/callback` |
| `MINIO_BUCKET` | Nombre del bucket (opcional, default `cfs-models`) |
| `VAULT_QUOTA_GB` | Cuota Vault en GB (opcional, default `50`) |

Los secretos de MinIO van en carpeta `/minio` (no en `/collectorsforge`):

| Nombre en Infisical | Path | Descripción |
|---|---|---|
| `MINIO_ENDPOINT` | `/minio` | Ej. `http://turtleStorage:9000` |
| `MINIO_ACCESS_KEY` | `/minio` | Credencial MinIO (root user) |
| `MINIO_SECRET_KEY` | `/minio` | Credencial MinIO (root password) |

Crear una Machine Identity en Infisical para el deploy:
1. **Infisical → `homelab` → Access Control → Machine Identities → Create**
2. Nombre: `collectorsforge-deploy`
3. Asignar rol con permiso de lectura en el proyecto (o solo en `/collectorsforge` si Infisical lo soporta)
4. Copiar `Client ID` y `Client Secret`

Luego en GitHub: **Settings → Secrets → Actions**, agregar solo:
- `INFISICAL_CLIENT_ID`
- `INFISICAL_CLIENT_SECRET`

#### Opción B — Archivo manual (sin Infisical)

El script `deploy.sh` busca el archivo de variables en:
1. `~/CollectorsForgeENV` (recomendado — fuera del repo)
2. `$DEPLOY_PATH/.env` (fallback)

```bash
# Opción recomendada: fuera del repo
cp ~/collectors-forge-studio/.env.example ~/CollectorsForgeENV
nano ~/CollectorsForgeENV
```

Completar `~/CollectorsForgeENV`:

```bash
# ── Obligatorias ──────────────────────────────────────────────
# Clave JWT (generar con: openssl rand -hex 32)
SECRET_KEY=pega-aqui-el-resultado-de-openssl

# Contraseña de PostgreSQL
POSTGRES_PASSWORD=pon-una-password-segura

# Clave para SessionMiddleware (generar con: openssl rand -hex 32)
SESSION_SECRET_KEY=pega-aqui-otro-valor-de-openssl

# ── OIDC / SSO ────────────────────────────────────────────────
# URL issuer de Authentik (o cualquier proveedor OIDC estándar)
# En Authentik: https://auth.tudominio.com/application/o/<slug>/
OIDC_ISSUER=https://auth.tudominio.com/application/o/collectorsforge/

# Client ID y Secret de la aplicación OAuth2 creada en Authentik
OIDC_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
OIDC_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Redirect URI — debe coincidir exactamente con la configurada en Authentik
OIDC_REDIRECT_URI=https://3d.turtlenode.dev/api/auth/oidc/callback

# Nota: el Cloudflare Tunnel lo gestiona service-deployments.
# No hay TUNNEL_TOKEN en este archivo.

# ── Opcionales (tienen defaults razonables) ───────────────────
POSTGRES_USER=collectorsforge
POSTGRES_DB=collectorsforge
POSTGRES_HOST=cfs-postgres
POSTGRES_PORT=5432
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
```

Generar claves:
```bash
openssl rand -hex 32  # usar para SECRET_KEY
openssl rand -hex 32  # usar para SESSION_SECRET_KEY (valor diferente)
```

### 1.4 Ejecutar el deploy

```bash
cd ~/collectors-forge-studio
./deploy.sh
```

El script realiza automáticamente:
1. Valida que `SECRET_KEY` y `POSTGRES_PASSWORD` estén definidas
2. Habilita `loginctl linger` para que los servicios sobrevivan logout
3. Construye imágenes: backend, frontend, slicer
4. Descarga `postgres:16-alpine`
5. Instala los Quadlets en `~/.config/containers/systemd/`
6. Recarga systemd y arranca PostgreSQL
7. Espera que PostgreSQL esté listo (hasta 60 s)
8. Ejecuta `alembic upgrade head` en un contenedor temporal
9. Arranca backend, slicer y frontend
10. Verifica que `/api/health` responde

**Salida esperada al final:**
```
=== Deploy completo ===
  App local:  http://localhost:3000
  App pública: https://3d.turtlenode.dev (vía cloudflared en service-deployments)
```

### 1.5 Verificar que todo está corriendo

```bash
# Ver servicios activos
systemctl --user status cfs-postgres
systemctl --user status cfs-backend
systemctl --user status cfs-frontend
systemctl --user status cfs-slicer

# Ver todos los contenedores
podman ps

# Verificar backend directamente
curl http://localhost:8000/api/health
# {"status":"ok","app":"Collector's Forge Studio"}
```

---

## 2. Actualización (después de git push)

El CI/CD actualiza automáticamente vía el self-hosted runner. Si necesitas actualizar manualmente:

```bash
cd ~/collectors-forge-studio
git pull origin main
./deploy.sh
```

`deploy.sh` es idempotente: si los servicios ya están corriendo, los reinicia con la nueva imagen. Las migraciones se aplican automáticamente.

---

## 3. Configurar el self-hosted runner (CI/CD)

El runner de GitHub Actions se instala en el servidor de producción y escucha órdenes de GitHub para ejecutar `deploy.sh` automáticamente en cada push a `main`.

### 3.1 Obtener el token de registro

En GitHub: **Settings → Actions → Runners → New self-hosted runner → Linux → x64**

Copia el comando `./config.sh` completo (el token expira en 1 hora).

### 3.2 Instalar el runner

```bash
# En el servidor de producción
mkdir -p ~/actions-runner && cd ~/actions-runner

# Descargar (ajustar versión a la última disponible)
curl -o runner.tar.gz -L https://github.com/actions/runner/releases/download/v2.321.0/actions-runner-linux-x64-2.321.0.tar.gz
tar xzf runner.tar.gz

# Configurar (pega el comando de GitHub aquí)
./config.sh \
  --url https://github.com/GiomarOsorio/collectors-forge-studio \
  --token TU_TOKEN_AQUI \
  --name collectorsforge-prod \
  --unattended

# Instalar como servicio systemd
sudo ./svc.sh install
sudo ./svc.sh start
```

### 3.3 Verificar estado del runner

```bash
sudo ./svc.sh status
# ● actions.runner.GiomarOsorio-collectors-forge-studio.collectorsforge-prod.service
#    Active: active (running) ✓

# Ver logs del runner
journalctl -u actions.runner.GiomarOsorio-collectors-forge-studio.collectorsforge-prod -n 50
```

### 3.4 Reiniciar el runner (si se cae)

```bash
cd ~/actions-runner
sudo ./svc.sh start
```

### 3.4b Trigger manual de deploy

El workflow tiene `workflow_dispatch` habilitado. Para forzar un deploy sin hacer push:

**GitHub Actions UI** → Repositorio → Actions → "CI / Deploy" → "Run workflow" → Branch: `main` → Run workflow.

---

### 3.5 GitHub SSH a través del puerto 443

Si el servidor no puede conectar a GitHub por el puerto 22 (SSH), configurar `~/.ssh/config`:

```
Host github.com
    Hostname ssh.github.com
    Port 443
    User git
```

---

## 4. Configurar Authentik (OIDC/SSO)

Collector's Forge Studio usa OIDC con PKCE para autenticación. No hay login local con contraseña. Cualquier proveedor OIDC estándar funciona; estas instrucciones son para **Authentik**.

### 4.1 Crear el Provider en Authentik

1. Ir a **Admin Interface → Applications → Providers → Create**
2. Tipo: **OAuth2/OpenID Provider**
3. Configurar:

| Campo | Valor |
|---|---|
| Name | `Collector's Forge Studio` |
| Authorization flow | `default-provider-authorization-explicit-consent` |
| Client type | `Confidential` |
| Client ID | (se genera automáticamente — copiar) |
| Client Secret | (se genera automáticamente — copiar) |
| Redirect URIs | `https://3d.turtlenode.dev/api/auth/oidc/callback` |
| Signing Key | `authentik Self-signed Certificate` |
| Scopes | `openid`, `profile`, `email` |

4. En **Advanced Protocol Settings** verificar que esté habilitado: `Include claims in id_token`

### 4.2 Crear la Application en Authentik

1. **Applications → Applications → Create**
2. Configurar:

| Campo | Valor |
|---|---|
| Name | `Collector's Forge Studio` |
| Slug | `collectorsforge` |
| Provider | `Collector's Forge Studio` (recién creado) |

### 4.3 Obtener la URL del Issuer

La URL del issuer de Authentik sigue el patrón:
```
https://<tu-authentik>/application/o/<application-slug>/
```

Verificar que el endpoint de discovery funcione:
```bash
curl https://auth.tudominio.com/application/o/collectorsforge/.well-known/openid-configuration
# Debe retornar JSON con los endpoints del proveedor
```

### 4.4 Configurar las variables de entorno

Con los valores obtenidos de Authentik, completar en `~/CollectorsForgeENV`:
```bash
OIDC_ISSUER=https://auth.tudominio.com/application/o/collectorsforge/
OIDC_CLIENT_ID=<client-id-de-authentik>
OIDC_CLIENT_SECRET=<client-secret-de-authentik>
OIDC_REDIRECT_URI=https://3d.turtlenode.dev/api/auth/oidc/callback
```

Reiniciar el backend para aplicar:
```bash
systemctl --user restart cfs-backend
```

### 4.5 Primer login

El **primer usuario** que inicie sesión vía OIDC recibe automáticamente rol `admin`. Los usuarios siguientes reciben rol `operator`. No se crean usuarios manualmente — el sistema hace JIT provisioning desde los claims del ID token.

---

## 5. Configurar Cloudflare Tunnel

El tunnel lo gestiona el repo **`service-deployments`** — no este repo. El contenedor `cloudflared` en `service-deployments` ya está en la red `cfs` y puede alcanzar `cfs-frontend:80` directamente.

### 5.1 Configurar el public hostname en Cloudflare

En el dashboard [one.dash.cloudflare.com](https://one.dash.cloudflare.com) → **Networks → Tunnels → tu tunnel → Public Hostnames**:

| Campo | Valor |
|---|---|
| Subdomain | `3d` |
| Domain | `turtlenode.dev` |
| Type | `HTTP` |
| URL | `cfs-frontend:80` |

### 5.2 Redesplegar cloudflared (service-deployments)

Después de actualizar el hostname, redesplegar cloudflared para que se conecte a la red `cfs`:

```bash
cd ~/service-deployments
./deploy.sh cloudflared
```

Esto instala `cfs.network` (desde `shared/`) + el quadlet `cloudflared.container` con ambas redes (`authentik` y `cfs`).

### 5.3 Cloudflare Access (opcional)

Con Authentik ya en uso, Cloudflare Access es redundante. Si igual se desea una capa adicional:

1. **Access → Applications → Add an application → Self-hosted**
2. Application domain: `3d.turtlenode.dev`
3. Política: solo tu email o dominio

---

## 6. Reinicio de servicios

### Reiniciar un servicio individual

```bash
systemctl --user restart cfs-backend
systemctl --user restart cfs-frontend
systemctl --user restart cfs-postgres
systemctl --user restart cfs-slicer
```

> Para reiniciar el tunnel: `cd ~/service-deployments && ./deploy.sh cloudflared`

### Reiniciar todo el stack

```bash
systemctl --user restart \
  cfs-postgres \
  cfs-backend \
  cfs-slicer \
  cfs-frontend
```

### Detener todo el stack

```bash
systemctl --user stop \
  cfs-frontend \
  cfs-slicer \
  cfs-backend \
  cfs-postgres
```

### Ver logs en tiempo real

```bash
# Backend
journalctl --user -u cfs-backend -f

# PostgreSQL
journalctl --user -u cfs-postgres -f

# Slicer
journalctl --user -u cfs-slicer -f

# Tunnel (corre en service-deployments)
journalctl --user -u cloudflared -f

# Últimas 100 líneas del backend
journalctl --user -u cfs-backend -n 100
```

---

## 7. Gestión de la base de datos

### Conectar a PostgreSQL

```bash
# Shell interactivo
podman exec -it cfs-postgres \
  psql -U collectorsforge -d collectorsforge

# Ejecutar una consulta directa
podman exec cfs-postgres \
  psql -U collectorsforge -d collectorsforge -c "SELECT * FROM alembic_version;"
```

### Verificar la versión de migración actual

```bash
podman exec cfs-postgres \
  psql -U collectorsforge -d collectorsforge \
  -c "SELECT version_num FROM alembic_version;"
```

### Aplicar migraciones manualmente

```bash
# Ejecutar en el contenedor backend existente
podman exec cfs-backend \
  alembic upgrade head

# O en un contenedor temporal (más seguro si backend no está corriendo)
source ~/CollectorsForgeENV
podman run --rm \
  --network cfs \
  --env-file ~/CollectorsForgeENV \
  -e ALGORITHM=HS256 \
  -e ACCESS_TOKEN_EXPIRE_MINUTES=1440 \
  localhost/cfs-backend:latest \
  alembic upgrade head
```

### Backup de PostgreSQL

```bash
# Backup completo
podman exec cfs-postgres \
  pg_dump -U collectorsforge collectorsforge \
  > ~/backups/collectorsforge-$(date +%Y%m%d-%H%M%S).sql

# Backup comprimido
podman exec cfs-postgres \
  pg_dump -U collectorsforge -Fc collectorsforge \
  > ~/backups/collectorsforge-$(date +%Y%m%d-%H%M%S).dump
```

### Restaurar un backup

```bash
# Desde SQL
cat ~/backups/collectorsforge-20260228.sql | \
  podman exec -i cfs-postgres \
  psql -U collectorsforge -d collectorsforge

# Desde dump comprimido
podman exec -i cfs-postgres \
  pg_restore -U collectorsforge -d collectorsforge \
  < ~/backups/collectorsforge-20260228.dump
```

### Backup automático diario (crontab)

```bash
crontab -e
# Agregar:
0 2 * * * mkdir -p ~/backups && podman exec cfs-postgres pg_dump -U collectorsforge -Fc collectorsforge > ~/backups/collectorsforge-$(date +\%Y\%m\%d).dump 2>> ~/backups/backup.log
```

### Copiar archivos estáticos (logos, imágenes)

```bash
# Backup de imágenes
podman cp cfs-backend:/app/static ~/backups/static-$(date +%Y%m%d)

# Restaurar
podman cp ~/backups/static-20260228/. cfs-backend:/app/static/
```

---

## 8. Rollback

### Rollback de código

```bash
cd ~/collectors-forge-studio

# Ver historial de commits
git log --oneline -10

# Volver a un commit anterior
git checkout <commit-hash>
./deploy.sh
```

### Rollback de migración de base de datos

```bash
# Ver historial de migraciones
podman exec cfs-backend alembic history

# Bajar una migración
podman exec cfs-backend alembic downgrade -1

# Bajar a una versión específica
podman exec cfs-backend alembic downgrade f7a8b9c0d1e2
```

> **Importante:** Hacer un backup de la BD antes de cualquier downgrade. Algunas migraciones eliminan columnas y el rollback puede perder datos.

---

## 9. Migración a otro servidor

### 8.1 En el servidor origen

```bash
# 1. Backup de la base de datos
mkdir -p ~/migration-backup
podman exec cfs-postgres \
  pg_dump -U collectorsforge -Fc collectorsforge \
  > ~/migration-backup/collectorsforge.dump

# 2. Backup de archivos estáticos
podman cp cfs-backend:/app/static ~/migration-backup/static

# 3. Copiar variables de entorno
cp ~/CollectorsForgeENV ~/migration-backup/CollectorsForgeENV

echo "Archivos listos en ~/migration-backup/"
```

### 8.2 Transferir al servidor destino

```bash
# Desde el servidor origen (o desde la Mac)
scp -r usuario@servidor-origen:~/migration-backup/ ~/migration-backup/
```

### 8.3 En el servidor destino

```bash
# 1. Instalar Podman y clonar el repo (ver sección 1)
git clone git@github.com:GiomarOsorio/collectors-forge-studio.git ~/collectors-forge-studio

# 2. Restaurar variables de entorno
cp ~/migration-backup/CollectorsForgeENV ~/CollectorsForgeENV

# 3. Levantar solo PostgreSQL primero
source ~/CollectorsForgeENV
podman run -d \
  --name cfs-postgres \
  --network cfs \
  -v cfs-pgdata:/var/lib/postgresql/data:Z \
  -e POSTGRES_DB=${POSTGRES_DB:-collectorsforge} \
  -e POSTGRES_USER=${POSTGRES_USER:-collectorsforge} \
  -e POSTGRES_PASSWORD=$POSTGRES_PASSWORD \
  docker.io/postgres:16-alpine

# Esperar a que esté listo
sleep 10
podman exec cfs-postgres pg_isready -U collectorsforge

# 4. Restaurar el dump
cat ~/migration-backup/collectorsforge.dump | \
  podman exec -i cfs-postgres \
  pg_restore -U collectorsforge -d collectorsforge

# 5. Deploy completo
cd ~/collectors-forge-studio
./deploy.sh

# 6. Restaurar archivos estáticos
podman cp ~/migration-backup/static/. cfs-backend:/app/static/
```

---

## 10. Diagnóstico de problemas comunes

### El backend no inicia

```bash
journalctl --user -u cfs-backend -n 50

# Causas frecuentes:
# - PostgreSQL no está listo aún (esperar y reintentar)
# - Variable de entorno faltante (revisar CollectorsForgeENV)
# - Error en migración Alembic (ver logs de deploy.sh)
```

### "alembic upgrade head" falla

```bash
# Ver versión actual en BD
podman exec cfs-postgres \
  psql -U collectorsforge -d collectorsforge \
  -c "SELECT * FROM alembic_version;"

# Ver migraciones disponibles
podman exec cfs-backend alembic history

# Si la BD está corrupta, restaurar desde backup y reintentar
```

### El tunnel no conecta

El tunnel lo gestiona `service-deployments`, no este repo.

```bash
# Ver logs del tunnel
journalctl --user -u cloudflared -n 50

# Redesplegar cloudflared (jala CLOUDFLARED_TUNNEL_TOKEN desde Infisical)
cd ~/service-deployments && ./deploy.sh cloudflared

# Causas frecuentes:
# - cloudflared no está en la red cfs → redesplegar service-deployments
# - cfs-frontend no está corriendo → systemctl --user restart cfs-frontend
# - TUNNEL_TOKEN inválido → renovar en Cloudflare dashboard y actualizar en Infisical (homelab/prod/)
```

### El runner de CI no ejecuta deploys

```bash
sudo ./svc.sh status
# Si está detenido:
sudo ./svc.sh start

# Si el token de runner expiró, re-configurar:
./config.sh remove
./config.sh --url ... --token NUEVO_TOKEN ...
sudo ./svc.sh install && sudo ./svc.sh start
```

### Error FK al intentar borrar usuarios

Si se necesita limpiar todos los usuarios (ej: migrar de auth local a OIDC), hay FK que bloquean `DELETE FROM users`. Ver procedimiento completo en [docs/base-de-datos.md](base-de-datos.md#borrar-todos-los-usuarios-migración-de-auth).

Tablas que referencian `users`: `app_settings`, `client_quotes`, `quotes`, `slicing_jobs`, `model_files`. Nullear cada una por separado antes de borrar.

---

### Deploy falla con "Infisical login falló"

```bash
# Verificar que Infisical está corriendo
curl -sf http://127.0.0.1:8080/api/status && echo "OK"

# Si no responde, arrancarlo
systemctl --user start infisical

# Verificar que el Machine Identity tiene acceso al proyecto collectorsforge
# Infisical → collectorsforge → Access Control → Machine Identities
```

### PostgreSQL no arranca (puerto ocupado)

```bash
# Ver qué está usando el puerto 5432
sudo ss -tlnp | grep 5432

# Si hay un PostgreSQL local instalado (no en contenedor):
sudo systemctl stop postgresql
sudo systemctl disable postgresql

# Reintentar
systemctl --user start cfs-postgres
```

### Error "Permission denied" en volúmenes

```bash
# Verificar SELinux (Fedora/RHEL): la etiqueta :Z en los volúmenes lo maneja
# Si persiste:
podman unshare chown -R 999:999 ~/.local/share/containers/storage/volumes/cfs-pgdata/
```

---

## 11. MinIO en turtleStorage (Vault)

MinIO es el object storage del Vault de modelos `.3mf`. Corre en una máquina separada (`turtleStorage`) para aislar el almacenamiento del servidor de aplicación. La instalación es **manual** — no pasa por el pipeline de CI/CD.

### 10.1 Prerrequisitos en turtleStorage

```bash
# Verificar que Podman está instalado
podman --version

# Habilitar linger para que los servicios sobrevivan al logout
loginctl enable-linger $(whoami)
```

### 10.2 Instalar los Quadlets

```bash
# Crear directorio de Quadlets de usuario
mkdir -p ~/.config/containers/systemd/

# Copiar los archivos desde el repo (desde la Mac dev o turtleServer)
scp path/to/collectors-forge-studio/quadlet/cfs-minio.container \
    turtleStorage:~/.config/containers/systemd/

scp path/to/collectors-forge-studio/quadlet/cfs-minio-data.volume \
    turtleStorage:~/.config/containers/systemd/
```

### 10.3 Configurar variables de entorno

Crear `~/.env` en `turtleStorage`:

```bash
nano ~/.env
```

```bash
# Credenciales de MinIO (usuario root de la consola web)
MINIO_ROOT_USER=collectorsforge
MINIO_ROOT_PASSWORD=pon-una-password-segura
```

> Estas credenciales son las mismas que `MINIO_ACCESS_KEY` y `MINIO_SECRET_KEY` en el `.env` de `turtleServer`.

### 10.4 Arrancar MinIO

```bash
# Recargar systemd para que detecte los nuevos Quadlets
systemctl --user daemon-reload

# Iniciar MinIO
systemctl --user start cfs-minio

# Verificar que está corriendo
systemctl --user status cfs-minio
podman ps
```

### 10.5 Verificar que MinIO responde

```bash
# Health check (desde turtleStorage)
curl -sf http://localhost:9000/minio/health/live && echo "OK"

# Health check (desde turtleServer — verifica conectividad de red)
curl -sf http://turtleStorage:9000/minio/health/live && echo "OK"
```

> Si el hostname `turtleStorage` no resuelve desde `turtleServer`, agregar a `/etc/hosts` en `turtleServer`:
> ```
> <ip-de-turtleStorage>  turtleStorage
> ```

### 10.6 Bucket inicial

El backend crea el bucket `cfs-models` automáticamente al arrancar si no existe. No hay que crearlo manualmente.

Para verificar desde la consola web de MinIO (accesible desde la LAN):
```
http://turtleStorage:9001
```
Ingresar con `MINIO_ROOT_USER` y `MINIO_ROOT_PASSWORD`.

### 10.7 Variables necesarias en turtleServer

Agregar al `.env` de `turtleServer` (ya hecho):

```bash
MINIO_ENDPOINT=http://turtleStorage:9000
MINIO_ACCESS_KEY=collectorsforge
MINIO_SECRET_KEY=<mismo-valor-que-MINIO_ROOT_PASSWORD>
MINIO_BUCKET=cfs-models
VAULT_QUOTA_GB=100
```

Luego reiniciar el backend para que tome los nuevos valores:
```bash
systemctl --user restart cfs-backend
```

### 10.8 Gestión del servicio

```bash
# Reiniciar MinIO
systemctl --user restart cfs-minio

# Detener MinIO
systemctl --user stop cfs-minio

# Ver logs en tiempo real
journalctl --user -u cfs-minio -f

# Ver últimas 50 líneas
journalctl --user -u cfs-minio -n 50
```

### 10.9 Backup de objetos

Los archivos `.3mf` están en el volumen `cfs-minio-data`. Para hacer backup:

```bash
# Backup del volumen completo (desde turtleStorage)
podman volume export cfs-minio-data \
  > ~/backups/minio-data-$(date +%Y%m%d).tar

# Restaurar
podman volume import cfs-minio-data \
  ~/backups/minio-data-20260306.tar
```
