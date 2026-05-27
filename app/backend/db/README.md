# Esquema de base de datos

El esquema **lo genera el ORM** (`models.py`) con `Base.metadata.create_all()`
en el startup del backend (`main.py`). No hay `schema.sql` que mantener.

- **Motor por defecto:** SQLite — archivo `app/backend/justa.db`, creado solo
  al primer arranque. Para borrar/regenerar la BD: eliminar `justa.db`.
- **PostgreSQL:** definir `DATABASE_URL` en `.env`; el mismo ORM genera el DDL.
- **Seed:** `seed.py` carga los 40 distritos del dataset + el usuario demo
  (`ana@justa.pe`), de forma idempotente, en el startup.

Las 6 tablas (`users`, `districts`, `properties`, `analyses`,
`analysis_factors`, `reports`) están definidas en `app/backend/models.py`.
Los datos geográficos (POIs, crimen) NO viven en la BD — los sirve
`geo_index.py` por pin.

> El antiguo `schema.sql`/`seed.sql` de PostgreSQL (10 tablas, triggers
> PL/pgSQL, vistas) se retiró: ya no correspondía al modelo actual tras la
> migración a SQLite + ORM (ver `gates/gate5_resultado.md`).
