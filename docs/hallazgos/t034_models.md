# T034 — Models: integridad (relaciones, cascades, nullability, índices)

**TARGET:** `app/backend/models.py`  
**LENTE:** integridad  
**Fecha:** 2026-07-06

---

## Resumen

Cascades correctos en `Lead`, `Favorite` y `AnalysisFactor`. Las FKs del grafo `User→Analysis/Listing/Report` y `Analysis→Property` carecen de `ON DELETE`, y faltan índices en columnas de filtro frecuente del catálogo.

---

## Hallazgos

### [ALTO] · FKs de `User` sin `ON DELETE` hacia hijos transaccionales · `models.py:65,102,116` — `analyses.user_id`, `reports.user_id`, `listings.owner_id` sin cascade ni `SET NULL`. · Borrar un usuario (GDPR, admin, script) falla con `IntegrityError` o exige borrado manual en orden; no hay política definida. · Definir `ondelete="CASCADE"` o soft-delete; documentar orden de limpieza.

### [MEDIO] · Sin índice en `listings.operacion` ni `listings.status` · `models.py:117-137` — solo `owner_id` indexado. · Filtros `operacion=alquiler|venta` y `status='activo'` en cada request del catálogo hacen seq scan en Postgres con miles de filas. · `Index("ix_listings_operacion_status", operacion, status)` o índice compuesto según queries.

### [MEDIO] · `Property` huérfana al no tener cascade desde `Analysis` · `models.py:66,60` — `analysis.property_id` FK sin `ondelete`; `Property` no se elimina nunca. · Cada `predict` crea un `Property`; el historial crece sin reclamación (storage creep). · `ondelete="CASCADE"` en `Analysis→Property` o job de limpieza de properties sin análisis.

### [MEDIO] · `Report.analysis_id` sin `ON DELETE CASCADE` · `models.py:103-104` — FK a `analyses.id` sin `ondelete`. · Si se borrara un análisis, el reporte quedaría colgando o bloquearía el delete. · `ondelete="CASCADE"` o restringir delete de análisis con reporte.

### [INFO] · Cascades en leads y favoritos · `models.py:141-144,151,171-173` — `Lead` y `Favorite` con `ondelete="CASCADE"`. · Borrar listing limpia leads/favoritos; coherente con `delete_listing`. · OK.

### [INFO] · `operacion` NOT NULL con default retrocompatible · `models.py:117-118` — `default="alquiler"`, `server_default="alquiler"`. · Alineado con migración y sembrados. · OK (ver T042).

### [INFO] · `Favorite` con `UniqueConstraint(user_id, listing_id)` · `models.py:166-168` — idempotencia a nivel BD. · Evita duplicados de guardados. · OK.

### [INFO] · `image_url` como `Text` · `models.py:132` — soporta base64 largo en Postgres. · Resuelto en Sprint 1. · No re-reportar.

### [BAJO] · `District` desacoplado de `Listing` · `models.py:34-41` — sin FK; `listings_count` es snapshot del seed. · Conteos del dashboard pueden desincronizarse del catálogo real. · Job de refresh o derivar counts con query.

---

## Veredicto

Integridad referencial incompleta en el eje usuario/análisis. Priorizar índices en `listings(operacion, status)` y política de borrado en `User`.
