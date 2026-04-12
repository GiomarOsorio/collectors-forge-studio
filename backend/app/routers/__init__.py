"""
Paquete de routers de la API collectors-forge-studio.

Contiene los módulos de enrutamiento FastAPI organizados por recurso. Cada
módulo define un APIRouter con su propio prefijo de URL y etiquetas para la
documentación automática de Swagger/OpenAPI.

Módulos disponibles:
- auth:      Autenticación y gestión de usuarios (/api/auth).
- filaments: CRUD de filamentos de impresión (/api/filaments).
- printers:  CRUD de impresoras 3D (/api/printers).
- settings:  Configuración de la aplicación por usuario (/api/settings).
- quotes:    Cálculo y gestión de cotizaciones (/api/quotes).
"""
