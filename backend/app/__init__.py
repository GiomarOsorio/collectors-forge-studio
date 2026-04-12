"""
Paquete principal de la aplicación collectors-forge-studio.

collectors-forge-studio es una API REST construida con FastAPI para calcular y gestionar
cotizaciones de impresión 3D. Organiza el código en los siguientes subpaquetes:

- models:   Modelos ORM de SQLAlchemy (tablas de la base de datos).
- schemas:  Esquemas Pydantic para validación y serialización de datos HTTP.
- routers:  Endpoints FastAPI agrupados por recurso (auth, filaments, etc.).
- services: Lógica de negocio desacoplada de la capa HTTP (auth, calculator, pdf).
"""
