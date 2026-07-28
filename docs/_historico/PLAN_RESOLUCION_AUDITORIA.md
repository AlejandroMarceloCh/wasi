# Plan de resolucion por sprints - Auditoria Wasi

## Objetivo

Resolver los hallazgos de auditoria de Wasi en ciclos iterativos, priorizando primero los riesgos que pueden comprometer seguridad, reproducibilidad, pipeline ML y comportamiento funcional. Este plan no reemplaza `src/wasi/plan.md`: lo aterriza a ejecucion usando los bugs encontrados durante la auditoria.

Regla central: ningun sprint se cierra por tiempo. Se cierra solo cuando cumple su Sprint Goal, pasa QA Codex Agent y deja registro en `src/wasi/AUDIT_LOG.md` y `src/wasi/CHANGELOG_AUDITORIA.md`.

## Protocolo fijo por sprint

Cada sprint debe seguir este flujo:

1. Lectura focalizada del area a tocar.
2. Confirmacion del scope exacto.
3. Implementacion minima para cerrar el Sprint Goal.
4. Tests locales relevantes.
5. QA Codex Agent independiente en modo review.
6. Correcciones si QA rechaza.
7. Registro en bitacora/changelog.

Prompt base de QA Codex Agent:

```text
Actua como auditor senior independiente del proyecto Wasi.
No edites archivos.

Sprint Goal:
[PEGAR]

Cambios realizados:
[PEGAR RESUMEN + ARCHIVOS]

Tests ejecutados:
[PEGAR COMANDOS Y RESULTADOS]

Revisa:
1. Si el Sprint Goal se cumplio realmente.
2. Si hay regresiones sobre flujos antiguos.
3. Si faltan tests de regresion.
4. Si se introdujo deuda tecnica nueva.
5. Si hay riesgos de seguridad, performance, datos, accesibilidad o reproducibilidad.

Entrega findings por severidad y veredicto:
APROBADO, APROBADO CON RIESGOS o RECHAZADO.
```

## Sprint 1 - Baseline confiable y memoria de auditoria

### Sprint Goal

Convertir el baseline actual en una fotografia confiable del repo, corrigiendo los errores encontrados por QA: endpoints con prefijos reales, estado de subrepos, ignored files relevantes, entorno exacto de tests y drift documental inicial.

### Cambios esperados

- Corregir `src/wasi/AUDIT_BASELINE.md` con rutas reales de API (`/api/...`).
- Registrar `git status --short --ignored`.
- Registrar `git -C pipeline status --short --branch`.
- Registrar `git -C research/eda status --short --branch`.
- Inventariar ignorados grandes: `_backups`, `pipeline`, `aws`, `app/backend/venv`, `.audit-venv*`, `wasi.db`, `src/wasi.egg-info`.
- Documentar Python/venv usado para tests.
- Registrar skipped/warnings con `pytest -ra`.
- Cambiar referencias de QA externo a QA Codex Agent.

### Tests / verificacion

- `make test`
- `cd app/backend && venv/bin/pytest -q -ra --tb=short`
- `cd app/backend && venv/bin/pip check`

### Cierre

QA Codex Agent debe aprobar el baseline. Si queda material sin trackear relevante, debe estar clasificado como propio de auditoria, previo del usuario o pendiente.

## Sprint 2 - Seguridad y reproducibilidad critica

### Sprint Goal

Eliminar riesgos criticos de seguridad/reproducibilidad que pueden dejar produccion con cuentas conocidas, entorno local no reproducible o archivos necesarios fuera de versionado.

### Hallazgos cubiertos

- Seeds demo con credenciales fijas en startup.
- Credenciales demo impresas en logs.
- Repro local depende de `.env` ignorado y README no lo explica.
- `pipeline/` y `aws/` son necesarios pero estan ignorados/no versionados.
- Subrepos anidados no declarados.

### Cambios esperados

- Condicionar seed demo a modo desarrollo explicito.
- Evitar imprimir passwords en logs.
- Documentar y/o automatizar creacion segura de `.env` local desde `.env.example`.
- Decidir y aplicar estrategia de versionado para `pipeline/`, `aws/` y subrepos:
  - versionarlos en repo principal, o
  - declararlos como submodulos, o
  - sacar tests/docs que dependan de archivos ignorados.
- Actualizar README con setup real.

### Tests / verificacion

