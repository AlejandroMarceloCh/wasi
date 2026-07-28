# T051 — distritos_lima_features: consistencia de nombres y tildes

**TARGET:** `src/wasi/features/distritos_lima_features.py`  
**LENTE:** correctitud  
**Fecha:** 2026-07-06

---

## Resumen

`_norm()` elimina tildes y unifica mayúsculas — **alinea** “Jesús María” con la entrada `Jesus Maria` de la tabla y con `_same_district` del backend (Sprint 1). Duplicados intencionales (Surco / Santiago de Surco, Lima / Cercado de Lima) cubren variantes del dataset geo.

---

## Hallazgos

### [INFO] · Normalización NFKD + ASCII · `distritos_lima_features.py:89-94` — `Jesús María`, `Jesus Maria`, `JESUS MARIA` → misma clave. · Publicar con tilde y geo sin tilde convergen. · Cerrado bitácora Sprint 1 — no re-reportar flujo listings.

### [INFO] · Entradas duplicadas con distinto nombre oficial · `distritos_lima_features.py:36-37` (Surco / Santiago de Surco), `51-52` (Lima / Cercado de Lima) — mismo estrato, `_norm` distinto. · `geo_lookup` devuelve string del CSV (`Santiago de Surco` en tests); lookup por `_norm` acierta en ambos. · OK.

### [MEDIO] · Tabla sin tildes en strings almacenados · `distritos_lima_features.py:41` (`Jesus Maria`), `53` (`Brena`), `80` (`Rimac`) — UI puede mostrar nombre sin tilde si toma literal de geo. · Cosmético; no rompe features. · Opcional: canonical display name map.

### [INFO] · `attach_features` warning + default · `distritos_lima_features.py:116-120` — distritos fuera de tabla → estrato=2, popular. · Test cobertura dataset en `test_attach_features_cobertura_dataset_real`. · OK.

### [BAJO] · Callao y distritos balnearios en tabla · `distritos_lima_features.py:57-68` — incluidos aunque cobertura de listings sea menor. · Defaults si geo devuelve nombre no listado. · Monitorear distritos con warning en attach.

### [INFO] · Limitación heterogeneidad intra-distrito documentada · `distritos_lima_features.py:19-24` — estrato dominante vs La Planicie. · Mitigado parcialmente por IDW geo. · Deuda conocida; no fix corto.

---

## Veredicto

**Matching con tildes robusto** vía `_norm`. No hay bug activo en el cruce geo ↔ NSE; mejoras son **display** y **distritos faltantes**.
