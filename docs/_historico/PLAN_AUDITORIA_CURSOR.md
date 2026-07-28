# Brief de auditoría integral — Wasi (para Cursor Composer)

> Eres un agente senior con acceso de lectura a todo el repositorio. Tu misión:
> **auditar el proyecto Wasi de punta a punta** y entregar un informe de hallazgos
> **rankeado por ROI** (impacto de negocio/usuario ÷ esfuerzo), cubriendo bugs,
> correctitud, rigor de datos/ML, lógica de negocio, UX/UI, fluidez, seguridad y
> performance. **No cambies código todavía**: primero el informe; el humano
> aprueba qué se ejecuta.

---

## 0. Reglas de trabajo (innegociables)

1. **Audita primero, no toques código.** Entrega el informe de la sección 8 y espera aprobación antes de editar nada.
2. **No re-descubras lo ya resuelto.** Lee `docs/AUDITORIA_INTEGRAL_2026-07-05.md` (auditoría previa) y `docs/BITACORA_FORMS.md` (6 sprints ya ejecutados). Reporta solo lo **pendiente** o **nuevo**. Si algo listado como cerrado en la bitácora en realidad no está bien resuelto, dilo explícitamente con evidencia.
3. **Verifica en el código, no en la documentación.** El README hace afirmaciones (p. ej. "no hay data leakage", "escalado solo en train"). Tu trabajo es **confirmarlas leyendo el código y los notebooks reales**, no repetirlas. Si el código contradice al README, ese es un hallazgo.
4. **Rankea por ROI.** Cada hallazgo con severidad + esfuerzo estimado (S/M/L) + impacto en negocio o usuario. Ordena por retorno, no por orden de descubrimiento.
5. **Idioma:** español peruano neutro. Nada de rioplatense (vos/querés/ingresá).
6. **Corre lo que puedas.** Levanta el backend y los tests para verificar afirmaciones en vivo cuando aplique (ver sección 1).

---

## 1. Contexto del proyecto

**Wasi** — plataforma proptech (Lima): estima el precio de referencia de un
departamento (alquiler o venta) con XGBoost y funciona como marketplace.

**Stack:**
- Backend: FastAPI + SQLAlchemy 2 + Pydantic v2 + SQLite. Código en `app/backend/`.
- Paquete ML instalable: `src/wasi/` (`pip install -e .`) — features + modelos.
- Pipeline ML / notebooks: `notebooks/01..05` + `11`, scripts en `app/backend/scripts/`, `ventas_model/`.
- Frontend: React 18 **sin build** (Babel standalone en el navegador). `app/*.jsx`, `app/styles.css`, `app/api.js`.
- Modelo de alquiler: XGBoost, 101 features, MAPE espacial 16.4%. Modelo de venta: 22 features, MAPE 15.8%.

**Cómo levantar (para verificar en vivo):**
```bash
# Backend — el puerto 8000 suele estar ocupado por Docker; usar 8001.
cd Proyecto_DPD
PYTHONPATH=app/backend app/backend/venv/bin/python -m uvicorn app.backend.main:app --host 0.0.0.0 --port 8001
# Frontend
cd Proyecto_DPD/app && python3 -m http.server 5500   # abrir index.html#api8001
# Tests (piso: 166 passed, 2 skipped)
WASI_RATELIMIT=0 WASI_SKIP_BULK_SEED=1 app/backend/venv/bin/python -m pytest app/backend/tests/ -q
```

**Ya resuelto (NO re-reportar, solo verificar que sigue bien):** soporte de venta
e2e, tildes de distrito, editar/pausar avisos, navegación móvil, errores en
español, paginación del catálogo, sanity-filter de gangas, bloqueo de self-leads,
PII fuera del catálogo. Detalle en la bitácora.

**Pendiente conocido (confirmar y dimensionar, no re-descubrir):** build de
producción (hoy React dev + Babel en runtime), Postgres en Render, focus-trap en
modales, conteos cosméticos del hero, recuperación de contraseña.

---

## 2. Workstream A — Rigor de datos y ML (PRIORIDAD ALTA)

