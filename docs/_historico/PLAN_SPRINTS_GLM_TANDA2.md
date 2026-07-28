# Plan de Sprints — Tanda 2 (ejecuta: GLM-4.6 / z.ai)

**Proyecto:** Wasi (FastAPI + XGBoost + React/Vite)
**Rama de trabajo:** `refactor/modular` (NO tocar `main`)
**Origen del backlog:** `docs/HALLAZGOS_CODEX.md` — hallazgos que quedaron fuera de la Tanda 1 (Sprint 12).
**Estado previo:** Sprints 0–12 cerrados. Piso de tests = **174 passed / 2 skipped**. Backend Wasi corre en `:8001` (`model_mode: v2`, `venta_model_loaded: true`). Frontend Vite: dev `:5173`, build servido en `:5500`. Override de API en el browser con hash `#api8001` o `localStorage['wasi.apibase']`.

---

## 0. Cómo tienes que trabajar (LEE ESTO ANTES DE ESCRIBIR UNA LÍNEA)

Eres GLM-4.6, el modelo más capaz de z.ai. No quiero un ejecutor mecánico: quiero que **razones cada cambio, verifiques con evidencia real (no supuestos) y te niegues a romper lo que ya funciona**. Exijo tu mejor nivel:

1. **No confíes en el hallazgo a ciegas.** Cada ítem de Codex lo reproduces primero (probe API / DOM / lectura del archivo en la línea citada). Si al reproducir resulta que el fix de la Tanda 1 ya lo cubrió o el hallazgo es falso, **lo marcas como "no aplica" con la evidencia** y sigues. No inventes trabajo.
2. **Lotes pequeños, verificables.** Un cambio → una verificación → siguiente. Nada de refactors masivos que no puedas probar de una.
3. **Cero scope creep.** Arreglas EXACTAMENTE el hallazgo. No "de paso" toques módulos adyacentes "por consistencia". Si ves algo nuevo, lo anotas en la bitácora como hallazgo, no lo arreglas sin aprobación.
4. **Respeta lo intocable** (`HALLAZGOS_CODEX.md` §5): el artefacto `modelo_final_v2.joblib` y el contrato FairValue (golden predictions + validación de arranque), el MAPE / validación espacial, el bundler (Vite se queda), el umbral de zona 8%. **Si un fix te obliga a regenerar el modelo, PARA y escala al humano.**
5. **Español peruano neutro** en todo copy de UI (nada de "querés/decime"). Comentarios de código en español.
6. **Autoría de commits 100% limpia** — sin trailer `Co-Authored-By`, sin mención a IA. Mensajes en español, imperativo, descriptivos.
7. **NO commitees a `main`, NO hagas push, NO merges.** Trabajas y commiteas en `refactor/modular`. El push lo autoriza el humano.

### Las 3 reglas innegociables de cada Sprint

**A) Sprint Goal.** Cada Sprint tiene UN objetivo central. El Sprint NO se cierra "porque hiciste los ítems", se cierra **porque el objetivo se cumple y está demostrado con evidencia**. Si un ítem queda a medias, el Sprint sigue abierto o el ítem se difiere explícitamente con justificación en la bitácora.

**B) Protocolo Anticagadas (QA con agentes Claude Sonnet).** Al final de cada Sprint, ANTES de commitear, corres una fase de QA profunda:
   - **Regresión automática:** `pytest app/backend/tests/ -q` debe dar **≥ 174 passed** (nunca menos que el piso; si el sprint agrega tests, el piso sube). Si baja, el sprint NO cierra.
   - **Build check:** `cd web && npm run build` sin errores. Anota tamaño de bundle y warnings.
   - **Agentes Sonnet revisores** — configura 2–3 agentes Claude Sonnet en paralelo, cada uno con un rol acotado y SOLO-LECTURA sobre el diff del sprint:
     - *Revisor de regresión:* "Aquí está el diff de los archivos [X,Y,Z]. Tu única tarea: encontrar qué proceso ANTERIOR pude haber roto. Revisa imports, contratos de funciones, side-effects, orden de decoradores, y flujos que consumían lo que cambié. No evalúes si el fix es bueno; evalúa qué se rompió alrededor."
     - *Revisor de correctitud:* "¿El fix realmente resuelve el hallazgo #N de HALLAZGOS_CODEX.md? Reproduce el caso original y el caso corregido. Dame el antes/después con evidencia (curl/DOM/lectura)."
     - *Revisor adversarial (sprints de seguridad/ML):* "Intenta romper este fix. Construye el input malicioso o el edge-case que lo evada."
   - Cada agente devuelve veredicto **CONFIRMADO / PROBLEMA** con evidencia. Si alguno reporta PROBLEMA real, lo arreglas y re-corres QA. El sprint cierra solo con todos en verde.
   - **Verificación en vivo** del flujo tocado (browser MCP en `:5500/#api8001` o probe API en `:8001`). Adjunta la salida real, no "debería funcionar".

