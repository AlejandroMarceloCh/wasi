# Plan maestro de auditoria integral - Wasi

## 1. Objetivo

Auditar de forma iterativa todo el repositorio **Wasi** para detectar, priorizar y corregir riesgos de seguridad, calidad de codigo, deuda tecnica, performance, manejo de errores, concurrencia/asynchrony, arquitectura, tests, dependencias, configuracion/infra, accesibilidad, consistencia de API, escalabilidad y documentacion.

La auditoria no se cierra por pasar tiempo ni por revisar archivos al azar. Cada ciclo se cierra solo si cumple su **Sprint Goal**, pasa un **Protocolo Anticagadas con QA Codex Agent**, y deja evidencia escrita en una bitacora que funcione como memoria historica del proyecto.

## 2. Contexto real del proyecto

### Stack detectado

- **Backend API:** Python, FastAPI, Uvicorn, Pydantic v2, SQLAlchemy 2, SlowAPI.
- **Auth:** JWT con PyJWT, passlib/bcrypt, variables `JWT_SECRET`, `JWT_ALGO`, `JWT_EXPIRE_DAYS`.
- **Base de datos:** SQLite local por defecto (`wasi.db`) y soporte PostgreSQL via `DATABASE_URL`.
- **ML:** scikit-learn 1.6.1, XGBoost 2.1.4, joblib, numpy, pandas, scipy.
- **Servicios ML:** paquete `src/wasi`, servicios de prediccion, venta, comparables, features y geo index.
- **Frontend:** app estatica en `app/` con HTML, CSS y React/JSX modularizado en `screens-*`, `components.jsx`, `api.js`, `app.jsx`.
- **LLM opcional:** Groq para narrativa sobre SHAP mediante `GROQ_API_KEY`.
- **Pipeline/data:** notebooks, scrapers, scripts de entrenamiento, data manifests, datasets externos y artefactos ML.
- **Infra/deploy:** Render (`render.yaml`), Vercel (`vercel.json`, `.vercelignore`), AWS SAM/Lambda en `aws/`, GitHub Actions CI.
- **Testing:** pytest + httpx bajo `app/backend/tests`; CI con Python 3.9.
- **Comandos:** `Makefile` con `setup`, `backend`, `frontend`, `test`, `clean`.

### Estructura principal

- `app/`: frontend estatico y backend FastAPI.
- `app/backend/`: API, routers, auth, DB, schemas, seed, rate limiting, scripts y tests.
- `app/backend/routers/`: routers `auth`, `dashboard`, `entorno`, `fairvalue`, `health`, `listings`.
- `app/backend/tests/`: tests de API, ML, geo, schemas, startup, listings, comparables, counterfactuals, cuantiles y venta.
- `src/wasi/`: paquete Python principal de Wasi.
- `src/wasi/features/`: features geograficas, POIs, distritos y lookup espacial.
- `src/wasi/models/`: servicios de ML, venta, comparables e inferencia.
- `models/` y `models/v2/`: artefactos entrenados, manifiestos, golden predictions, cuantiles y calibracion.
- `pipeline/`: pipeline historico/operativo con notebooks, scrapers, scripts y validacion.
- `ventas_model/`: extension de modelo de venta.
- `data/`: datasets limpios, comparables, geo index y fuentes externas.
- `notebooks/`: limpieza, EDA, feature engineering, entrenamiento, evaluacion y residuos.
- `aws/`: infraestructura y handlers para pipeline/scraper.
- `entregables/`, `_video_trailer/`, `research/`, `_backups/`: defensa, documentacion, investigacion y respaldos.
- `.github/workflows/`: CI.

### Que se va a auditar

1. Seguridad.
2. Calidad de codigo.
3. Deuda tecnica.
4. Performance.
5. Manejo de errores.
6. Concurrencia / async.
7. Arquitectura / acoplamiento.
8. Tests.
9. Dependencias.
10. Configuracion / infra.
11. Accesibilidad.
12. Consistencia de API.
13. Escalabilidad.
14. Documentacion.

