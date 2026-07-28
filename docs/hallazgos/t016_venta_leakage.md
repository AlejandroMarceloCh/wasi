# T016 — Leakage modelo de venta (leakage)

**TARGET:** `ventas_model/train_venta.py`  
**LENTE:** leakage  
**Fecha:** 2026-07-06

---

## Resumen

El pipeline de venta aplica **mejor disciplina anti-fuga** que el de alquiler en notebooks: GroupKFold espacial con **re-encoding por fold**. Residual: encoding final y modelo se entrenan en **todo** el dataset (correcto para artefacto, no para métricas).

---

## Hallazgos

### [INFO] · Validación espacial con refit de encoder por fold · `ventas_model/train_venta.py:72-82` — `GroupKFold(n_splits=5)`; `encode_distrito(df.iloc[tr])` dentro del loop. · MAPE espacial reportado (15.8%) es metodológicamente sólido. · Mantener como plantilla para alquiler v3.

### [INFO] · Split aleatorio separado para artefacto · Líneas 57-70: 70/15/15 aleatorio para entrenar modelo exportado; métricas aleatorias no mezcladas con espaciales en la misma fila (cf. T008 venta). · Honestidad en `RESULTADOS.md`. · OK.

### [MEDIO] · Encoding producción fit en dataset completo · Líneas 86-88: `enc, glob = encode_distrito(df)` antes de `final.fit(X, y)`. · Estándar para serving; no invalida MAPE espacial si métrica se calculó en loop anterior. · Documentar en informe.

### [BAJO] · R² 0.856 en `venta_service.py` es de split aleatorio · `src/wasi/models/venta_service.py:24-25` — constantes `MODEL_R2=0.856`, `MAE_PCT=15.8` (MAPE espacial). · Misma trampa de T008 pero **documentada** en `train_venta.py:106-109`. · Etiquetar R² como “aleatorio” en API responses.

### [INFO] · Geo features sin leakage adicional · Features geo vienen de `geo_lookup()` en build (mismo índice que alquiler); no usan precio de venta. · OK.

---

## Veredicto

**Venta cumple** disciplina anti-fuga en validación. **Superior** al pipeline de alquiler versionado en notebooks 04/05.
