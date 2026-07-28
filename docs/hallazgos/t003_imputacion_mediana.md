# T003 — Imputación por mediana agrupada (leakage)

**TARGET:** `notebooks/01_limpieza.ipynb`  
**LENTE:** leakage  
**Fecha:** 2026-07-06

---

## Resumen

Toda la imputación por mediana en el notebook 01 ocurre **antes** del `train_test_split` del notebook 03. Los estadísticos de mediana agrupada incluyen filas que luego caen en val/test → **leakage de preprocesamiento**.

---

## Hallazgos

### [ALTO] · Medianas calculadas sobre el dataset completo, previas al split · `notebooks/01_limpieza.ipynb` celdas 16–18 — p.ej. `df_clean.groupby(['distrito_oficial', 'tipo_propiedad'])['antiguedad_anios'].transform(lambda x: x.fillna(x.median()))` y análogo para `dormitorios`/`banos` con bins de área; `df_clean = df.copy()` en celda 16 sin split previo. El split 70/15/15 aparece recién en `notebooks/03_feature_engineering.ipynb` celda 7. · Val/test heredan imputaciones informadas por su propio precio/distrito/área. Impacto típico: optimismo leve en MAPE (difícil cuantificar sin re-ejecutar). · Mover imputación numérica al notebook 03 **después** del split, fit solo en `df_train` (mismo patrón que target encoding).

### [MEDIO] · Mediana global de respaldo también usa todo el dataset · Celda 16: `mediana_global_antig = df_clean['antiguedad_anios'].median()`; celda 18 nivel 3: `df_clean[col].fillna(df_clean[col].median())`. · Mismo leakage para grupos con pocos ejemplos. · Calcular fallback global solo con train.

### [BAJO] · CSV en repo aún tiene nulos en columnas imputadas en notebook · Verificación: `data/inmuebles_alquiler_clean.csv` — 34 filas con `dormitorios` nulo y 6 con `precio_usd <= 200` pese a reglas en celda 13 (solo conteo, sin filtrado). · Posible desalineación notebook ↔ artefacto de datos; métricas pueden no corresponder al notebook tal cual. · Regenerar CSV desde notebook o aplicar filtros que hoy solo se imprimen.

---

## Veredicto

**Leakage confirmado** en imputación por mediana: el estadístico no sale solo del train post-split.
