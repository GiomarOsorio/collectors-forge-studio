# Security Policy

## Reportar una vulnerabilidad

Si encuentras una vulnerabilidad de seguridad en Collector's Forge Studio,
por favor repórtala de forma responsable.

**Por favor NO reportes vulnerabilidades de seguridad a través de un issue público de GitHub.**

En su lugar, repórtala por email a:

**giosorio30@gmail.com**

### Qué incluir en el reporte

- Descripción de la vulnerabilidad
- Pasos para reproducirla
- Impacto potencial
- Sugerencias de corrección (si las tienes)

### Qué esperar

- **Confirmación de recepción**: dentro de 48 horas
- **Evaluación**: dentro de 7 días
- **Corrección**: se prioriza según severidad; no hay SLA formal — este es
  un proyecto de un estudio pequeño, no un producto con soporte comercial

## Versiones soportadas

Este proyecto no versiona releases formales — se despliega directo desde
`main` a producción vía CI/CD. Solo la última versión desplegada recibe
correcciones de seguridad.

## Consideraciones de seguridad

### Autenticación

- Login vía OIDC (PKCE) con el proveedor configurado, o usuario/contraseña
  local (bcrypt) si no hay OIDC configurado.
- Roles: `admin` | `operator` | `viewer`, con permisos crecientes.
- Sesiones vía JWT.

### Almacenamiento

- Postgres para datos estructurados.
- MinIO (S3-compatible) para archivos del Vault (`.3mf` / `.gcode.3mf`).
- Variables sensibles (`SECRET_KEY`, credenciales de BD/MinIO, OIDC client
  secret) se leen de variables de entorno — nunca hardcodeadas en el
  código ni committeadas.

### Recomendaciones para quien lo despliegue

1. **No exponer directamente a internet** sin un reverse proxy con HTTPS.
2. **Rotar `SECRET_KEY`** si sospechas que se filtró.
3. **Mantener actualizado** — revisar el workflow de seguridad de CI
   (`security.yml`) que corre semanalmente sobre dependencias.
4. **Backups de Postgres** antes de cualquier migración en producción.

## Alcance

**En alcance** para reportes de seguridad:

- Bypass de autenticación/autorización
- Inyección SQL
- XSS / CSRF
- Exposición de datos sensibles (credenciales, tokens, datos de clientes)
- Path traversal en el manejo de archivos del Vault
- SSRF en el fetch de metadata externa (MakerWorld/Printables)

**Fuera de alcance**:

- Vulnerabilidades en dependencias de terceros (repórtalas al proyecto upstream)
- Ataques que requieran acceso físico al servidor
- Ingeniería social

---

Gracias por ayudar a mantener seguro este proyecto.