Este es el foco especial. Verifica **en el código y notebooks reales** cada punto.
No confíes en el README. Archivos: `notebooks/01_limpieza.ipynb`,
`02_eda.ipynb`, `03_feature_engineering.ipynb`, `04_entrenamiento_modelos.ipynb`,
`05_evaluacion_seleccion.ipynb`, `11_analisis_residuos.ipynb`, `src/wasi/features/*`,
`src/wasi/models/*`, `ventas_model/*`, `app/backend/scripts/*`.

### A.1 — Data leakage por preprocesamiento antes del split (CRÍTICO)
El riesgo: si el **escalado, target encoding, imputación de nulos o cualquier
estadística** (media, mediana, percentiles, min/max) se calcula sobre el dataset
completo **antes** de dividir en train/test, el modelo "ve" indirectamente el test
y la evaluación queda inflada. En producción nunca tendrás el "futuro" para
calcular esas estadísticas.

Verifica, con número de celda/línea como evidencia:
- **StandardScaler / normalización**: ¿`fit` solo sobre train y `transform` sobre test? ¿O `fit_transform` sobre todo el dataset? (El README dice "solo para modelos lineales" — confirma que es cierto y que no filtra.)
- **Target encoding del distrito** (`src/wasi/models/model_service.py`, `target_enc_distrito_v2.joblib`, notebook 03): ¿se ajusta **por fold** dentro del GroupKFold, usando solo el train de cada fold? ¿O se ajustó una vez sobre todo el dataset? Esta es la fuga más común y sutil.
- **Imputación de nulos** (mediana agrupada, `dist_nearest_m_*` con percentil 95): ¿los estadísticos salen **solo del train**? El README afirma "después del split, percentil 95 solo sobre train" — verifícalo en el notebook.
- **Caps de outliers** (recorte de precio/m²): ¿los umbrales se calculan sobre train o sobre todo?
- **GroupKFold espacial**: ¿la celda de agrupación (`coord_cell`) evita de verdad que dos avisos del mismo edificio caigan en train y test a la vez? ¿El `split aleatorio 15.7%` vs `espacial 16.4%` es reproducible corriendo el código?

**Entregable de A.1:** por cada transformación, dictamen `SIN FUGA` / `CON FUGA` /
`NO VERIFICABLE`, con la celda exacta. Si hay fuga real, estimar cuánto podría
estar inflada la métrica y cómo corregirlo (fit dentro del Pipeline/por fold).

### A.2 — Interacciones entre variables
El modelo aditivo puro no captura efectos "cuando A y B son ciertos a la vez pasa
algo extra" (p. ej. ubicación premium × tamaño grande). XGBoost las captura solo
por su estructura de árboles, pero hay features de interacción **explícitas**
(`area_x_amenities`, `ratio_area_banos`, `area_por_dormitorio`, `antiguedad_sq`).
Verifica:
- ¿Estas interacciones aportan señal real o son redundantes? (Revisa importancia de features / SHAP global si está.)
- ¿Falta alguna interacción con justificación de dominio evidente que no se está capturando? (p. ej. NSE × distancia al mar, dormitorios × área.)
- ¿Hay multicolinealidad entre features derivadas y sus originales (VIF)? El notebook 03 menciona VIF — confirma que se actuó sobre él.

### A.3 — Selección de características
El pipeline tiene 101 features. Evalúa si hay features muertas o redundantes:
- ¿Se aplicó alguna selección (filtro: varianza/correlación/chi²/info-gain; wrapper: RFE; embebido: L1/importancia RF-XGB)? ¿O entraron las 101 sin poda?
- Identifica features con **varianza ~0** (mismo valor en casi todas las filas) o **correlación altísima entre sí** (redundantes) que se podrían quitar sin perder MAPE — menos features = modelo más simple, rápido y menos sobreajustable.
- ¿Alguna feature tiene importancia ~0 en el modelo entrenado? Lístalas.

