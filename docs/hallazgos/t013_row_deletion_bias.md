# T013 — Borrado de filas MAR (missing-data)

**TARGET:** `notebooks/01_limpieza.ipynb`  
**LENTE:** missing-data  
**Fecha:** 2026-07-06

---

## Resumen

El notebook **no borra** filas por nulos MAR en columnas correlacionadas; **imputa**. Las reglas de calidad en celda 13 **cuentan** inválidos pero **no filtran**. El CSV en repo aún contiene casos inválidos.

---

## Hallazgos

### [INFO] · Estrategia explícita: imputar, no eliminar · Celdas 16–18: medianas por grupo para `antiguedad`, `dormitorios`, `banos`; celda 21 amenities fillna(0). · Evita sesgo por listwise deletion **pero** introduce leakage (T003). · Preferible imputación post-split a borrado MAR.

### [MEDIO] · Reglas de invalidación no aplicadas al dataset final · Celda 13: detecta `precio_usd <= 200`, `area < 20`, etc., solo con `print(len(...))`. Celda final: `Shape original == Shape limpio` (solo dedup id_portal). · `data/inmuebles_alquiler_clean.csv`: **6 filas** con `precio_usd <= 200`, **34** con `dormitorios` nulo. · Aplicar filtros o documentar que el CSV no refleja el notebook.

### [BAJO] · Valores imposibles convertidos a NaN, luego imputados · Celda 17: `banos > 20` → NaN; misma lógica dormitorios. · No es borrado de fila; reciclaje vía imputación. · OK si imputación es post-split.

### [INFO] · Dedup solo por `id_portal + fuente` · Celda 25: `drop_duplicates(subset=['id_portal', 'fuente'])` — output 0 duplicados. · No afecta nulos MAR. · Ninguna acción.

---

## Veredicto

**No hay listwise deletion sesgada por MAR** — el riesgo principal es **imputación global** (T003), no borrado de filas.
