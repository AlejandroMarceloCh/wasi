"""Limiter compartido (slowapi) para proteger endpoints sensibles.

Vive en su propio módulo para que main.py y los routers lo importen sin ciclo.
Se desactiva con WASI_RATELIMIT=0 (los tests lo hacen: registran/loguean muchas
veces desde el mismo cliente y un límite real rompería la suite).
"""
import os

from slowapi import Limiter
from slowapi.util import get_remote_address

_ENABLED = os.environ.get("WASI_RATELIMIT", "1") == "1"

limiter = Limiter(key_func=get_remote_address, enabled=_ENABLED)
