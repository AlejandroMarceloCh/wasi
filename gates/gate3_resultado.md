# Gate 3 — A/B de amenities  ·  RESULTADO

**Fecha:** 2026-05-21
**Decisión:** el form usa **8 chips** de amenities (set UX-8).
**Estado:** CERRADO.

## Experimento

El modelo usa 37 amenities `tiene_*`. El form no puede tener 37 chips. Se mide
en X_test (503 casos) cuánto empeora el MAPE si el usuario solo informa N
amenities (el resto = 0, como en producción). `delta = MAPE(top-N) − MAPE(top-37)`,
ambos con `amenities_count` recalculado para aislar el efecto de reducir chips.

| set | MAPE | delta vs top-37 | resultado |
|---|---|---|---|
| top-8 (por importancia) | 15.85% | −0.06 pp | ✅ aprobado |
| top-12 | 15.82% | −0.10 pp | ✅ aprobado |
| top-15 | 15.85% | −0.06 pp | ✅ aprobado |
| **set UX-8 (elegido)** | **15.65%** | **−0.26 pp** | ✅ aprobado |

MAPE referencia (top-37, todas las amenities): 15.91%.

## Hallazgo honesto — las amenities casi no mueven la predicción

Cada feature `tiene_*` tiene una importancia RF de ~0.0004–0.0012, frente a
`area_final_m2` (0.417) o `distrito_enc` (0.186). **Quitar 29 de las 37
amenities cambia el MAPE en 0,06 pp** — ruido. El modelo predice por área,
distrito, ubicación y ratio área/baños; las amenities son casi cosméticas.

Implicación: como las diferencias de importancia dentro del top-15 son ruido,
los 8 chips se eligieron por **sentido para el usuario**, no por el ranking
crudo (que incluía flags de scraping como `tiene_numero_de_pisos`). Cualquier
set de 8 amenities reales da el mismo MAPE. **No sobrevender las amenities en
la sustentación** — están en el form por UX, no porque muevan el número.

## Set de amenities elegido para el form (8 chips)

| # | feature del modelo | etiqueta en el form |
|---|---|---|
| 1 | `tiene_ascensores` | Ascensor |
| 2 | `tiene_seguridad` | Seguridad / vigilancia |
| 3 | `tiene_cocina` | Cocina equipada |
| 4 | `tiene_amueblado_a` | Amoblado |
| 5 | `tiene_piscina` | Piscina |
| 6 | `tiene_terraza` | Terraza |
| 7 | `tiene_walk_in_closet` | Walk-in closet |
| 8 | `tiene_exteriores` | Áreas exteriores |

Las otras 29 amenities `tiene_*` se asumen 0 en `build_features`. Set fijo
para Fase 2 (build_features) y Fase 5 (wizard).
