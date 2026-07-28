# Tareas para Cursor Composer — una por agente, en paralelo

Cada bloque de abajo es una **tarea independiente y directa** para UN Composer.
Copia un bloque, pégalo en un Composer, y dispara. Son read-only (auditan, no
tocan código) y cada una escribe a **su propio archivo** en `docs/hallazgos/`
para que no choquen entre sí.

Reglas comunes (ya están dentro de cada tarjeta, no hace falta repetirlas):
audita y reporta, NO cambies código; da evidencia con archivo:línea o celda;
español peruano neutro; si algo ya está resuelto en `docs/BITACORA_FORMS.md`, no
lo reportes.

Recomendación: lanza primero las 5 de ML (T1–T5), que son el mayor riesgo. Luego
las demás. No dispares 20 de golpe: 5–6 a la vez, revisa, sigue.

---

## T1 · Leakage del target encoding (CRÍTICO)

```
Eres auditor de ML. Tarea única: determinar si el TARGET ENCODING del distrito en
el proyecto Wasi tiene data leakage.

Lee: notebooks/03_feature_engineering.ipynb, notebooks/04_entrenamiento_modelos.ipynb,
src/wasi/models/model_service.py, y el artefacto target_enc_distrito_v2.joblib
(cómo se genera). Busca app/backend/scripts/generate_model_artefacts_v2.py.

Pregunta a responder con evidencia (celda/línea):
El encoding del distrito (precio promedio por distrito) ¿se ajusta SOLO con el
train de cada fold del GroupKFold, o se calculó una vez sobre todo el dataset
antes de dividir? Si es lo segundo, hay leakage y el MAPE 16.4% está inflado.

Entrega un archivo docs/hallazgos/t1_target_encoding.md con: dictamen (SIN FUGA /
CON FUGA / NO VERIFICABLE), la evidencia exacta, y si hay fuga, cómo corregirlo
(fit por fold dentro del pipeline) y cuánto podría cambiar la métrica.
NO toques código.
```

---

## T2 · Leakage de escalado e imputación

```
Eres auditor de ML. Tarea única: verificar si el ESCALADO y la IMPUTACIÓN de nulos
del proyecto Wasi filtran información del test.

Lee: notebooks/01_limpieza.ipynb, notebooks/03_feature_engineering.ipynb,
src/wasi/features/*.py.

Responde con evidencia (celda/línea):
1. StandardScaler/normalización: ¿fit solo en train o fit_transform sobre todo el
   dataset? (El README dice que solo se usa en modelos lineales — confírmalo.)
2. Imputación (mediana agrupada; dist_nearest_m_* con percentil 95): ¿los
   estadísticos salen SOLO del train, después del split? ¿o de todo el dataset?
3. Caps de outliers de precio/m²: ¿umbral calculado sobre train o sobre todo?

Entrega docs/hallazgos/t2_escalado_imputacion.md con dictamen por punto (SIN FUGA /
CON FUGA / NO VERIFICABLE) + evidencia + corrección si aplica. NO toques código.
```

---

## T3 · Correctitud del GroupKFold espacial

```
Eres auditor de ML. Tarea única: verificar que la validación espacial de Wasi es
honesta.

Lee: notebooks/04_entrenamiento_modelos.ipynb, notebooks/05_evaluacion_seleccion.ipynb,
src/wasi/features/geo_index.py (clave coord_cell), ventas_model/build_features_venta.py.

Responde con evidencia:
1. ¿La clave de agrupación (coord_cell / celda geográfica) impide de verdad que
   dos avisos casi en las mismas coordenadas (mismo edificio) caigan uno en train
   y otro en test?
2. El contraste split aleatorio 15.7% vs espacial 16.4% ¿es reproducible corriendo
   el código? ¿Los dos números salen del mismo pipeline?
3. ¿El R² 0.847 y el MAPE 16.4% son del MISMO esquema de validación, o se mezcla
   un R² de split aleatorio con un MAPE espacial? (En venta ya se detectó esa
   mezcla.)

Entrega docs/hallazgos/t3_groupkfold.md con dictamen + evidencia. NO toques código.
```

---

## T4 · Selección de features y features muertas

