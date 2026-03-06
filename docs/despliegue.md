# Guía de Despliegue — TurtleForge Studio

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
git clone git@github.com:GiomarOsorio/Calculator3D.git ~/Calculator3D
cd ~/Calculator3D
```

> Si el servidor no tiene clave SSH configurada para GitHub, usar HTTPS:
> ```bash
> git clone https://github.com/GiomarOsorio/Calculator3D.git ~/Calculator3D
> ```

### 1.3 Configurar variables de entorno

El script `deploy.sh` busca el archivo de variables en:
1. `~/Calculator3DENV` (recomendado — fuera del repo)
2. `$DEPLOY_PATH/.env` (fallback)

```bash
# Opción recomendada: fuera del repo
cp ~/Calculator3D/.env.example ~/Calculator3DENV
nano ~/Calculator3DENV
```

Completar el archivo:

```bash
# ── Obligatorias ──────────────────────────────────────────────
# Clave JWT (CAMBIAR — generar con: openssl rand -hex 32)
SECRET_KEY=pega-aqui-el-resultado-de-openssl

# Contraseña de PostgreSQL (CAMBIAR)
POSTGRES_PASSWORD=pon-una-password-segura

# Credenciales del usuario admin inicial
ADMIN_USERNAME=turtleAdmin
ADMIN_PASSWORD=pon-una-password-segura
ADMIN_EMAIL=tu@email.com

# ── Cloudflare Tunnel ─────────────────────────────────────────
# Obtener en: https://one.dash.cloudflare.com → Networks → Tunnels
# Si no se configura, la app solo estará en http://localhost:3000
TUNNEL_TOKEN=eyJhIjoiNGY...tu-token-aqui

# ── Opcionales (tienen defaults razonables) ───────────────────
POSTGRES_USER=turtleforge
POSTGRES_DB=turtleforge
POSTGRES_HOST=calculator3d-postgres
POSTGRES_PORT=5432
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
```

Generar `SECRET_KEY`:
```bash
openssl rand -hex 32
```

### 1.4 Ejecutar el deploy

```bash
cd ~/Calculator3D
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
11. Arranca el tunnel (si `TUNNEL_TOKEN` está definido)

**Salida esperada al final:**
```
=== Deploy completo ===
App disponible en: https://3d.turtlenode.dev
```

### 1.5 Verificar que todo está corriendo

```bash
# Ver servicios activos
systemctl --user status calculator3d-postgres
systemctl --user status calculator3d-backend
systemctl --user status calculator3d-frontend
systemctl --user status calculator3d-slicer
systemctl --user status calculator3d-tunnel

# Ver todos los contenedores
podman ps

# Verificar backend directamente
curl http://localhost:8000/api/health
# {"status":"ok","app":"TurtleForge Cost"}
```

---

## 2. Actualización (después de git push)

El CI/CD actualiza automáticamente vía el self-hosted runner. Si necesitas actualizar manualmente:

```bash
cd ~/Calculator3D
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
  --url https://github.com/GiomarOsorio/Calculator3D \
  --token TU_TOKEN_AQUI \
  --name turtleforge-prod \
  --unattended

# Instalar como servicio systemd
sudo ./svc.sh install
sudo ./svc.sh start
```

### 3.3 Verificar estado del runner

```bash
sudo ./svc.sh status
# ● actions.runner.GiomarOsorio-Calculator3D.turtleforge-prod.service
#    Active: active (running) ✓

# Ver logs del runner
journalctl -u actions.runner.GiomarOsorio-Calculator3D.turtleforge-prod -n 50
```

### 3.4 Reiniciar el runner (si se cae)

```bash
cd ~/actions-runner
sudo ./svc.sh start
```

### 3.5 GitHub SSH a través del puerto 443

Si el servidor no puede conectar a GitHub por el puerto 22 (SSH), configurar `~/.ssh/config`:

```
Host github.com
    Hostname ssh.github.com
    Port 443
    User git
```

---

## 4. Configurar Cloudflare Tunnel

### 4.1 Crear el Tunnel

