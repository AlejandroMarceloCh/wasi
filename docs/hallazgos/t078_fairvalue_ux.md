# T078 — FairValue: UX (rangos, banners, confianza)

**TARGET:** `app/screens-fairvalue.jsx`  
**LENTE:** ux  
**Fecha:** 2026-07-06

---

## Resumen

Buen trabajo en banner `from_catalog` y aviso venta v1. Quedan asimetrías en banners de confianza Media, duplicación de veredicto seller/buyer, y operación venta oculta tras paso 1.

---

## Hallazgos

### [MEDIO] · Banner cobertura solo si confianza “Baja” · `screens-fairvalue.jsx:1004-1011` vs `1026-1029` — `Baja` tiene banner destacado; `Media` solo línea pequeña bajo el tag. · Usuarios con confianza Media no ven aviso prominente aunque `lowConf` incluye Media en texto auxiliar. · Mostrar `banner-coverage` también para Media con copy diferenciado.

### [MEDIO] · Selector operación solo en paso 1 · `screens-fairvalue.jsx:169-185` — para cambiar alquiler↔venta hay que volver al mapa. · Usuario en paso 3 que se equivocó de operación pierde datos de precio (se resetea `precio` al cambiar en paso 1). · Tabs de operación persistentes en header del wizard.

### [MEDIO] · Venta: mensaje de limitación al final del scroll · `screens-fairvalue.jsx:573-575` — “SHAP, contrafactuales y narrativa… solo alquiler” en caja pequeña. · Quien espera paridad con alquiler puede sentirse decepcionado al terminar el flujo. · Banner info al inicio de `VentaResult` + CTA claro “Analizar alquiler”.

### [MEDIO] · Veredicto comprador duplicado (card + gauge) · `screens-fairvalue.jsx:1035-1066,1064-1066` — bloque verdict + `GaugeChart` con chip redundante. · Ruido visual en resultado; jerarquía poco clara. · Una sola fuente de veredicto hero; gauge sin repetir %.

### [BAJO] · `from_catalog` banner excelente pero fácil de ignorar · `screens-fairvalue.jsx:150-164` — usuarios pueden no entender por qué sale “Justo” siempre. · Ya educa; podría añadir CTA “Limpiar y analizar como nuevo”. · Botón que resetee prefill.

### [BAJO] · Confianza en tag sin explicar MAPE junto · `screens-fairvalue.jsx:1020-1024` — Glossary ayuda; MAPE en caja inferior separada. · Usuario no conecta confianza baja con ±MAPE. · Una línea “Confianza baja = más incertidumbre (±X%)”.

### [BAJO] · Paso 3 resumen: amenities como número · `screens-fairvalue.jsx:375-379` — “Amenities: 3” sin listar. · Poco útil para confirmar antes de calcular. · Listar chips o nombres.

### [INFO] · Banner catálogo entrenamiento · copy honesto. · Buena práctica.

### [INFO] · Warnings del modelo con `banner warn` · Sprint 0. · OK.

---

## Veredicto

UX sólida en educación de catálogo y venta v1. Mayor ganancia: **simetría de avisos de confianza Media/Baja** y **menos duplicación de veredicto** en resultado alquiler.
