# Gate 5 — mapping dataset → BD  ·  RESULTADO

**Fecha:** 2026-05-21
**Decisión:** se REVISA la decisión original. No se crea `zone_poi_aggregates`;
se **elimina** la tabla `pois`. Los datos geográficos los sirve `geo_index.py`.
**Estado:** CERRADO.

## Contexto — por qué se revisó

La auditoría (Gate 5 original) eligió migrar `pois` → `zone_poi_aggregates`
(agregados por distrito). Esa decisión se tomó **antes** de construir
`geo_index.py` (Fase 1).

Con `geo_index.py` ya operativo, el panorama cambió: para **cualquier**
punto del mapa, `geo_lookup(lat,lng)` devuelve los POIs (`count_1km_*`,
`dist_nearest_m_*`) y el crimen (`cantidad_denuncias`) interpolados por IDW.
Una tabla `zone_poi_aggregates` daría datos por distrito — más gruesos, y
requeriría migración de schema + ETL — para entregar lo que `geo_index` ya
da con mejor granularidad (por pin).

## Decisión

- **Se elimina la tabla `pois`** (entidades individuales que el dataset nunca
  tuvo cómo poblar).
- **No se crea `zone_poi_aggregates`.**
- **No se crea `crime_incidents`** como tabla de entidades — `cantidad_denuncias`
  vive en `geo_index`.
- El endpoint `entorno.py` consume `geo_lookup(lat,lng)` — el mismo motor que
  la predicción. El contexto de barrio cambia al mover el pin.

## La BD queda con 6 tablas transaccionales

`users`, `districts` (solo nombres + cobertura, para el dashboard),
`properties`, `analyses`, `analysis_factors`, `reports`.

Se eliminaron del modelo ORM: `pois`, `crime_incidents`, `neighborhood_scores`,
`warnings_log` — su función la cubre `geo_index` o el cálculo en vivo de
`entorno.py`.

## Beneficios

- Una sola fuente de datos geográficos (`geo_index.py`) → sin duplicación.
- Contexto de barrio **por pin**, no por distrito → más preciso, mejor demo
  (los datos cambian al arrastrar el pin → cumple la aceptación de Fase 6).
- Menos schema, menos ETL, menos código que mantener.
- El esquema lo genera el ORM (`Base.metadata.create_all`) → agnóstico del
  motor (SQLite por defecto, PostgreSQL si se configura `DATABASE_URL`).