**C) Guardado de progreso (bitácora / changelog).** Al cerrar cada Sprint haces **append** (nunca reescribir) a `docs/BITACORA_FORMS.md` con este formato exacto:

```
## Sprint N — <título> — <fecha>
- **Sprint Goal:** <objetivo central, 1 frase>
- **Hallazgos cerrados:** #… (de HALLAZGOS_CODEX.md)
- **Qué se cambió:** <archivo:línea → cambio, por bullet>
- **QA (Protocolo Anticagadas):**
  - pytest: <N passed / M skipped>
  - build: <ok/kb/warnings>
  - Agentes Sonnet: <rol → veredicto + evidencia resumida>
  - Verificación en vivo: <flujo → resultado real>
- **Riesgos / deuda aceptada:** <lo que se difirió y por qué>
- **Estado:** CERRADO ✅ / ABIERTO
```

Este formato es la **memoria del proyecto**: si el contexto se autocompacta, la bitácora reconstruye qué se tocó y con qué resultado por ciclo. Verifica con `cat` que las filas quedaron escritas antes de dar el sprint por cerrado.

---

## 1. Backlog restante (post Tanda 1)

Ya cerrados en Sprint 12 (NO re-hacer): #2, #3, #4, #5, #8, #10, #11, #12, #13, #14.

**Decisiones del humano (NO son código — no las ejecutes, quedan fuera de tu alcance):** #1 CORS prod (dominio Vercel), #6 Postgres en Render, #15 planes Pro/campana (ocultar vs implementar).

**Tu backlog** (todo lo demás, agrupado por Sprint abajo): #7, #9, #16, #17, #18, #19, #20, #21, #23, #24, #25, #26, #27, #28, #31, #33, #34, #35, #36.

**Zona roja (tocan el modelo — NO ejecutar sin aprobación explícita; solo documentar):** #22 (cobertura conformal), #29 (amenities MNAR), #30 (sesgo Jensen). Si crees que alguno vale la pena, escríbelo como propuesta en la bitácora y PARA.

---

## Sprint 13 — Navegación de browser real y estado sano

**Sprint Goal:** que Back/Adelante/F5 del navegador se comporten como en cualquier web (restauran pantalla y no expulsan de la app) y que no queden estados de UI huérfanos ni races al navegar rápido. Se cierra cuando el flujo Home→Detalle→Back→Adelante→F5 conserva la pantalla correcta, demostrado en browser MCP.

**Hallazgos:** #9 (History API), #26 (AbortController), #27 (screen huérfana tras cambio de rol), #24 (DashboardScreen muerto).

- **#9 — History API.** `App.jsx:86` usa `useState(screen)` sin `pushState`/`popstate`. Implementa sincronización screen↔history: cada navegación hace `history.pushState({screen, ...ctx}, '')`; un listener `popstate` restaura `screen` y contexto (id de listing, paso de wizard). F5 debe rehidratar desde `history.state` o desde la URL/hash. No cambies el modelo de rutas a react-router (sería scope creep y choca con el stack decidido); usa History API nativa sobre el estado existente.
- **#26 — AbortController.** `AddressSearch` ya aborta; Home load, Listings load, Publish Nominatim y Leads no. Añade `AbortController` a cada `fetch` con cleanup en el `useEffect` (o al re-disparar), para matar el `setState` sobre componente que ya navegó.
- **#27 — screen huérfana.** `onUserChanged` solo bump de `userVersion`. Al cambiar de rol (Inquilino↔Propietario), si la `screen` actual no existe para el nuevo rol, resetea a la pantalla default de ese rol (listings / mispropiedades). Verifica: estar en "Explorar" como Inquilino → cambiar a Propietario → no debe quedar sin tab activa.
- **#24 — DashboardScreen huérfano.** `App.jsx:267-275` renderiza `operaciones` pero ningún `onGo('operaciones')` lo alcanza. Decide con evidencia: si de verdad es inalcanzable y sin plan de uso, elimínalo (código muerto en el bundle). Si hay intención futura, déjalo pero anótalo. No lo dejes ambiguo.

**QA específico:** agente Sonnet de regresión sobre `App.jsx` (es el corazón de la nav — alto riesgo). Verificación en vivo obligatoria del ciclo Back/F5 con `history.state` inspeccionado por CDP.

---

## Sprint 14 — Performance de carga del frontend

**Sprint Goal:** partir el bundle monolítico y quitar peso muerto para que el TTI en móvil/prod baje de forma medible. Se cierra cuando `npm run build` produce **múltiples chunks** (ningún chunk JS > 500 kB, sin el warning de Vite) y las pantallas pesadas cargan por `React.lazy`, demostrado con el output del build antes/después.