### A.4 — Manejo de datos faltantes
Clasifica los nulos del dataset como MNAR / MAR / MCAR y evalúa si el tratamiento
es correcto:
- ¿Se eliminan filas con nulos? Si el faltante está **correlacionado con otra variable** (MAR) — p. ej. avisos sin cierta amenity concentrados en un tipo de distrito —, borrar filas **sesga** el dataset. Verifica que no se esté haciendo esto.
- ¿Se rellena con media/mediana/moda (correcto) o con "valores plausibles inventados" (incorrecto)?
- Amenities `tiene_*` ausentes: el README dice que se tratan como 0 (ausencia estructural), no como faltante. ¿Es coherente con cómo el portal realmente reporta? ¿Podría un `tiene_piscina=0` significar "no reportado" en vez de "no tiene", introduciendo sesgo?
- Columnas con >70% de nulos: ¿se eliminaron? ¿lo que quedaba seguía correlacionando con el precio (útil pese a estar mayormente vacío)?

### A.5 — Sesgo de retransformación (ya conocido)
El modelo entrena en `log1p` y retransforma con `expm1` → sesgo de Jensen
(sobreestima). Está documentado como limitación. Evalúa si vale la pena aplicar
**smearing de Duan** o Box-Cox, y cuantifica el impacto real en MAPE/USD.

### A.6 — Honestidad de las métricas reportadas
- ¿El R² 0.847 y el MAPE 16.4% son del **mismo esquema de validación**? (En venta se detectó antes que el R² 0.856 era de split aleatorio y el MAPE 15.8% espacial — no mezclar.)
- ¿El coverage P25–P75 (41.7% vs 50% teórico) sigue así? ¿Conformal prediction lo arreglaría sin reentrenar?
- ¿Las cifras del README/informe coinciden con lo que produce el código hoy?

---

## 3. Workstream B — Correctitud y bugs

Backend (`app/backend/`) y frontend (`app/*.jsx`). Busca:
- Errores de contrato front↔back (campos que el front asume y el back puede omitir → `undefined`/crash).
- Manejo de errores incompleto, promesas sin catch, `catch(()=>{})` que tragan fallos.
- Estados de carga/vacío/error faltantes o rotos.
- Race conditions (fetch sin abort al desmontar, respuestas fuera de orden).
- Validaciones inconsistentes entre front y back.
- Casos borde: inputs extremos, nulos, fuera de rango, sesión expirada a mitad de flujo.
- Reglas de negocio mal implementadas (veredictos de precio, zonas Ganga/Justo/Inflado coherentes entre catálogo, FairValue y publicación).

Corre la suite de tests y reporta si algún test es débil, tautológico, o si falta
cobertura en un flujo crítico.

---

## 4. Workstream C — Negocio y producto

- ¿Qué features de negocio faltan para que esto sea usable de verdad? (p. ej. no hay recuperación de contraseña, ni verificación de email, ni edición de ubicación de un aviso, ni notificaciones reales.)
- ¿El flywheel oferta↔demanda (publicar → leads) tiene fricciones que matan conversión?
- ¿Hay funcionalidad "decorativa" presentada como real (campana de notificaciones vacía, planes de pago sin flujo, "soporte 24-48h" sin backend)? Listar para decidir si ocultar o implementar.
- Oportunidades de negocio de bajo esfuerzo/alto impacto (compartir aviso, guardar búsqueda, alertas de precio, comparar inmuebles).

---

## 5. Workstream D — UX/UI, fluidez y user-friendliness

- Recorre cada pantalla como usuario real (desktop y móvil 360–390px). Reporta fricciones, pasos innecesarios, copy confuso, jerarquía visual pobre.
- Fluidez: transiciones, estados de carga percibidos, feedback inmediato a acciones, optimistic updates donde falten.
- Coherencia visual: ¿mismos componentes/espaciados/colores en toda la app, o cada pantalla inventa el suyo? (Hay doble sistema de colores semánticos reportado.)
- Accesibilidad restante: focus-trap en modales, `aria-live` en el banner de error, pausa del carrusel del hero, contraste de textos pequeños.
- Datos hardcodeados/mock presentados como reales (HERO_LISTINGS, "Distribución real" sobre una gaussiana sintética, conteos de distritos inconsistentes: hero dice 40, mapa 29, catálogo 39).
- Onboarding: ¿un usuario nuevo entiende qué hace la app y da su primer paso sin perderse?