```
Eres auditor de ML. Tarea única: encontrar features redundantes o inútiles en el
modelo de alquiler de Wasi (101 features).

Lee: notebooks/03_feature_engineering.ipynb, src/wasi/models/model_service.py
(feature_order, feature_importances), src/wasi/models/ml_v2.py.
Si puedes, carga el modelo y saca la importancia de cada feature:
  PYTHONPATH=app/backend app/backend/venv/bin/python -c "
  from wasi.models.model_service import model_service; model_service.load()
  print(model_service.feature_importances)"

Responde con evidencia:
1. ¿Se aplicó alguna selección de features (varianza, correlación, VIF, RFE, L1,
   importancia)? El notebook 03 menciona VIF — ¿se actuó sobre él?
2. Lista features con importancia ~0, varianza ~0 (mismo valor casi siempre), o
   correlación altísima entre sí (redundantes) que se podrían quitar sin perder
   MAPE.
3. ¿Faltan interacciones con justificación de dominio (NSE×distancia al mar,
   dormitorios×área) que darían señal?

Entrega docs/hallazgos/t4_features.md con la lista concreta de features a podar y
las que valdría la pena agregar. NO toques código ni reentrenes.
```

---

## T5 · Manejo de datos faltantes y sesgo

```
Eres auditor de ML. Tarea única: evaluar si Wasi maneja los datos faltantes sin
sesgar el dataset.

Lee: notebooks/01_limpieza.ipynb, notebooks/02_eda.ipynb.

Responde con evidencia (celda):
1. Clasifica los principales nulos del dataset como MNAR / MAR / MCAR.
2. ¿Se eliminan filas con nulos? Si el faltante correlaciona con otra variable
   (MAR), borrar filas SESGA el dataset (ej. borrar todos los avisos de cierto
   tipo de zona). ¿Está pasando?
3. Amenities tiene_* ausentes tratadas como 0: ¿"no tiene" o "no reportado"?
   Si el portal no reporta la amenity y se codifica 0, podría meter sesgo.
   Evalúa si es correcto.
4. ¿Se rellena con media/mediana/moda (correcto) o con valores "plausibles"
   inventados (incorrecto)? ¿Columnas con >70% nulos: se eliminaron sin evaluar
   si lo que quedaba seguía siendo útil?

Entrega docs/hallazgos/t5_missing_data.md con dictamen + riesgos de sesgo concretos.
NO toques código.
```

---

## T6 · Bugs de backend

```
Eres auditor senior de FastAPI. Tarea única: encontrar bugs de correctitud en el
backend de Wasi. NO toques código.

Lee: app/backend/routers/*.py, app/backend/schemas.py, app/backend/auth.py,
app/backend/main.py, app/backend/database.py. Ya está resuelto lo de
docs/BITACORA_FORMS.md — no lo re-reportes.
Levanta el backend en :8001 y prueba endpoints con curl si ayuda.

Busca: manejo de errores incompleto, casos borde sin cubrir, validaciones
inconsistentes, reglas de negocio mal implementadas (veredictos Ganga/Justo/
Inflado coherentes entre catálogo/FairValue/publicación), fugas de PII, race
conditions, respuestas que rompen el contrato con el frontend.

Entrega docs/hallazgos/t6_backend_bugs.md: cada bug con [severidad] + archivo:línea
+ cómo reproducirlo + impacto.
```

---

## T7 · Bugs de frontend y contrato con el backend

```
Eres auditor senior de React. Tarea única: encontrar bugs en el frontend de Wasi.
NO toques código. Es React 18 SIN build (Babel standalone).

Lee: app/*.jsx, app/api.js. Ya está resuelto lo de docs/BITACORA_FORMS.md — no lo
re-reportes.

Busca: accesos encadenados sin guard (x.y.z → crash si el backend omite un campo),
promesas sin catch o catch(()=>{}) que tragan errores, estados de carga/vacío/error
faltantes, fetch sin abort al desmontar (race), hooks condicionales (rules of
hooks), interpolaciones que muestran "undefined", memory leaks.

Entrega docs/hallazgos/t7_frontend_bugs.md: cada bug con [severidad] + archivo:línea
+ cómo se dispara + impacto en el usuario.
```

---

## T8 · UX/UI y fluidez