## 3. Reglas innegociables de trabajo

### Regla 1 - Sprint Goal real

Cada sprint define un objetivo central verificable. El sprint solo termina cuando ese objetivo esta cumplido con evidencia: cambios, tests, hallazgos, QA y bitacora.

No se acepta cerrar un sprint con frases tipo "paso el tiempo", "se avanzo bastante" o "queda para despues". Si el objetivo no se cumple, el sprint queda **abierto**, **bloqueado** o **rechazado por QA**.

### Regla 2 - Protocolo Anticagadas con QA Codex Agent

Al final de cada sprint se debe pedir a uno o mas agentes Codex que revisen lo cambiado como auditor externo. El objetivo de QA Codex Agent no es felicitar ni aprobar rapido: es encontrar regresiones, riesgos y procesos antiguos rotos.

QA Codex Agent debe recibir:

- Sprint Goal.
- Resumen del estado inicial.
- Diff o lista de cambios.
- Tests ejecutados y resultados.
- Archivos tocados.
- Riesgos conocidos.

Prompt base:

```text
Actua como auditor senior del proyecto Wasi.
No seas complaciente. Tu trabajo es encontrar regresiones, riesgos reales y puntos ciegos.

Contexto:
- Proyecto: Wasi, producto de datos inmobiliario.
- Stack: FastAPI, SQLAlchemy, frontend estatico React/JSX, modelos ML XGBoost, pipeline de datos, SQLite/PostgreSQL, pytest.
- Sprint Goal: [PEGAR]
- Cambios realizados: [PEGAR]
- Tests ejecutados: [PEGAR]

Revisa:
1. Si el Sprint Goal realmente se cumplio.
2. Si se rompio algun flujo antiguo.
3. Si faltan tests de regresion.
4. Si hay riesgos de seguridad, performance, concurrencia, arquitectura o datos.
5. Si se introdujo deuda tecnica nueva.
6. Si la bitacora permite retomar el proyecto sin contexto conversacional.

Entrega:
- Findings criticos, altos, medios y bajos.
- Archivos o areas afectadas.
- Pruebas adicionales recomendadas.
- Veredicto: APROBADO, APROBADO CON RIESGOS o RECHAZADO.
```

Criterios:

- Si QA Codex Agent responde **RECHAZADO**, el sprint no cierra.
- Si responde **APROBADO CON RIESGOS**, los riesgos deben registrarse y aceptarse explicitamente.
- Si responde **APROBADO**, igual se registran observaciones y tests.

### Regla 3 - Guardado de progreso historico

Crear y mantener `src/wasi/AUDIT_LOG.md` como memoria viva del proyecto.

Formato obligatorio por sprint:

```md
## Sprint N - Titulo

- Fecha inicio:
- Fecha cierre:
- Estado: Abierto | Cerrado | Bloqueado | Rechazado por QA
- Sprint Goal:
- Areas auditadas:
- Cambios realizados:
- Archivos principales tocados:
- Tests ejecutados:
- Resultado de tests:
- QA Codex Agent:
  - Modelo/agente:
  - Prompt usado o referencia:
  - Veredicto:
  - Findings:
- Regresiones encontradas:
- Riesgos residuales aceptados:
- Decisiones tecnicas:
- Pendientes para siguiente sprint:
```

Crear tambien `src/wasi/CHANGELOG_AUDITORIA.md` para registrar cambios relevantes:

```md
## [YYYY-MM-DD] Sprint N

### Cambiado
- ...

### Corregido
- ...

### Seguridad
- ...

### Tests
- ...

### Riesgos pendientes
- ...
```

Si el contexto conversacional se compacta o se pierde, el siguiente agente debe leer primero:

