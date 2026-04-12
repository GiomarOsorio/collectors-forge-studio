"""
Paquete de servicios de collectors-forge-studio.

Contiene la lógica de negocio de la aplicación, desacoplada de la capa de
transporte HTTP. Cada servicio es responsable de una área funcional específica
y puede ser importado y probado de forma independiente.

Módulos disponibles:
- auth:          Hashing de contraseñas, creación/validación de tokens JWT
                 y dependencias de FastAPI para autenticación/autorización.
- calculator:    Motor de cálculo de costos de impresión 3D. Implementa la
                 fórmula de desglose de costos por componente.
- pdf_generator: Generación de documentos PDF para cotizaciones usando
                 ReportLab. Opera completamente en memoria sin archivos temp.
"""
