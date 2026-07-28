# T004 — Imputación P95 en `dist_nearest_m_*` (leakage)

**TARGET:** `notebooks/03_feature_engineering.ipynb` (nota: la imputación ocurre en **01**, no en 03)  
**LENTE:** leakage  
**Fecha:** 2026-07-06

---

## Resumen

La imputación con centinela P95 de `dist_nearest_m_*` está implementada en el notebook **01**, sobre **todo** `df_clean`, antes del split de entrenamiento.

---

## Hallazgos

### [ALTO] · P95 calculado sobre dataset completo · `notebooks/01_limpieza.ipynb` celda 23 — `centinela = df_clean[col].quantile(0.95)` y `df_clean[col].fillna(centinela)` para cada `dist_nearest_m_*`. · Filas de test/val contribuyen al percentil 95 usado para imputar train; leakage geográfico leve. · Calcular P95 solo con train (post-split) o usar constante fija derivada de train congelado en artefacto.

### [INFO] · Notebook 03 no re-imputa distancias · `notebooks/03_feature_engineering.ipynb` lee `inmuebles_clean_v1.csv` ya imputado (celda 1). · El leakage se sella en la etapa de limpieza, no en feature engineering. · Corregir en notebook 01 o mover lógica a 03 post-split.

### [MEDIO] · Semántica del centinela es razonable pero no separa train/test · Celda 22 (markdown): el centinela representa “muy lejos” cuando `count_1km_* = 0`. · Decisión de negocio OK; implementación estadística con fuga. · Mantener semántica, cambiar ámbito del quantile.

---

## Veredicto

**Leakage confirmado:** el P95 no sale solo del train tras el split.
