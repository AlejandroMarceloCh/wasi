# T046 — venta_service: carga, predicción y bordes

**TARGET:** `src/wasi/models/venta_service.py`  
**LENTE:** correctitud  
**Fecha:** 2026-07-06

---

## Resumen

Patrón de degradación limpia cuando falta el bundle (**503** en router, fallback a comparables en listings). La predicción reusa `geo_lookup` con paridad geo documentada en T017. Sin validaciones fail-fast tipo manifest/golden; bordes numéricos y defensa interna débiles.

---

## Hallazgos

### [INFO] · Bundle ausente → servicio deshabilitado · `venta_service.py:39-41,50-51` — log y `is_loaded()=False`; `main.py:44-47` captura excepciones de load. · No tumba el backend de alquiler. · OK; bitácora Sprint 1.

### [INFO] · Router y listings guardan con `is_loaded()` · `fairvalue.py:178-181`, `listings.py:92-104` — 503 o fallback comparables. · Camino producción cubierto. · OK.

### [MEDIO] · `predict()` sin guard interno · `venta_service.py:53-73` — si `_features` es None, `pd.DataFrame([row])[self._features]` → `TypeError`. · Scripts/tests que llamen directo fallan opaco. · `if not self.is_loaded(): raise RuntimeError(...)` al inicio de `predict`.

### [MEDIO] · Sin validación de integridad del bundle (hash/golden) · `venta_service.py:38-48` — solo `joblib.load`; unlike `model_service`. · Swap parcial del `.joblib` en deploy puede servir predicciones incorrectas. · Reusar patrón manifest+golden de alquiler en `ventas_model/`.

### [MEDIO] · Features geo: omisión silenciosa → NaN · `venta_service.py:58-65` — `row = {c: geo[c] for c in self._features if c in geo}`; columnas faltantes quedan NaN en el DataFrame. · XGBoost puede devolver basura o error según versión. · Assert “todas las columnas geo presentes” post `geo_lookup`.

### [MEDIO] · Coerción `int()` trunca decimales · `venta_service.py:60-63` — `banos=2.9` → 2. · Divergencia vs formulario float del schema. · `int(round(...))` o validar enteros en schema (parcialmente ya).

### [BAJO] · MAE/R² hardcodeados · `venta_service.py:24-25,47-48` — no leídos de `b["metricas"]` si existen. · Health desincronizado tras re-train. · Leer del bundle en `load()`.

### [INFO] · OutOfBounds vía geo · `venta_service.py:56,578` — misma bbox que alquiler. · OK.

### [INFO] · Respuesta mínima (sin zone/confidence en servicio) · `venta_service.py:67-73` — veredicto lo arma `fairvalue.py:189-214`. · Separación de capas correcta. · OK.

---

## Veredicto

**Integración venta funcional** con guards en routers. Subir robustez con **validación de bundle**, **guard en `predict()`** y **paridad estricta de columnas geo**.