**Hallazgos:** #7 (code-splitting), #25 (duplicación de componentes), #34 (fuentes self-host), #35 (`_leaflet_pos` global), #28 (dark mode residual).

- **#7 — Code-splitting.** `vite.config.js` sin `manualChunks`. Añade `manualChunks` separando vendors pesados (leaflet + markercluster, d3, react). Aplica `React.lazy` + `Suspense` a las pantallas grandes (FairValue wizard, Publish, mapa). Meta: chunk principal < 500 kB, sin warning. Reporta kb antes (664.33) y después.
- **#25 — Duplicación.** `ListingsScreen.jsx:10` importa de FairValue; paneles Counterfactual/MarketRange/POI duplicados entre publish/listings/fairvalue. Extrae los componentes compartidos a `web/src/shared/` y consúmelos desde ambos. Esto además destraba el code-split limpio (por eso va en el mismo sprint). NO cambies el comportamiento visual: es una extracción, no un rediseño.
- **#34 — Fuentes.** `index.html` carga Google Fonts CDN (FOIT / falla offline). Self-hostea las fuentes usadas (descarga los woff2, sírvelos desde `web/public` o vía `@fontsource`) y quita el `<link>` a googleapis.
- **#35 — `_leaflet_pos` global.** `App.jsx:100-106` tiene una contención global que puede enmascarar errores. Acótala al scope del mapa o documenta por qué debe seguir global. Bajo riesgo, pero no lo dejes silencioso.
- **#28 — Dark mode residual.** Stepper/chips con superficies claras (`oklch` claro) rompen contraste en tema oscuro. Alinea los overrides en `styles.css`. Verifica contraste real en el tema oscuro (browser MCP con dark activo).

**QA específico:** agente Sonnet de correctitud comparando render ANTES/DESPUÉS de la extracción #25 (que no haya drift visual). Adjunta el diff del output de `npm run build` (lista de chunks + tamaños).

---

## Sprint 15 — Hardening de backend (seguridad y escalabilidad de queries)

**Sprint Goal:** cerrar las superficies de abuso y los cuellos de botella de datos del backend sin romper contratos existentes. Se cierra cuando enumeración de emails, sesión JWT, queries en memoria e índices están endurecidos y probados con tests de regresión nuevos.

**Hallazgos:** #19 (enumeración de emails), #18 (JWT localStorage/logout), #21 (sort carga catálogo entero), #31 (`ensure_schema` frágil), #33 (índices compuestos).

- **#19 — Enumeración de emails.** `auth.py:24-26` devuelve 409 "El correo ya está registrado" → distingue cuentas. Decide la política: mantener 409 es defendible en un registro (UX > sigilo), pero si se quiere mitigar, unifica el mensaje o usa un flujo genérico. **Este ítem tiene trade-off UX/seguridad → propón tu recomendación en la bitácora y aplícala solo si es de bajo impacto; si cambia el flujo de registro visiblemente, escálalo.**
- **#18 — JWT.** Token en `localStorage`, logout solo cliente, sin revocación. Sin reescribir el auth: reduce el `exp` a algo razonable + evalúa refresh token, o al menos documenta el modelo de amenaza y añade la pieza de menor riesgo (p.ej. `exp` corto). **Revocación real = decisión de arquitectura → si implica blacklist/estado en DB, propón y PARA.**
- **#21 — Query en memoria.** `listings.py:237-255`: `sort=ganga`/`zone` carga ~3.4k rows por request. Mueve el orden/límite a SQL (o precomputa el score) para no escalar linealmente en memoria. Verifica que el resultado ordenado es idéntico al actual (mismo top-N).
- **#31 — `ensure_schema`.** `database.py:75-111` hace ALTER ad-hoc con `except: pass`. No introduzcas Alembic completo (scope), pero quita el `except: pass` mudo (loguea el error real) y deja el path preparado para migraciones. Mínimo: que un ALTER fallido no se trague silenciosamente.
- **#33 — Índices compuestos.** `models.py` Listing sin índices en `status/operacion/district`. Añade índices compuestos para los filtros reales del catálogo. Verifica que `ensure_schema` los crea sin romper la BD existente.

