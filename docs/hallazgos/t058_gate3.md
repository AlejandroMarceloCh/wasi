# T058 — `gate3_amenities.py` (correctitud)

**TARGET:** `app/backend/scripts/gate3_amenities.py`  
**LENTE:** correctitud  
**Fecha:** 2026-07-06

---

## Resumen

El gate mide bien el efecto de **apagar** amenities `tiene_*` en X_test, pero la línea base "top-37" y la fórmula de `area_x_amenities` no replican exactamente `build_features` de producción (8 chips). La decisión top-8 es defendible, con sesgo metodológico en el baseline.

---

## Hallazgos

### [MEDIO] · Baseline "todas las amenities" ≠ producción (8 chips) · `gate3_amenities.py:62-64` — `mape_full` usa las 37 columnas `tiene_*` de X_test; `ml.py:115-120` solo cuenta `AMENITY_CHIPS` (8) para `amenities_count`. · El delta reportado mide reducción desde un techo optimista (37), no desde el serving real; puede subestimar el costo del form. · Añadir fila `top-8 prod` con `build_features` o baseline con solo chips del wizard.

### [MEDIO] · `area_x_amenities` recalculada distinto al pipeline Leo · `gate3_amenities.py:44-45` — `np.log1p(expm1(area_final_m2) * new_count)` sobre columnas ya transformadas; `ml.py:134,142-143` — `area * amenities_count` y luego `log1p` si aplica. · Puede desviar `mape_full` vs predict directo sobre X_test sin tocar. · Reusar `build_features` para la variante "full chips" o no recalcular columnas no afectadas.

### [INFO] · Ranking por importancia RF del modelo final · `gate3_amenities.py:55-56` — importancias del artefacto entrenado (incluye train). · Aceptable para diseño de producto offline; no es leakage del holdout. · OK.

### [INFO] · Holdout correcto · `gate3_amenities.py:50-51, 68-69` — predicciones solo sobre `X_test.csv`. · Gate 3 respeta el split. · OK.

### [BAJO] · Umbral 2 pp sin estratificación por rango de precio · `gate3_amenities.py:29, 74-77` — decisión global. · Amenities pueden importar más en segmento premium. · Desglose opcional como en gate6.

---

## Veredicto

**Parcialmente conforme.** El experimento aísla chips, pero el **baseline y las derivadas** no calzan del todo con el path de inferencia actual.
