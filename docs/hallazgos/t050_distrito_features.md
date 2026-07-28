# T050 — distrito_features: NSE, comisarías y denuncias completos

**TARGET:** `src/wasi/features/distrito_features.py`  
**LENTE:** correctitud  
**Fecha:** 2026-07-06

---

## Resumen

Join de tabla NSE manual + comisarías CENACOM + denuncias MININTER 2024 + serenazgo (solo UI) está **completo** para distritos conocidos. `_norm()` alinea tildes. Distritos ausentes caen a **defaults por mediana**, que pueden distorsionar features v2.

---

## Hallazgos

### [INFO] · Pipeline de joins precomputado · `distrito_features.py:28-75` — NSE ← `distritos_lima_features`, comisarías, pivot denuncias violentas/patrimoniales/otras. · Una lookup O(1). · OK.

### [INFO] · Clasificación de modalidades · `distrito_features.py:46-52` — buckets coherentes con literatura de seguridad. · OK.

### [INFO] · Año 2024 preferido · `distrito_features.py:43-44` — fallback a max año si falta 2024. · Datos recientes. · OK.

### [MEDIO] · Defaults para distrito desconocido = medianas globales · `distrito_features.py:77-84,96-98` — estrato=2/popular fijo + medianas de comisarías/denuncias. · Pin en distrito nuevo o typo hereda perfil “Lima promedio”, no señal de baja confianza. · Flag en lookup + warning en predict; o rechazar distritos fuera de tabla.

### [MEDIO] · Join denuncias por `DIST_HECHO` normalizado vs distrito de geo · `distrito_features.py:55` vs `geo_index` vecino más cercano — nombres oficiales pueden diferir (“SMP” vs “San Martin de Porres”). · `_norm` mitiga tildes; abreviaturas no mapeadas → defaults. · Tabla de alias adicional.

### [INFO] · Serenazgo fuera del modelo · `distrito_features.py:109-131` — solo Entorno UI. · No contamina predicción. · OK.

### [INFO] · Tests premium vs popular · `test_v2_features.py:test_distrito_features_premium_vs_popular`. · OK.

### [BAJO] · Lazy singleton sin lock · `distrito_features.py:133-139` — ver T049. · Doble init lee 3 CSV duplicados. · Lock compartido o init en lifespan.

---

## Veredicto

**Features distritales completas** para el universo de la tabla manual. Endurecer **distritos desconocidos** (no defaults silenciosos) y **alias de nombres** en denuncias.