1. `src/wasi/plan.md`.
2. `src/wasi/AUDIT_LOG.md`.
3. `src/wasi/CHANGELOG_AUDITORIA.md`.
4. `README.md`.
5. `git status --short` y `git log -5 --oneline`.

## 4. Baseline antes de auditar

Antes de tocar comportamiento funcional:

```bash
git status --short
git branch --show-current
git log -5 --oneline
make test
```

Si se trabaja directo en backend:

```bash
cd app/backend
venv/bin/pytest -q
```

Si el entorno no existe:

```bash
make setup
make test
```

Crear durante Sprint 1:

- `src/wasi/AUDIT_LOG.md`.
- `src/wasi/CHANGELOG_AUDITORIA.md`.
- `src/wasi/AUDIT_BASELINE.md`.

`AUDIT_BASELINE.md` debe contener:

- Stack confirmado.
- Resultado de tests baseline.
- Estado git inicial.
- Mapa de endpoints.
- Mapa de pantallas frontend.
- Mapa de modelos/artefactos.
- Hallazgos iniciales por severidad.
- Archivos sensibles o generados que no deberian versionarse.

## 5. Plan iterativo por sprints

## Sprint 1 - Baseline y mapa completo del sistema

### Sprint Goal

Construir una fotografia confiable del estado actual de Wasi y dejar instalada la memoria de auditoria para que todo sprint posterior parta de hechos verificables.

### Areas auditadas

- Estructura del repo.
- Estado git.
- Tests actuales.
- Dependencias.
- Artefactos generados.
- Archivos sensibles.
- Mapa inicial backend/frontend/ML/pipeline/infra.

### Trabajo

- Ejecutar comandos baseline.
- Inventariar endpoints, pantallas, modelos y scripts criticos.
- Revisar `.gitignore` contra archivos reales: `.env`, `wasi.db`, venvs, caches, `__pycache__`, `.pytest_cache`, modelos pesados y nested `.git` en `pipeline`.
- Crear `AUDIT_BASELINE.md`.
- Crear `AUDIT_LOG.md` y `CHANGELOG_AUDITORIA.md`.
- Priorizar hallazgos iniciales.

### Tests

- `make test`.
- Si falla, registrar comando, error, causa probable y bloqueo.

### QA Codex Agent

Pedir a QA Codex Agent revisar si el baseline cubre todo Wasi: backend, frontend, ML, pipeline, datos, infra y docs. Si detecta area omitida, completar antes de cerrar.

### Cierre

Sprint cerrado solo si existen los tres documentos de auditoria y hay resultado verificable de tests o bloqueo documentado.

## Sprint 2 - Seguridad, secretos y configuracion

### Sprint Goal

Eliminar o documentar riesgos de seguridad inmediatos y dejar reglas claras para secretos, auth, CORS, rate limiting y despliegue.

### Areas auditadas

- `app/backend/.env.example`.
- `.env.example`.
- `app/backend/auth.py`.
- `app/backend/database.py`.
- `app/backend/main.py`.
- `app/backend/ratelimit.py`.
- Configs Render/Vercel/AWS.

### Trabajo

- Buscar secretos hardcodeados con `rg`.
- Revisar que `JWT_SECRET` sea obligatorio y suficientemente largo.
- Revisar expiracion y algoritmo JWT.
- Revisar hashing de passwords.
- Revisar CORS: `*` solo aceptable en desarrollo, no produccion.
- Revisar rate limit en login, registro, prediccion y narrativa LLM.
- Revisar que `.env`, DB local y caches no esten versionados.
- Documentar checklist de deploy seguro.

### Tests

- Login correcto e incorrecto.
- Token invalido/expirado.
- Endpoint protegido sin token.
- Startup con `JWT_SECRET` invalido.
- Rate limit en endpoint sensible.

### QA Codex Agent

Pedir a QA Codex Agent intentar romper auth/config y revisar si los cambios rompen desarrollo local.

### Cierre