1. Ir a [one.dash.cloudflare.com](https://one.dash.cloudflare.com)
2. **Networks → Tunnels → Create a tunnel**
3. Tipo: **Cloudflared** — Nombre: `turtleforge`
4. Copiar el token que aparece

### 4.2 Configurar public hostname

| Campo | Valor |
|---|---|
| Subdomain | `3d` |
| Domain | `turtlenode.dev` |
| Type | `HTTP` |
| URL | `calculator3d-frontend:80` |

### 4.3 Proteger con Cloudflare Access (recomendado)

1. **Access → Applications → Add an application → Self-hosted**
2. Application domain: `3d.turtlenode.dev`
3. Política: solo tu email
4. Método: One-time PIN (gratis hasta 50 usuarios)

---

## 5. Reinicio de servicios

### Reiniciar un servicio individual

```bash
systemctl --user restart calculator3d-backend
systemctl --user restart calculator3d-frontend
systemctl --user restart calculator3d-postgres
systemctl --user restart calculator3d-slicer
systemctl --user restart calculator3d-tunnel
```

### Reiniciar todo el stack

```bash
systemctl --user restart \
  calculator3d-postgres \
  calculator3d-backend \
  calculator3d-slicer \
  calculator3d-frontend \
  calculator3d-tunnel
```

### Detener todo el stack

```bash
systemctl --user stop \
  calculator3d-tunnel \
  calculator3d-frontend \
  calculator3d-slicer \
  calculator3d-backend \
  calculator3d-postgres
```

### Ver logs en tiempo real

```bash
# Backend
journalctl --user -u calculator3d-backend -f

# PostgreSQL
journalctl --user -u calculator3d-postgres -f

# Slicer
journalctl --user -u calculator3d-slicer -f

# Tunnel
journalctl --user -u calculator3d-tunnel -f

# Últimas 100 líneas del backend
journalctl --user -u calculator3d-backend -n 100
```

---

## 6. Gestión de la base de datos

### Conectar a PostgreSQL

```bash
# Shell interactivo
podman exec -it calculator3d-postgres \
  psql -U turtleforge -d turtleforge

# Ejecutar una consulta directa
podman exec calculator3d-postgres \
  psql -U turtleforge -d turtleforge -c "SELECT * FROM alembic_version;"
```

### Verificar la versión de migración actual

```bash
podman exec calculator3d-postgres \
  psql -U turtleforge -d turtleforge \
  -c "SELECT version_num FROM alembic_version;"
```

### Aplicar migraciones manualmente

```bash
# Ejecutar en el contenedor backend existente
podman exec calculator3d-backend \
  alembic upgrade head

# O en un contenedor temporal (más seguro si backend no está corriendo)
source ~/Calculator3DENV
podman run --rm \
  --network calculator3d \
  --env-file ~/Calculator3DENV \
  -e ALGORITHM=HS256 \
  -e ACCESS_TOKEN_EXPIRE_MINUTES=1440 \
  localhost/calculator3d-backend:latest \
  alembic upgrade head
```

### Backup de PostgreSQL

```bash
# Backup completo
podman exec calculator3d-postgres \
  pg_dump -U turtleforge turtleforge \
  > ~/backups/turtleforge-$(date +%Y%m%d-%H%M%S).sql

# Backup comprimido
podman exec calculator3d-postgres \
  pg_dump -U turtleforge -Fc turtleforge \
  > ~/backups/turtleforge-$(date +%Y%m%d-%H%M%S).dump
```

### Restaurar un backup

```bash
# Desde SQL
cat ~/backups/turtleforge-20260228.sql | \
  podman exec -i calculator3d-postgres \
  psql -U turtleforge -d turtleforge

# Desde dump comprimido
podman exec -i calculator3d-postgres \
  pg_restore -U turtleforge -d turtleforge \
  < ~/backups/turtleforge-20260228.dump
```

### Backup automático diario (crontab)

```bash
crontab -e
# Agregar:
0 2 * * * mkdir -p ~/backups && podman exec calculator3d-postgres pg_dump -U turtleforge -Fc turtleforge > ~/backups/turtleforge-$(date +\%Y\%m\%d).dump 2>> ~/backups/backup.log
```

### Copiar archivos estáticos (logos, imágenes)

```bash
# Backup de imágenes
podman cp calculator3d-backend:/app/static ~/backups/static-$(date +%Y%m%d)

# Restaurar
podman cp ~/backups/static-20260228/. calculator3d-backend:/app/static/
```

---

## 7. Rollback

### Rollback de código

```bash
cd ~/Calculator3D

# Ver historial de commits
git log --oneline -10

# Volver a un commit anterior
git checkout <commit-hash>
./deploy.sh
```

### Rollback de migración de base de datos

```bash
# Ver historial de migraciones
podman exec calculator3d-backend alembic history

# Bajar una migración
podman exec calculator3d-backend alembic downgrade -1

# Bajar a una versión específica
podman exec calculator3d-backend alembic downgrade f7a8b9c0d1e2
```

> **Importante:** Hacer un backup de la BD antes de cualquier downgrade. Algunas migraciones eliminan columnas y el rollback puede perder datos.

---

## 8. Migración a otro servidor

### 8.1 En el servidor origen

```bash
# 1. Backup de la base de datos
mkdir -p ~/migration-backup
podman exec calculator3d-postgres \
  pg_dump -U turtleforge -Fc turtleforge \
  > ~/migration-backup/turtleforge.dump

# 2. Backup de archivos estáticos
podman cp calculator3d-backend:/app/static ~/migration-backup/static

# 3. Copiar variables de entorno
cp ~/Calculator3DENV ~/migration-backup/Calculator3DENV

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
git clone git@github.com:GiomarOsorio/Calculator3D.git ~/Calculator3D

# 2. Restaurar variables de entorno
cp ~/migration-backup/Calculator3DENV ~/Calculator3DENV

# 3. Levantar solo PostgreSQL primero
source ~/Calculator3DENV
podman run -d \
  --name calculator3d-postgres \
  --network calculator3d \
  -v calculator3d-pgdata:/var/lib/postgresql/data:Z \
  -e POSTGRES_DB=${POSTGRES_DB:-turtleforge} \
  -e POSTGRES_USER=${POSTGRES_USER:-turtleforge} \
  -e POSTGRES_PASSWORD=$POSTGRES_PASSWORD \
  docker.io/postgres:16-alpine

# Esperar a que esté listo
sleep 10
podman exec calculator3d-postgres pg_isready -U turtleforge

# 4. Restaurar el dump
cat ~/migration-backup/turtleforge.dump | \
  podman exec -i calculator3d-postgres \
  pg_restore -U turtleforge -d turtleforge

# 5. Deploy completo
cd ~/Calculator3D
./deploy.sh

# 6. Restaurar archivos estáticos
podman cp ~/migration-backup/static/. calculator3d-backend:/app/static/
```

---

## 9. Diagnóstico de problemas comunes

### El backend no inicia

```bash
journalctl --user -u calculator3d-backend -n 50

# Causas frecuentes:
# - PostgreSQL no está listo aún (esperar y reintentar)
# - Variable de entorno faltante (revisar Calculator3DENV)
# - Error en migración Alembic (ver logs de deploy.sh)
```

### "alembic upgrade head" falla

```bash
# Ver versión actual en BD
podman exec calculator3d-postgres \
  psql -U turtleforge -d turtleforge \
  -c "SELECT * FROM alembic_version;"

# Ver migraciones disponibles
podman exec calculator3d-backend alembic history

# Si la BD está corrupta, restaurar desde backup y reintentar
```

### El tunnel no conecta

```bash
journalctl --user -u calculator3d-tunnel -n 50

# Causas:
# - TUNNEL_TOKEN inválido o expirado (generar nuevo en Cloudflare)
# - Frontend no está corriendo (tunnel depende de él)
# - Sin acceso a internet en el servidor
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

### PostgreSQL no arranca (puerto ocupado)

```bash
# Ver qué está usando el puerto 5432
sudo ss -tlnp | grep 5432

# Si hay un PostgreSQL local instalado (no en contenedor):
sudo systemctl stop postgresql
sudo systemctl disable postgresql

# Reintentar
systemctl --user start calculator3d-postgres
```

### Error "Permission denied" en volúmenes

```bash
# Verificar SELinux (Fedora/RHEL): la etiqueta :Z en los volúmenes lo maneja
# Si persiste:
podman unshare chown -R 999:999 ~/.local/share/containers/storage/volumes/calculator3d-pgdata/
```

---

## 10. MinIO en turtleStorage (Vault)

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
scp path/to/Calculator3D/quadlet/calculator3d-minio.container \
    turtleStorage:~/.config/containers/systemd/

scp path/to/Calculator3D/quadlet/calculator3d-minio-data.volume \
    turtleStorage:~/.config/containers/systemd/
```

### 10.3 Configurar variables de entorno

Crear `~/.env` en `turtleStorage`:

```bash
nano ~/.env
```

```bash
# Credenciales de MinIO (usuario root de la consola web)
MINIO_ROOT_USER=turtleforge
MINIO_ROOT_PASSWORD=pon-una-password-segura
```

> Estas credenciales son las mismas que `MINIO_ACCESS_KEY` y `MINIO_SECRET_KEY` en el `.env` de `turtleServer`.

### 10.4 Arrancar MinIO

```bash
# Recargar systemd para que detecte los nuevos Quadlets
systemctl --user daemon-reload

# Iniciar MinIO
systemctl --user start calculator3d-minio

# Verificar que está corriendo
systemctl --user status calculator3d-minio
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

El backend crea el bucket `turtleforge-models` automáticamente al arrancar si no existe. No hay que crearlo manualmente.

Para verificar desde la consola web de MinIO (accesible desde la LAN):
```
http://turtleStorage:9001
```
Ingresar con `MINIO_ROOT_USER` y `MINIO_ROOT_PASSWORD`.

### 10.7 Variables necesarias en turtleServer

Agregar al `.env` de `turtleServer` (ya hecho):

```bash
MINIO_ENDPOINT=http://turtleStorage:9000
MINIO_ACCESS_KEY=turtleforge
MINIO_SECRET_KEY=<mismo-valor-que-MINIO_ROOT_PASSWORD>
MINIO_BUCKET=turtleforge-models
VAULT_QUOTA_GB=100
```

Luego reiniciar el backend para que tome los nuevos valores:
```bash
systemctl --user restart calculator3d-backend
```

### 10.8 Gestión del servicio

```bash
# Reiniciar MinIO
systemctl --user restart calculator3d-minio

# Detener MinIO
systemctl --user stop calculator3d-minio

# Ver logs en tiempo real
journalctl --user -u calculator3d-minio -f

# Ver últimas 50 líneas
journalctl --user -u calculator3d-minio -n 50
```

### 10.9 Backup de objetos

Los archivos `.3mf` están en el volumen `calculator3d-minio-data`. Para hacer backup:

```bash
# Backup del volumen completo (desde turtleStorage)
podman volume export calculator3d-minio-data \
  > ~/backups/minio-data-$(date +%Y%m%d).tar

# Restaurar
podman volume import calculator3d-minio-data \
  ~/backups/minio-data-20260306.tar
```
