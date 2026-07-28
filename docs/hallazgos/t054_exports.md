# T054 — Exports públicos: `features/__init__.py` y `models/__init__.py`

**TARGET:** `src/wasi/features/__init__.py` + `src/wasi/models/__init__.py`  
**LENTE:** exports  
**Fecha:** 2026-07-06

---

## Resumen

Ambos `__init__.py` están **vacíos**. No hay re-exports ni `__all__`. Todo el codebase importa submódulos explícitos (`from wasi.models.ml import predict_fair_value`) — **coherente internamente** pero sin API pública documentada del paquete.

---

## Hallazgos

### [MEDIO] · `features/__init__.py` vacío · Archivo existe sin contenido. · Consumidores deben conocer rutas internas (`geo_index`, `osm_lookup`, etc.). · Definir API pública mínima, p.ej. re-export `geo_lookup`, `get_osm`, `get_distrito_features`, `get_display_pois`.

### [MEDIO] · `models/__init__.py` vacío · Idem para `model_service`, `ml.predict_fair_value`, `venta_service`, `get_comparables_service`. · Riesgo de imports circulares si se re-exporta sin cuidado (`ml` ↔ `model_service`). · `__all__` lazy o exports de solo instancias singleton.

### [INFO] · Imports directos consistentes en backend · Grep: routers/tests/scripts usan paths completos, no `from wasi.models import *`. · Sin ambigüedad hoy. · OK.

### [INFO] · `test_no_quedan_imports_o_rutas_obsoletas` · Valida que scripts no usen imports legacy sin prefijo `wasi.`. · Convención de migración respetada. · OK.

### [BAJO] · Sin versión de paquete en `wasi/__init__.py` · (no auditado aquí en detalle). · Health expone `model_service.version` por separado. · Opcional `wasi.__version__`.

### [BAJO] · Duplicación de constantes (`ZONE_BAND_PCT`, `AMENITY_CHIPS`) entre `ml.py` y `ml_v2.py` / `venta_service.py` · No es export issue pero fragmenta contrato público. · Centralizar en `wasi.constants` si se formaliza API.

---

## Veredicto

**Exports implícitos funcionan** porque el monorepo controla todos los call sites. Para librería reutilizable o SDK externo, conviene **documentar y re-exportar** entry-points estables en los `__init__.py`.
