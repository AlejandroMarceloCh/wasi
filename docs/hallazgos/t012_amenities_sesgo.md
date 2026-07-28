# T012 — Amenities `tiene_*=0`: sesgo (missing-data)

**TARGET:** `notebooks/03_feature_engineering.ipynb` (lógica en **01**)  
**LENTE:** missing-data  
**Fecha:** 2026-07-06

---

## Resumen

Las amenities Properati se imputan a **0** (“no tiene”) cuando en realidad son **no reportado** (MNAR). El notebook reconoce el sesgo pero la mitigación (`es_properati`) **no se implementó**.

---

## Hallazgos

### [ALTO] · fillna(0) colapsa “desconocido” con “ausente” · `notebooks/01_limpieza.ipynb` celda 21: `df_clean[amenity_cols] = df_clean[amenity_cols].fillna(0)`. Celda 20 markdown distingue NaN≠0 para Properati. · ~32% de filas Properati: modelo puede subestimar valor de amenities reales. · Crear `es_properati = (fuente=='properati')` antes del fillna; o imputar MNAR con modelo separado.

### [MEDIO] · EDA nb02 muestra diferencia de precio con/sin amenity sin separar fuente · Celda amenities: mediana precio con vs sin cada `tiene_*` sobre todo el dataset. · Mezcla efecto real + sesgo de missing Properati. · Repetir análisis estratificado por `fuente`.

### [BAJO] · Wizard de producción asume 0 = no tiene · `src/wasi/models/ml_v2.py:66-69` — amenities no seleccionadas quedan en 0. · Coherente con entrenamiento sesgado. · UX: no pedir amenities en avisos importados de Properati si no hay señal.

### [INFO] · Gate 3 amenities mide sensibilidad top-N · `app/backend/scripts/gate3_amenities.py` — delta MAPE por subconjunto de chips. · Mitiga impacto en serving parcial. · No corrige sesgo de entrenamiento histórico.

---

## Veredicto

**Sesgo confirmado** en amenities Properati. Documentación honesta en markdown; implementación incompleta.