- Startup sin `.env` debe fallar con mensaje claro o README debe cubrirlo.
- Startup dev con `.env` valido.
- Tests de auth existentes.
- Test nuevo/actualizado para no crear demo users en modo produccion.
- `git status --short --ignored` sin sorpresas criticas.

### Cierre

No debe quedar forma de desplegar una BD vacia con usuarios demo conocidos salvo modo demo explicitamente activado.

## Sprint 3 - Pipeline ML y rutas de modelos

### Sprint Goal

Hacer que el pipeline de ML, scripts de regeneracion y rutas de artefactos apunten a una unica fuente de verdad y sean ejecutables en el layout actual.

### Hallazgos cubiertos

- Runtime usa `models/`, pero pipeline/AWS/scripts apuntan a `app/backend/models/v2`.
- Scripts con imports rotos (`model_service`, `geo_index`, `ml`, `osm_lookup` planos).
- `generate_model_artefacts_v2.py` tiene regeneracion circular.
- `venta_service` degrada silenciosamente sin manifest/golden/schema check.

### Cambios esperados

- Centralizar rutas usando `wasi.paths`.
- Corregir imports de scripts ML/pipeline.
- Separar generacion de manifest/golden v2 para permitir swap de modelo.
- Agregar smoke tests de scripts criticos sin reentrenar pesado.
- Definir politica de venta: si debe ser obligatorio, test falla; si es opcional, documentar degradacion.

### Tests / verificacion

- Import smoke de scripts ML.
- Test negativo de manifest/golden v2 adulterado.
- Test de ruta real de modelos.
- Tests existentes de ML: startup, golden, quantile, v2 features.

### Cierre

Debe ser posible explicar y probar donde vive cada artefacto productivo y como se regenera sin rutas muertas.

## Sprint 4 - Correctness API y reglas de negocio

### Sprint Goal

Corregir bugs funcionales de API que permiten manipular veredictos, aceptar inputs inconsistentes o exponer recursos en estados no validos.

### Hallazgos cubiertos

- Veredicto de listings manipulable por `payload.district`.
- Listings pausados/alquilados visibles/contactables por ID.
- `CounterfactualIn` permite `dormitorios=0` con `es_estudio=false`.
- `PATCH /me` puede guardar nombre vacio tras `strip()`.
- Emails no normalizados.
- Errores internos exponen `str(e)`.

### Cambios esperados

- Validar distrito contra `lat/lng` o derivar distrito server-side.
- Bloquear leads/contacto para listings no activos.
- Unificar validadores de `PredictIn` y `CounterfactualIn`.
- Normalizar email en registro/login.
- Revalidar nombre tras `strip()`.
- Sanitizar errores internos hacia mensajes publicos estables.

### Tests / verificacion

- Tests de distrito/lat-lng inconsistente.
- Tests de listing `pausado`/`alquilado`.
- Tests de `dormitorios=0` en counterfactual.
- Tests de email case-insensitive.
- Tests de `PATCH /me` con espacios.
- Tests de errores internos sin filtrar rutas/tracebacks.

### Cierre

Los contratos publicos deben seguir iguales salvo correcciones documentadas. Todo bug corregido debe tener test de regresion.

## Sprint 5 - Performance, concurrencia y abuso

### Sprint Goal

Reducir trabajo innecesario por request y limitar abuso de endpoints caros sin alterar predicciones ni contratos.

### Hallazgos cubiertos

- `/fairvalue/simulate` calcula counterfactuals que descarta.
- Prediccion v2 recompone OSM varias veces.
- `geo_lookup` hace scan O(N) completo por request.
- Groq bloqueante sin timeout.
- Singletons lazy sin lock.
- Falta rate limit en endpoints caros.

### Cambios esperados

- Crear path de prediccion ligera para `simulate`.
- Reusar contexto OSM/features dentro de una prediccion.
- Evaluar KD-tree/radius query para comparables en vez de scan completo.
- Agregar timeout/error controlado a Groq.
- Calentar o proteger singletons con lock.
- Agregar rate limits a predict/simulate/narrative/counterfactual.

### Tests / verificacion

- Tests de equivalencia de prediccion antes/despues.
- Tests de timeout Groq simulado.
- Tests de rate limit.
- Benchmark simple de `/predict` y `/simulate`.
- Test concurrente de cold start de singletons.

### Cierre

La performance debe mejorar o quedar medida. Ninguna optimizacion puede cambiar golden predictions.

## Sprint 6 - Frontend productivo y consistencia con API