---

## 6. Workstream E — Seguridad y performance

**Seguridad** (verificar, gran parte ya está sólida server-side):
- JWT en localStorage (expuesto a XSS), sin refresh ni revocación — evaluar riesgo real y mitigación.
- Rate limiting: solo en `/auth/*`; `POST /listings` sin límite (spam del catálogo).
- Exposición de PII: confirmar que `contact_email`/`phone` no viajan a terceros en ningún endpoint.
- Validación de `image_url` (data:image vs javascript:) y tamaño de payloads.

**Performance:**
- Frontend sin build: React dev + Babel transpila ~6,000 líneas en el navegador en cada visita + cache-busting `Date.now()` que anula caché. **Este es el mayor costo de performance** — dimensionar y proponer build mínimo (esbuild) SIN romper la estructura de archivos, como propuesta a aprobar.
- Requests redundantes (un resultado de FairValue dispara ~6 llamadas; simulador duplica cálculo al montar).
- Índices de DB, N+1 restantes, timeouts vs cold start de Render.

---

## 7. Workstream F — Tests, CI e infraestructura

- Estado del CI (`ci.yml`): ¿corre? ¿usa la misma versión de Python que producción? ¿incluye `pip install -e .`?
- Cobertura de tests: ¿los flujos nuevos (venta, editar/pausar, paginación) tienen tests? ¿hay tests frágiles?
- Reproducibilidad del pipeline ML: ¿se puede regenerar el modelo desde los notebooks y obtener las mismas métricas? ¿Los artefactos (`.joblib`) están versionados o se regeneran?
- Deploy: `render.yaml`, Postgres efímero en free tier, `.env` y secretos.

---

## 8. Formato del informe (tu único entregable en esta fase)

Un archivo `docs/HALLAZGOS_AUDITORIA_CURSOR.md` con:

1. **Resumen ejecutivo** (10 líneas): estado general + los 5 hallazgos de mayor ROI.
2. **Tabla priorizada** de todos los hallazgos:

   | # | Workstream | Hallazgo | Severidad | Esfuerzo (S/M/L) | Impacto (negocio/usuario/datos) | Archivo:línea |

   Ordenada por ROI (impacto alto ÷ esfuerzo bajo primero).
3. **Sección especial ML** (Workstream A) con el dictamen leakage por transformación (SIN FUGA / CON FUGA / NO VERIFICABLE + evidencia), y las mejoras de features/missing-data propuestas.
4. **Quick wins** (esfuerzo S, impacto alto): lo que conviene hacer primero.
5. **Lo que NO se debe tocar** y por qué (modelo congelado, contrato de FairValue).
6. **Preguntas para el humano** donde haya una decisión de producto/negocio (p. ej. ¿implementar o esconder la funcionalidad decorativa? ¿introducir build tool?).

Cuando entregues el informe, **detente y pide aprobación** antes de escribir código.
Al ejecutar (fase 2, ya aprobada): trabaja por lotes pequeños, corre los tests tras
cada lote (piso 166/2, cero regresiones), y documenta en `docs/BITACORA_FORMS.md`
con el mismo formato de los sprints existentes.
```
```

---

## 9. Restricciones al ejecutar (fase 2)

- **No toques el modelo ML congelado** ni el pipeline de features sin marcarlo como cambio de alto riesgo que requiere reentrenar y re-validar con GroupKFold espacial. Si A.1 encuentra fuga real, ese reentrenamiento es el hallazgo — no lo hagas sin aprobación explícita.
- **No rompas** FairValue ni el contrato `PredictIn/PredictOut` (está congelado).
- **Sin dependencias nuevas de frontend** ni bundler sin aprobación (romper "sin build" es decisión del humano).
- **Migraciones de DB retrocompatibles** (hay ~3,300 listings sembrados).
- **No commitees ni pushees** sin aprobación. Todo el trabajo va en la rama `refactor/modular`, nada a `main`.
