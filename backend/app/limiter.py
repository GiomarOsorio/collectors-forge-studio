"""
Instancia global del rate limiter para TurtleForge Cost.

Se define en un módulo separado para evitar importaciones circulares entre
main.py (donde se registra el handler) y los routers que usan el decorador.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

# Limiter con clave por dirección IP del cliente
limiter = Limiter(key_func=get_remote_address)