### Sprint Goal

Eliminar riesgos productivos del frontend: Babel/React dev en navegador, token expuesto con superficie XSS alta, divergencias con API y navegacion mobile rota.

### Hallazgos cubiertos

- React development + Babel en browser.
- Dependencias CDN sin build/lock/SRI.
- JWT en `localStorage` con scripts inline/CDN.
- Navegacion principal oculta en mobile sin reemplazo.
- Preview de publicacion debe mantenerse alineado con backend; Formula Explorar v2 ya usa `predict_fair_value` server-side.
- Subida de `data:image` en JSON infla payload/BD.

### Cambios esperados

- Definir estrategia: mantener estatico con build real o migrar a bundler minimo.
- Si se mantiene token en localStorage, reducir superficie XSS y documentar riesgo; idealmente migrar a cookie httpOnly si el backend lo soporta.
- Corregir navegacion mobile.
- Verificar visualmente que preview de seller y listing persistido muestran la misma referencia/zona.
- Definir estrategia de imagen: URL externa validada o upload real, no blobs grandes en JSON.

### Tests / verificacion

- Smoke manual o automatizado de auth, fairvalue, listings, seller, profile.
- Mobile <980px.
- Auth expirada/401.
- Publicacion con imagen grande.
- Preview vs listing persistido.

### Cierre

La app debe ser navegable en mobile y no depender de transpilar JSX en cliente para produccion.

## Sprint 7 - Accesibilidad y UX de errores

### Sprint Goal

Hacer que flujos principales sean utilizables con teclado/lector y que errores/cargas sean anunciados de forma consistente.

### Hallazgos cubiertos

- Modales sin nombre accesible, focus trap ni restore.
- Labels no asociados a inputs/selects.
- ErrorBanner sin `role=alert` ni teclado.
- Loading sin `role=status`/`aria-live`.
- Foco visible incompleto.
- Visualizaciones D3/Leaflet sin alternativa accesible suficiente.

### Cambios esperados

- Modal base accesible.
- Inputs/selects con `id/htmlFor`.
- Errores/cargas con roles adecuados.
- Focus-visible global.
- Botones/enlaces semanticos.
- Texto alternativo/resumen para visualizaciones criticas.

### Tests / verificacion

- Recorrido de teclado en auth, fairvalue, listings, seller y profile.
- Axe/Playwright si se incorpora tooling.
- Smoke manual con mobile.

### Cierre

No deben existir bloqueos obvios de teclado en flujos principales.

## Sprint 8 - Tests, CI, dependencias y documentacion final

### Sprint Goal

Dejar calidad repetible: dependencias coherentes, CI representativo, docs actualizadas y reporte final de auditoria.

### Hallazgos cubiertos

- `pyproject.toml` con `dependencies=[]`.
- Requirements fragmentados.
- No hay lockfile.
- CI Python 3.9 vs Render 3.11.9 vs Makefile 3.9-3.12.
- README desactualizado: cantidad de tests, setup `.env`, rutas, AWS mensual/semanal.
- No hay tests frontend.
- Skips por artefactos locales pueden ocultar fallos.

### Cambios esperados

- Definir fuente de verdad de dependencias.
- Alinear matriz Python local/CI/prod.
- Agregar checks necesarios a CI.
- Actualizar README y docs de deploy/pipeline.
- Crear `src/wasi/AUDIT_FINAL_REPORT.md`.
- Registrar backlog remanente P0/P1/P2/P3.

### Tests / verificacion

- CI local equivalente.
- `make test`.
- `pip check`.
- Smoke frontend.
- Revision de README siguiendo pasos desde cero.

### Cierre

Otro ingeniero debe poder clonar, configurar, testear, correr y entender riesgos pendientes sin memoria oral.

## Orden recomendado de ejecucion

1. Sprint 1: Baseline confiable.
2. Sprint 2: Seguridad/reproducibilidad critica.
3. Sprint 3: Pipeline ML/rutas.
4. Sprint 4: Correctness API.
5. Sprint 5: Performance/concurrencia.
6. Sprint 6: Frontend productivo.
7. Sprint 7: Accesibilidad/UX.
8. Sprint 8: Tests/CI/docs.

No conviene empezar por refactors cosmeticos. Los primeros tres sprints reducen riesgo de seguridad, perdida de trabajo y pipeline roto; despues tiene sentido entrar a comportamiento funcional, performance y frontend.
