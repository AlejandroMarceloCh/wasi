# T061 — `audit_calibracion_distritos.py` (correctitud)

**TARGET:** `app/backend/scripts/audit_calibracion_distritos.py`  
**LENTE:** correctitud  
**Fecha:** 2026-07-06

---

## Resumen

Mide sesgo modelo vs precio anunciado por distrito usando `predict_fair_value` real. Útil como radar operativo, pero la muestra y el form simplificado limitan la detección de distritos mal calibrados.

---

## Hallazgos

### [MEDIO] · Form de auditoría no replica listings del catálogo · `audit_calibracion_distritos.py:59-66` — `amenities: []`, `es_estudio: False` siempre; los listings sembrados sí llevan amenities (`seed_catalogo.py:135`). · Sesgo por distrito puede venir de amenities ignoradas; falso negativo en premium. · Pasar `amenities` parseadas del listing o del CSV origen.

### [MEDIO] · Muestra por `order_by(Listing.id).limit(40)` no aleatoria · `audit_calibracion_distritos.py:51-53` — primeros 40 IDs por distrito. · Sesgo temporal (IDs viejos vs nuevos sembrados); no representa mix de precios actual. · `ORDER BY RANDOM()` o estratificar por rango de precio.

### [MEDIO] · Conclusión pre-escrita en JSON de salida · `audit_calibracion_distritos.py:92-102` — texto fijo "modelo está bien calibrado DENTRO de ±2%…" independiente de `resultado`. · El artefacto anuncia veredicto aunque la corrida actual muestre drift. · Generar conclusión solo desde métricas calculadas en la misma ejecución.

### [BAJO] · Excepciones de predict silenciadas · `audit_calibracion_distritos.py:68-71` — `except Exception: continue`. · Distritos con muchos fallos parecen "omitidos" sin contador de errores. · Loggear `fallidos` por distrito.

### [BAJO] · Catálogo sembrado desde holdout puede circular con semilla · `seed_catalogo.py:85-88` usa coords de `X_test`; auditoría lee esos mismos listings en BD. · Mide ajuste en holdout expuesto como catálogo, no en avisos nuevos del mercado. · Complementar con scrape fresco o subset fuera de test.

### [INFO] · Usa path v2 de inferencia · `audit_calibracion_distritos.py:42-43, 45` — `predict_fair_value` + `model_service.load()` sin `DPD_FORCE_V1`. · Coherente con producción. · OK.

---

## Veredicto

**Detecta sesgo agregado por distrito con reservas.** Sirve como smoke test, no como certificación de calibración premium sin arreglar muestra y paridad de form.
