# T005 — Caps de outliers precio/m² (leakage)

**TARGET:** `notebooks/01_limpieza.ipynb`  
**LENTE:** leakage  
**Fecha:** 2026-07-06

---

## Resumen

Los caps persistidos en `outlier_caps.joblib` coinciden en su mayoría con el **percentil 99 del dataset completo** (`data/inmuebles_alquiler_clean.csv`, n=3348). No hay celda en notebooks 01–05 que documente su cálculo; el ajuste fue sobre todo el corpus, no solo train.

---

## Hallazgos

### [ALTO] · Umbrales ≈ P99 global, no P99 de train · Verificación en artefacto `models/outlier_caps.joblib` vs CSV: `banos` cap=4 = P99; `dormitorios` cap=4 = P99; `area_final_m2` cap=361.57 (P99=395.18, cercano); `amenities_count` cap=24 = P99. Cálculo sobre `data/inmuebles_alquiler_clean.csv` (3348 filas). · Caps usados en gates/serving pueden haber visto información de holdout. · Recalcular caps solo con train y versionar en artefacto; script explícito (hoy ausente en repo).

### [MEDIO] · Código fuente del cálculo no está en notebooks versionados · Búsqueda en `notebooks/*.ipynb` y `*.py`: ninguna celda con `joblib.dump(..., 'outlier_caps')`. Solo referencias en outputs de nb03/nb04 y `audit_artefactos.py:92-99`. · Imposible auditar “train only” desde el repo; deuda de reproducibilidad. · Añadir script/celda que genere `outlier_caps.joblib` con split explícito.

### [BAJO] · Notebook 01 no aplica caps de precio/m² en limpieza · Celda 13 cuenta `precio_usd <= 200` pero **no elimina** filas; el CSV final aún tiene 6 avisos ≤200 USD. · Outliers de precio pueden seguir en el dataset. · Aplicar filtro o winsorización documentada.

### [INFO] · Notebook 05 menciona “Caps en percentil 99” · `notebooks/05_evaluacion_seleccion.ipynb` celda 23 (markdown RESUMEN). · Alineado con artefacto, pero sin trazabilidad de código. · Vincular markdown a script reproducible.

---

## Veredicto

**Leakage probable en caps:** umbrales derivados del dataset completo, sin evidencia de restricción a train.