```
Eres diseñador de producto senior. Tarea única: auditar la experiencia de Wasi
pantalla por pantalla y proponer mejoras de UX/UI y fluidez. NO toques código.

Levanta backend :8001 + frontend :5500 (index.html#api8001). Recorre cada pantalla
en desktop y en móvil (390px). Usuarios: ana@wasi.pe / demo1234 (inquilino);
crea un Propietario vía registro para ver el flujo de vendedor.

Busca: fricciones y pasos innecesarios, copy confuso, jerarquía visual pobre,
falta de feedback a las acciones, transiciones/estados de carga percibidos,
incoherencia visual entre pantallas, onboarding poco claro para un usuario nuevo.

Entrega docs/hallazgos/t8_ux_ui.md: cada hallazgo con pantalla + problema + mejora
propuesta + esfuerzo estimado (S/M/L). Ordena por impacto en conversión/claridad.
```

---

## T9 · Copy y honestidad de datos mostrados

```
Eres editor de producto. Tarea única: encontrar en el frontend de Wasi textos
confusos, en mal español, o datos mock presentados como reales. NO toques código.

Lee todos los app/*.jsx.

Busca: (1) datos hardcodeados presentados como reales — HERO_LISTINGS, "Distribución
real" sobre una gaussiana sintética, conteos de distritos inconsistentes (hero dice
40, mapa 29, catálogo 39). (2) Funcionalidad decorativa que parece real: campana de
notificaciones vacía, planes de pago sin flujo, "soporte 24-48h" sin backend.
(3) Copy en inglés colado, rioplatense (vos/querés), errores del backend mostrados
crudos, tildes/mayúsculas mal.

Entrega docs/hallazgos/t9_copy.md: cada hallazgo con archivo:línea + qué dice hoy +
qué debería decir o si conviene ocultar la función. Marca lo que es "mentira al
usuario" (mock como real) como severidad alta.
```

---

## T10 · Oportunidades de negocio

```
Eres product manager. Tarea única: proponer mejoras de NEGOCIO de alto ROI para
Wasi (marketplace inmobiliario de Lima con estimador de precios IA). NO toques código.

Lee docs/BITACORA_FORMS.md y recorre la app (backend :8001, frontend :5500) para
entender qué existe. NO propongas lo que ya está.

Busca: features que faltan y matan conversión (no hay recuperación de contraseña,
verificación de email, alertas de precio, guardar búsqueda, compartir aviso,
comparar inmuebles), fricciones del flywheel publicar→leads, y quick-wins de alto
impacto/bajo esfuerzo.

Entrega docs/hallazgos/t10_negocio.md: cada idea con problema que resuelve +
impacto esperado + esfuerzo (S/M/L). Ordena por ROI.
```

---

## T11 · Seguridad

```
Eres auditor de seguridad. Tarea única: revisar la seguridad de Wasi. NO toques
código. La seguridad server-side ya está mayormente sólida (ver bitácora) — busca
lo que falta.

Lee: app/backend/auth.py, app/backend/routers/*.py, app/api.js, app/index.html.

Busca: JWT en localStorage (XSS) sin refresh ni revocación, rate limiting solo en
/auth (POST /listings sin límite = spam), exposición de PII en algún endpoint,
validación de image_url (data:image vs javascript:), tamaño de payloads,
secretos/.env, SRI faltante en scripts CDN.

Entrega docs/hallazgos/t11_seguridad.md: cada riesgo con severidad + vector +
mitigación concreta.
```

---

## T12 · Performance

```
Eres ingeniero de performance. Tarea única: encontrar los mayores costos de
rendimiento de Wasi. NO toques código.

Lee: app/index.html, app/api.js, app/*.jsx, app/backend/routers/*.py.

Busca: el costo del setup SIN build (React dev + Babel transpila ~6,000 líneas en
el navegador en cada visita + cache-busting Date.now() que anula la caché) —
dimensiona el impacto y propón un build mínimo con esbuild SIN cambiar la
estructura de archivos. Además: requests redundantes (un resultado de FairValue
dispara ~6 llamadas), N+1 restantes, falta de índices en DB, timeouts vs cold
start de Render.

Entrega docs/hallazgos/t12_performance.md: cada hallazgo con impacto estimado +
solución propuesta + esfuerzo. El build tool marcarlo como "requiere aprobación
del humano".
```

---

## Después de que corran todas

Cuando tengas los 12 archivos en `docs/hallazgos/`, pásaselos a tu orquestador
(Claude) para consolidar en un solo informe priorizado por ROI y decidir qué se
ejecuta y en qué orden. NINGÚN Composer debe cambiar código todavía.
```
```
