# T097 — Flujo publicar (alquiler + venta): e2e

**TARGET:** `app/screens-seller.jsx` + `app/app.jsx` + contrato `api.js`  
**LENTE:** e2e (código + QA manual)  
**Fecha:** 2026-07-06  
**Browser:** no ejecutado en esta auditoría — hallazgos inferidos del código y gaps de QA manual explícitos.

---

## Resumen

El flujo publicar está production-grade en papel (Sprint 2): operación alquiler/venta, pin obligatorio, validación inline, borrador, PATCH en mis avisos. Sin click-through en navegador quedan fricciones en borrador, post-publicación y límites de área vs FairValue.

---

## Flujo documentado (happy path)

1. Usuario **Propietario/Agente** → nav **Mis propiedades** o CTA publicar → `screen = publish`.
2. Elige **Alquiler** o **Venta** → rangos de precio/área y modelo de referencia cambian (`OP_CFG`, `calcular` → `simulate` vs `predictVenta`).
3. Ubica pin en mapa o buscador → reverse Nominatim rellena distrito/dirección sin pisar campos manuales.
4. Completa contacto + foto opcional → **Calcular referencia** → **Publicar** → `Api.createListing` con `operacion`.
5. Éxito → borrador borrado → redirige a `mis-publicaciones` (no al detalle).

**Inquilino:** pantalla bloqueada con copy para cambiar rol en perfil (`screens-seller.jsx:250-269`).

---

## Hallazgos

### [MEDIO] · Borrador no restaura `operacion` · `screens-seller.jsx:37-46,76-79` — guarda `{ f, operacion }` pero al leer solo aplica `d.f`. · Tras refresh en medio de un borrador de **venta**, el form vuelve a alquiler (rangos y modelo equivocados). · Ver T080; fix de una línea al restaurar. · **QA manual:** guardar borrador en venta, F5, confirmar selector.

### [MEDIO] · Post-publicar no muestra el aviso creado · `app.jsx:249` — `onPublished` → `mis-publicaciones`. · El vendedor no valida foto, precio ni veredicto en detalle sin buscar la fila. · Redirigir a `listing-detail` del `id` devuelto. · **QA manual:** publicar y confirmar si el usuario encuentra su aviso sin fricción.

### [MEDIO] · Área máxima venta 2000 m² en publicar vs 1000 m² en FairValue · `screens-seller.jsx:160` vs `screens-fairvalue.jsx:59`. · Inmueble grande publicable pero no re-estimable con el mismo tope en analizar. · Alinear constantes. · **QA manual:** venta 1500 m² publicar OK, luego analizar precio del mismo.

### [MEDIO] · Counterfactual solo en alquiler al publicar · `screens-seller.jsx:196-203` — venta no muestra palancas “qué pasa si…”. · Coherente con API, pero la UI de venta se siente incompleta vs alquiler. · Nota en UI o panel venta v2.

### [BAJO] · Preview de zona con umbrales 8% hardcode distintos al backend · `screens-seller.jsx:481-483` — `0.92/1.08` vs `ZONE_BAND_PCT` global. · Preview puede decir Ganga y el backend Justo al publicar. · T080. · **QA manual:** comparar tag preview vs badge en mis avisos.

### [BAJO] · Amenities visibles en venta sin efecto en referencia · `screens-seller.jsx:180-187`. · Usuario marca piscina, referencia no cambia. · Copy “no afectan modelo venta v1”.

### [INFO] · Form production-grade (fotos, pin, PATCH, tildes) · Sprint 2. · No re-reportar.

### [INFO] · Errores API humanos · Sprint 0. · No re-reportar.

### [INFO] · `operacion` en POST · Sprint 1–2. · No re-reportar.

---

## Gaps de QA manual (no automatizado)

| Paso | Qué probar | Riesgo si falla |
|------|------------|-----------------|
| Pin + arrastre | Colocar pin en Breña/Jesús María con tildes | 422 distrito (cerrado S1; revalidar) |
| Foto HEIC / >12 MB | iPhone real | Mensaje claro vs crash |
| Nominatim lento | Salir de publicar antes de que responda | setState en componente muerto (T080) |
| Publicar venta $250k | `fair_value_ref` modelo venta | Referencia alquiler por error |
| Editar precio inline | PATCH fuera de rango | 422 sin mensaje inline (T080) |
| Pausar / activar | Estado en catálogo | Aviso pausado visible a terceros |

---

## Top 3 ROI

1. **Restaurar `operacion` en borrador** — evita publicaciones venta con formulario alquiler tras F5.
2. **Redirigir al detalle post-publicar** — cierra el loop y muestra veredicto al instante.
3. **QA manual foto + pin en móvil real** — único camino para validar lo que Babel/boot no cubre.

---

## Veredicto

Publicar es **usable de punta a punta** con backend verificado en Sprints 1–2. Los bugs restantes son de continuidad (borrador, redirect) y validación táctil no automatizada.