No cerrar si queda secreto real en repo, bypass auth conocido o config insegura sin documentar.

## Sprint 3 - API, schemas y manejo de errores

### Sprint Goal

Asegurar contratos de API consistentes, errores predecibles y validaciones robustas para frontend y consumidores futuros.

### Areas auditadas

- Routers `auth`, `dashboard`, `entorno`, `fairvalue`, `health`, `listings`.
- `schemas.py`.
- `app/api.js`.

### Trabajo

- Inventariar endpoints, metodos, payloads, respuestas y codigos HTTP.
- Revisar consistencia de errores.
- Detectar campos opcionales ambiguos.
- Verificar que frontend use endpoints y campos existentes.
- Evitar filtrado de stack traces o mensajes sensibles.
- Crear `src/wasi/API_CONTRACT_AUDIT.md` si el inventario crece.

### Tests

- Happy path por router.
- Inputs invalidos.
- Auth/forbidden.
- Payloads usados por frontend.

### QA Codex Agent

Pedir comparacion frontend vs API: nombres de campos, rutas, errores y compatibilidad con procesos antiguos.

### Cierre

No cerrar si un flujo frontend principal depende de un contrato no probado.

## Sprint 4 - Calidad de codigo y deuda tecnica backend

### Sprint Goal

Mejorar mantenibilidad del backend sin cambiar comportamiento publico.

### Areas auditadas

- `app/backend/*.py`.
- `app/backend/routers/*.py`.
- `src/wasi/models/*.py`.
- `src/wasi/features/*.py`.

### Trabajo

- Detectar funciones largas, duplicacion e imports fragiles.
- Separar HTTP, negocio, DB y ML si estan demasiado mezclados.
- Eliminar codigo muerto solo con evidencia.
- Mejorar nombres y tipos donde reduzca ambiguedad.
- Agregar tests antes de refactors riesgosos.

### Tests

- Suite backend completa.
- Tests especificos para funciones extraidas.
- Smoke de startup FastAPI.

### QA Codex Agent

QA Codex Agent debe buscar regresiones por refactor: rutas relativas, orden de carga de modelos, side effects de startup y DB local.

### Cierre

No cerrar si se cambio comportamiento sin test o si se rompio compatibilidad publica.

## Sprint 5 - ML, datos, reproducibilidad y leakage

### Sprint Goal

Garantizar que modelos, features e inferencia sean trazables, reproducibles y libres de leakage conocido.

### Areas auditadas

- `src/wasi/models/`.
- `src/wasi/features/`.
- `models/`, `models/v2/`.
- `pipeline/`.
- `notebooks/`.
- `ventas_model/`.

### Trabajo

- Verificar orden de features en inferencia.
- Revisar `model_service.load()` y `venta_service.load()`.
- Confirmar golden predictions.
- Auditar target encoding, imputacion, split espacial y POIs.
- Revisar compatibilidad sklearn/xgboost/joblib.
- Documentar fuente de verdad para regenerar artefactos.
- Separar scripts vigentes de historicos.

### Tests

- Golden prediction.
- Orden de features.
- Inputs extremos plausibles.
- Tests de leakage.
- Tests de venta.

### QA Codex Agent

QA Codex Agent debe revisar como auditor ML: leakage, divergencia train/inference, mensajes engañosos al usuario y cambios que invaliden artefactos.

### Cierre

No cerrar si inferencia puede divergir del entrenamiento sin test que lo detecte.

## Sprint 6 - Performance, concurrencia y escalabilidad

### Sprint Goal

Identificar cuellos de botella y riesgos de concurrencia en startup, prediccion, DB, carga de modelos, geo index, LLM y endpoints costosos.

### Areas auditadas

- Lifespan FastAPI.
- Carga de modelos.
- Geo index.
- Queries SQLAlchemy.
- Endpoints fairvalue/listings/dashboard.
- Groq.
- Scrapers y pipeline.

