# T026 — Listings: seguridad / PII

**TARGET:** `app/backend/routers/listings.py`  
**LENTE:** seguridad / PII  
**Fecha:** 2026-07-06

---

## Resumen

Teléfono y correo del propietario bien ocultos en catálogo. El nombre de contacto sigue expuesto a cualquier usuario autenticado. Ownership consistente en mutaciones.

---

## Hallazgos

### [ALTO] · `contact_name` expuesto en catálogo público autenticado · `listings.py:154-172,267-268` — `_to_out(include_contact=False)` anula phone/email pero deja `contact_name` siempre. · Cualquier inquilino logueado recibe nombre real del propietario en GET `/listings`, favoritos y detalle ajeno. · Incluir `contact_name` solo con `include_contact=True` (dueño) o reemplazar por alias ("Propietario").

### [INFO] · `contact_phone` y `contact_email` ocultos a terceros · `listings.py:167-168` — `None` si no es dueño. · Verificado en bitácora Sprint 1. · OK (parcial hasta corregir contact_name).

### [INFO] · Dueño ve su PII en `/listings/mine` y detalle propio · `listings.py:270-277,341-346` — `include_contact=True` si `is_owner`. · OK.

### [INFO] · Ownership en mutaciones · `listings.py:322-323,358-359,390-392` — 404 uniforme (no revela IDs ajenos). · OK.

### [INFO] · Self-lead bloqueado · `listings.py:374-377` — 403. · Cerrado bitácora. · No re-reportar.

### [INFO] · `fair_value_ref` calculado server-side · `listings.py:82-117,299` — cliente no puede falsear veredicto. · Test `test_create_listing_no_acepta_fair_value_ref_del_cliente`. · OK.

### [MEDIO] · Leads almacenan PII del inquilino sin retención definida · `listings.py:365-383,399-418` — name/phone/email en tabla Lead; inbox agregado al dueño. · Correcto para el flujo; falta política de borrado (GDPR/retención). · Documentar TTL o borrado al eliminar listing (cascade ya limpia).

### [INFO] · Catálogo requiere autenticación · `listings.py:188-189` — no hay listado anónimo. · Reduce scraping público. · OK.

### [BAJO] · `GET /leads` sin chequeo de rol vendedor · `listings.py:399-418` — cualquier autenticado puede llamar; devuelve `[]` si no es dueño. · No filtra datos ajenos pero permite sondeo de endpoint. · Restringir a `SELLER_ROLES` → 403.

---

## Veredicto

**Mitigación parcial de PII (tel/email).** Corregir exposición de `contact_name` es el fix de mayor impacto inmediato.
