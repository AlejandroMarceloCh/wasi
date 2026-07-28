# T032 — Listings: contrato ListingOut / InboxLeadOut ↔ frontend

**TARGET:** `app/backend/routers/listings.py`  
**LENTE:** contrato  
**Fecha:** 2026-07-06

---

## Resumen

`ListingOut` e `InboxLeadOut` cubren lo que consumen Explorar, publicar, favoritos y bandeja de leads. Desajustes menores en PII expuesta y tope de precio en PATCH.

---

## Hallazgos

### [INFO] · `ListingOut` — campos usados en catálogo/detalle · `screens-listings.jsx` — `id`, `operacion`, `price_usd`, `zone`, `district`, `address`, `lat/lng`, `area_m2`, dormitorios/baños, `amenities`, `image_url`, `status`, `created_at`. · Router deriva `zone` server-side. · OK.

### [ALTO] · Contrato expone `contact_name` al catálogo · `listings.py:166` + `schemas.py:446` — frontend no lo renderiza hoy, pero el JSON llega a cualquier cliente autenticado. · Rompe expectativa de "PII oculta en catálogo" (bitácora Sprint 1). · Ajustar schema: `contact_name: Optional` null para no-dueño.

### [INFO] · Paginación `listListingsPaged` · `api.js:237-243`, `listings.py:267` — array en body + `X-Total-Count`. · Sprint 3 UI consume `{data, total}`. · OK.

### [INFO] · Filtro `operacion` · `screens-listings.jsx:509,519` ↔ `listings.py:177-178,217-218`. · Valores `alquiler`/`venta`. · OK.

### [INFO] · `createListing` / `updateListing` · `api.js:247-248`, `screens-seller.jsx:226-239,541` — `ListingIn` completo en POST; PATCH parcial `ListingUpdateIn`. · Backend ignora campos extra del cliente en create (`fair_value_ref`). · OK.

### [INFO] · `InboxLeadOut` ↔ `LeadsScreen` · `screens-seller.jsx:819-827` — mapea `listing_address`, `listing_district`, `listing_operacion`, lead PII, `created_at` ISO con Z (serializer Sprint 0). · Un request agregado reemplaza N+1. · OK.

### [MEDIO] · `ListingUpdateIn.price_usd` le=5M para cualquier operación · `schemas.py:388` — frontend PATCH solo envía precio/estado (`screens-seller.jsx:541`). · Alquiler podría patcharse por encima de $50k sin error 422. · Validar según `operacion` del listing.

### [INFO] · `LeadOut` en flujo contactar · `screens-listings.jsx:24-27` — POST lead con name/phone/email/message. · `LeadIn` alinea. · OK.

### [INFO] · Favoritos devuelven `ListingOut` completo · `listings.py:421-488` — incluye `zone` para badge. · `screens-listings.jsx:548-550` usa solo `id`. · OK.

### [BAJO] · Home gangas usa `listListings` sin `meta` · `screens-home.jsx:418` — `zone=Ganga&sort=ganga&limit=3`; no lee total. · Suficiente para top-3; dispara path O(n) del backend (T025). · Aceptable con límite 3 si se optimiza backend.

---

## Veredicto

**Contrato funcional para flujos actuales.** Cerrar exposición de `contact_name` y validación de precio en PATCH alinea API con la política de privacidad declarada.