### Trabajo

- Medir startup, primera prediccion y predicciones repetidas.
- Confirmar que modelos se cargan una sola vez.
- Revisar estado global mutable bajo concurrencia.
- Revisar bloqueo de event loop.
- Detectar queries N+1 o filtros en memoria.
- Definir timeouts y limites de payload.
- Evaluar cache para geo index/POIs.

### Tests

- Requests concurrentes con httpx.
- Dos predicciones simultaneas.
- LLM sin `GROQ_API_KEY`.
- Benchmark simple documentado.

### QA Codex Agent

QA Codex Agent debe verificar que optimizaciones no alteren predicciones ni contratos.

### Cierre

No cerrar si una optimizacion cambia resultados sin golden test.

## Sprint 7 - Frontend, accesibilidad y UX de errores

### Sprint Goal

Asegurar que el frontend sea usable, accesible, consistente con API y robusto ante errores reales.

### Areas auditadas

- `app/index.html`.
- `app/landing.html`.
- `app/app.jsx`.
- `app/screens-*.jsx`.
- `app/components.jsx`.
- `app/api.js`.
- `app/styles.css`.

### Trabajo

- Mapear flujos: publico, home, fair value, listings, seller, profile.
- Revisar labels, foco, contraste, botones, loading/error, responsive.
- Revisar errores 400/401/403/404/500/503.
- Confirmar que no se asumen campos non-null sin defensa.
- Reducir duplicacion si bloquea mantenimiento.
- Documentar flujos criticos.

### Tests

- Smoke manual o automatizado de flujos principales.
- Backend caido.
- Token invalido.
- Responsive desktop/mobile.
- Axe/Playwright si se instala tooling.

### QA Codex Agent

Dar a QA Codex Agent capturas, rutas y diff. Debe revisar regresion visual, payloads, mobile y errores.

### Cierre

No cerrar si un flujo critico queda sin poder usarse o sin manejo de error.

## Sprint 8 - Dependencias, tooling y CI/CD

### Sprint Goal

Hacer que la calidad sea repetible: dependencias auditadas, comandos confiables, CI suficiente y setup claro.

### Areas auditadas

- `app/backend/requirements.txt`.
- `pyproject.toml`.
- `Makefile`.
- `.github/workflows/ci.yml`.
- `render.yaml`.
- `vercel.json`.
- `aws/template.yaml`.

### Trabajo

- Ejecutar `pip check` y, si se instala, `pip-audit`.
- Revisar vulnerabilidades.
- Evaluar constraints o lockfile.
- Revisar que CI no dependa de estado local.
- Documentar version Python soportada.
- Confirmar `make setup`, `make backend`, `make frontend`, `make test`.

### Tests

- CI local equivalente.
- `make test`.
- `python -m pytest -q --tb=short`.
- Auditoria de dependencias documentada.

### QA Codex Agent

QA Codex Agent debe revisar si CI detectaria regresiones importantes y si faltan jobs.

### Cierre

No cerrar si el proyecto no puede instalarse/probarse con comandos documentados.

## Sprint 9 - Infra, despliegue y observabilidad

### Sprint Goal

Asegurar que Wasi pueda desplegarse y operarse sin conocimiento tribal.

### Areas auditadas

- Render.
- Vercel.
- AWS.
- Health endpoints.
- Logs.
- Seeds.
- Rollback.

### Trabajo

- Revisar configs de deploy.
- Validar healthchecks.
- Revisar logs sin filtrar secretos.
- Documentar variables obligatorias por entorno.
- Evitar seed masivo accidental en produccion.
- Crear runbook de deploy y rollback.

### Tests

- Startup con variables minimas.
- Startup sin bulk seed.
- Healthcheck OK/falla controlada.
- Falta de modelo o DB invalida.

### QA Codex Agent

QA Codex Agent debe intentar seguir el runbook sin contexto. Si no puede desplegar logicamente, el sprint no cierra.