**QA específico:** agente Sonnet **adversarial** (intenta enumerar emails / reusar un JWT tras logout / romper el orden SQL de #21). Tests nuevos obligatorios para #19, #21, #33.

---

## Sprint 16 — Pipeline ML reproducible (SIN tocar el artefacto servido)

**Sprint Goal:** que re-entrenar el modelo de **venta** desde el repo funcione de punta a punta y que los gates validen el artefacto v2 real que se sirve — todo **sin regenerar `modelo_final_v2.joblib`** ni cambiar el contrato FairValue. Se cierra cuando `build_features_venta.py` importa bien y los gates corren contra v2.

**Hallazgos:** #17 (import muerto), #23 (gates forzados a v1), #16 (Babilonia descartada).

- **#17 — `geo_index` muerto.** `ventas_model/build_features_venta.py:14-15` importa `from geo_index` desde `app/backend`, pero el real vive en `src/wasi/features/geo_index.py`. Corrige el import al paquete `wasi` instalado (serving ya usa `wasi`). Verifica que el script de features de venta corre sin ImportError. **NO re-entrenes ni sobrescribas el joblib** — solo que el pipeline sea ejecutable.
- **#23 — Gates v1 vs v2.** `validate_pipeline.py` / `validate_build_features.py` con `DPD_FORCE_V1=1` mientras prod es `model_mode:v2`. Ajusta los gates para validar el artefacto v2 servido (o añade un gate v2 en paralelo). Cuida no romper el fail-fast de arranque (golden predictions). Si el contrato v1 se usa en otro lado, no lo elimines: agrega v2, no reemplaces a ciegas.
- **#16 — Babilonia.** `clean_ventas.py` descarta 415/415 filas de Babilonia porque `cocheras` es 100% NaN y `.between()` excluye NaN. Recupera esas filas tratando NaN como "no reportado" (imputación explícita o exclusión de esa condición del filtro), SIN reentrenar el modelo servido. **Objetivo de este ítem: dejar el dataset de features listo y documentado; el reentrenamiento con Babilonia es una decisión aparte (impacta el artefacto → §5).** Documenta cuántas filas se recuperan y el efecto esperado, y PARA antes de tocar el modelo.

**QA específico:** agente Sonnet de correctitud verifica que el import de #17 resuelve al `geo_index` correcto y que ningún gate quedó apagado. **Verifica que el arranque del backend sigue pasando las golden predictions** (no se rompió el contrato).

---

## Sprint 17 — Eficiencia de FairValue y cierre de huecos de tests

**Sprint Goal:** reducir la ráfaga de llamadas del wizard FairValue y cerrar los huecos de cobertura que dejó la auditoría, para que las regresiones de negocio/seguridad no pasen CI en silencio. Se cierra cuando FairValue hace el mínimo de requests necesario y la suite cubre los bordes auditados.

**Hallazgos:** #20 (ráfaga FairValue + `get_analysis` re-infiere), #36 (huecos de tests).

- **#20 — Ráfaga FairValue.** `FairValueScreens.jsx` dispara ~6 llamadas y `fairvalue.py get_analysis` re-predice. Consolida: cachea el resultado del predict en el cliente para no re-pedir lo mismo, y evita que `get_analysis` re-infiera si ya tiene el análisis. Mide llamadas antes/después (Network en browser MCP). No cambies los números que devuelve (mismo fair_value/zone).
- **#36 — Huecos de tests.** Añade tests para los bordes que la auditoría tocó y que no estaban cubiertos: CORS (origen permitido vs bloqueado), tope PATCH (ya hay uno de Tanda 1 — confirma), Lead phone, rate-limits (que respondan 429 al exceder), y el path de features de venta (#17). Meta: que un revert de cualquier fix de Tanda 1/2 haga fallar al menos un test.

**QA específico:** este sprint ES el QA del proyecto — corre la suite completa y confirma que cada fix de las dos tandas tiene un test que lo protege. Agente Sonnet de completitud: "¿qué hallazgo corregido sigue sin test?".

---

## 2. Cierre de la tanda

Al terminar el Sprint 17:
1. Corre la suite completa una última vez y reporta el número final de tests.
2. Verifica que la bitácora `docs/BITACORA_FORMS.md` tiene los 5 sprints (13–17) escritos, con QA y evidencia.
3. Deja un resumen en la bitácora de: qué quedó CERRADO, qué se DIFIRIÓ (y por qué), y qué sigue esperando **decisión del humano** (#1 CORS, #6 Postgres, #15 planes, #18 revocación real, #16 reentrenar con Babilonia, zona roja #22/#29/#30).
4. **NO hagas push ni merge.** Reporta al humano y espera el "dale".

## 3. Orden recomendado y por qué

13 → 14 → 15 → 16 → 17. Frontend de navegación/estado primero (desbloquea uso real), luego performance (depende de la extracción de componentes), después backend hardening (independiente), luego ML reproducible (aislado), y al final eficiencia + tests como red de seguridad de todo lo anterior. Si el tiempo aprieta, los sprints 13 y 15 son los de mayor ROI de producto/seguridad; 14 y 16 son deuda técnica; 17 es innegociable (cierra la red de tests).