### Cierre

No cerrar sin matriz dev/staging/prod y rollback documentado.

## Sprint 10 - Documentacion, arquitectura y cierre

### Sprint Goal

Cerrar la auditoria con un reporte final accionable: arquitectura, riesgos priorizados, deuda restante, guia de mantenimiento y backlog tecnico.

### Areas auditadas

- `README.md`.
- Planes existentes.
- Diagramas.
- Docs pipeline/API/frontend/deploy.

### Trabajo

- Crear `src/wasi/AUDIT_FINAL_REPORT.md`.
- Consolidar hallazgos P0/P1/P2/P3.
- Crear o actualizar diagrama de arquitectura.
- Separar docs vigentes de historicas.
- Crear checklist mensual de mantenimiento.
- Confirmar que README refleje comandos actuales.

### Tests

- Seguir README desde cero.
- Ejecutar tests finales.
- Revisar links y rutas mencionadas.

### QA Codex Agent

QA Codex Agent debe revisar el cierre como evaluador externo: cobertura, severidad, accionabilidad y handoff.

### Cierre

No cerrar si falta reporte final, backlog priorizado o QA final.

## 6. Matriz de severidad

### Critico

- Secreto real expuesto.
- Bypass de auth.
- Corrupcion de datos.
- Prediccion imposible servida como valida.
- App no arranca en entorno soportado.

### Alto

- Permisos incorrectos en endpoint protegido.
- Flujo principal roto.
- Divergencia train/inference.
- CI no corre tests.
- Vulnerabilidad explotable.

### Medio

- Manejo de error incompleto.
- Deuda que bloquea cambios cercanos.
- Performance mala pero no bloqueante.
- Falta test en flujo importante.
- Setup incompleto.

### Bajo

- Limpieza de codigo.
- Nombres confusos.
- Duplicacion menor.
- Mejoras visuales.
- Documentacion secundaria.

## 7. Comandos canonicos

### Estado

```bash
git status --short
git branch --show-current
git log -5 --oneline
```

### Backend

```bash
make setup
make backend
make test
```

Directo:

```bash
cd app/backend
venv/bin/pytest -q
venv/bin/uvicorn main:app --port 8000 --reload
```

### Frontend

```bash
make frontend
# abrir http://localhost:5500
```

### Busquedas utiles

```bash
rg -n "TODO|FIXME|HACK|XXX|password|secret|token|api_key|GROQ|JWT|CORS|eval\(|exec\(" .
rg -n "except Exception|pass$|print\(|raise HTTPException" app/backend src/wasi
rg -n "fetch\(|localStorage|sessionStorage|innerHTML" app
```

### Dependencias

```bash
cd app/backend
venv/bin/pip list
venv/bin/pip check
venv/bin/pip-audit -r requirements.txt
```

## 8. Definition of Done global

La auditoria completa se considera cerrada cuando:

- Todos los sprints estan cerrados o bloqueados con causa concreta.
- `src/wasi/AUDIT_LOG.md` existe y esta completo.
- `src/wasi/CHANGELOG_AUDITORIA.md` existe y esta completo.
- `src/wasi/AUDIT_FINAL_REPORT.md` existe.
- La suite final corre o sus fallos estan documentados.
- QA Codex Agent aprobo el cierre final o sus objeciones fueron resueltas/aceptadas.
- README y comandos principales permiten levantar el proyecto sin memoria oral.

## 9. Primer siguiente paso recomendado

Ejecutar Sprint 1 sin tocar comportamiento funcional:

1. Capturar estado git.
2. Ejecutar tests.
3. Crear `AUDIT_LOG.md`, `CHANGELOG_AUDITORIA.md`, `AUDIT_BASELINE.md` dentro de `src/wasi/`.
4. Inventariar archivos sensibles/generados.
5. Pasar QA Codex Agent del baseline.
6. Registrar cierre del sprint.
