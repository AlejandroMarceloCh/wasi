# Auditoría integral Wasi — 2026-07-05

Cuatro auditores independientes (uno por frente A–D), código + API viva en :8001.
Veredicto unánime: **la app NO está a nivel producción.** Base funcional real y seguridad
server-side sólida, pero con 6 bloqueantes y ~20 altas.

Datos de prueba que quedaron en la BD local: usuarios `audit_a@wasi.pe`, `audit_b@wasi.pe`,
`qa.wasi.owner1@example.com` (id 7), `qa.wasi.tenant1@example.com` (id 8). Todos los
listings/leads de prueba fueron borrados (ids 3397–3401).

---

## BLOQUEANTES (6)

| # | Hallazgo | Evidencia | Frente |
|---|----------|-----------|--------|
| B1 | **Publicar en VENTA no existe en ninguna capa** — `Listing` sin campo operación, `ListingIn` no la acepta, form dice "en alquiler", precio $/mes tope $50k, catálogo sin filtro de operación, `_fair_value_ref_server` siempre usa el modelo de alquiler. `predict-venta` es un callejón sin salida (VentaResult sin CTA). | `models.py:110-135`, `schemas.py:290`, `screens-seller.jsx:220,333`, `listings.py:57-80` | A |
| B2 | **Tildes de Nominatim rompen publicar** — Nominatim devuelve "Jesús María" (tilde), backend usa "Jesus Maria" → 422 críptico. Falla publicar vía pin en Jesús María, Breña, Rímac, SMP. Verificado en vivo. | `screens-seller.jsx:86-87`, `listings.py:110-111,226-230` | A |
| B3 | **"Las mejores gangas" del home promueve listings basura** — $50/mes por 80m² (-94%), $853 por 454m². `_ganga_score` sin ningún filtro de sanidad. El core value prop roto en la primera pantalla. | `listings.py:26-31`, `screens-home.jsx:417-421` | B |
| B4 | **Pausar/editar publicación no existe** — sin PATCH; UI solo ofrece Borrar (cascade → pierde leads). `VALID_STATUS` código muerto; el 409 de create_lead inalcanzable. | `listings.py:20`, `screens-seller.jsx:434`, `models.py:138` | C (y A) |
| B5 | **Sin navegación en móvil** — ≤980px las tabs desaparecen sin hamburger/bottom-nav. **Leads 100% inalcanzable en móvil.** | `styles.css:2140`, `components.jsx:398-485` | D |
| B6 | **Setup sin build con anti-caching deliberado** — React dev builds + Babel standalone transpilando 5,900 líneas en el navegador + `?v=Date.now()` que anula toda caché. Arranque lento siempre. (Resolver requiere excepción a la restricción "sin bundler" — pedir aprobación.) | `index.html:34-57` | D |

## ALTAS CONVERGENTES (2+ auditores independientes)

| # | Hallazgo | Frentes |
|---|----------|---------|
| C1 | **`[object Object]` en todos los 422 de Pydantic** — `data.detail` (array) coercido a string en `api.js:62`. Rompe los errores más comunes de registro, publicación y FairValue-venta. Y cuando es string, llega en inglés. | A, B, C, D (4/4) |
| C2 | **`image_url` String(512) vs base64 de hasta 1.5MB** — SQLite lo ignora, PostgreSQL (prod declarado) revienta con 500. Publicar con foto = bomba en producción. | A, C |
| C3 | **Sin `#api8001` el frontend habla con OTRO proyecto** (UTEC Gym en :8000) — config frágil por fragment. | B, C |
| C4 | **Timestamps UTC naive sin `Z`** → leads/publicaciones fechados +5h en el futuro. | A, C |
| C5 | **El dueño puede auto-crearse leads** (201 verificado) y la UI le muestra "Contactar" en su propio aviso — métricas inflables. | B, C |
| C6 | **El autocompletado pisa lo que el usuario tecleó** — efecto con deps `[lat,lng,distritos]` sobreescribe incondicional, sin AbortController (respuestas fuera de orden). | A, D |
| C7 | **Catálogo sin paginación** — 1.7MB / 3,396 filas por request, refetch total en cada filtro, offset ignorado en silencio. Inutilizable en 3G/4G con timeout 10s. | B, D |
| C8 | **DashboardScreen ('operaciones') inalcanzable** — ~370 líneas muertas y el CTA del home invita a "Entra a Operaciones". | B, C, D |
| C9 | **Sesión expirada = expulsión con mensaje técnico y pérdida total del form** — sin manejo global de 401, sin draft, banners con detail crudo. | A, C |

## ALTAS RESTANTES (por frente)

**A — Publicación**
- Pin default fabrica dirección falsa publicable ("Virgen Milagrosa", Miraflores) sin que el usuario toque el mapa.
- HEIC de iPhone / archivos corruptos fallan en silencio absoluto (sin `onerror`, sin tope de tamaño, PDF = return mudo).

**B — Descubrimiento**
- "Volver" del mapa de Entorno cae en "Todavía no hay un análisis" (onBack hardcodeado a fairvalue-result).
- Contradicción out-of-the-box: "Cobertura baja… pocos avisos" junto a "452 avisos comparables" (3 causas de confianza Baja, el front asume una).
- Banner de Explorar miente sobre el origen del veredicto (dice comparables; es el modelo ML).

**C — Cuenta**
- Cambiar rol en Perfil no refresca la navegación (tabs stale hasta la siguiente interacción; activeTab huérfano).

**D — Transversal**
- Ningún `label` asociado a su input (`htmlFor`/`id` ausentes en Input/Select) — afecta todos los forms.
- Autocomplete de direcciones inoperable por teclado (`onMouseDown` + outline removido).
- Dark mode roto en cards con fondo claro hardcodeado (wizard ilegible en dark).
- Clases/variables CSS inexistentes: `banner warning` (los warnings del modelo se ven como texto suelto), `stack-8`, `--muted`, `--border`.
- PII a granel: `/api/listings` devuelve contact_email/phone de TODOS los avisos a cualquier autenticado (scrapeable; el catálogo ni los usa).
- Cero historial del navegador (Atrás sale de la app, F5 pierde todo, sin deep links) y sin ErrorBoundary (excepción de render = pantalla blanca).

## MEDIAS (selección, ~25 en total — detalle en los reportes por frente)

- "Calcular precio sugerido" usa `/predict` (persiste) en vez de `/simulate` → contamina el historial con análisis de $1.
- Tipear en el campo URL borra la foto subida sin aviso; panorama 720×20000 pasa el resize y revienta el schema (eco de 1.6MB en el 422).
- Teléfono acepta letras ("abcdef" → 201). POST /listings sin rate limit.
- Rango del resultado (ensanchado client-side ×1.3/×1.8) ≠ rango del modal (backend puro) → "Competitivo" y "Agresivo" a la vez.
- Análisis reabierto del historial pierde counterfactuals, P25-P75 y warning de training.
- 10 distritos del catálogo no filtrables (dropdown 29 vs data 39); hero dice "40". Distritos sin tildes en data ("Brena", "Jesus Maria").
- Detalle del inmueble sin foto (la card sí muestra; el detalle no renderiza nada).
- Rate limit de login 429 con clave `error` que api.js no lee → "Error 429" críptico; cuenta logins exitosos.
- LeadsScreen N+1 (31 requests para 30 propiedades) con fallos parciales silenciados → leads invisibles.
- Sin recuperación de contraseña ni verificación de email.
- Modales sin focus trap; ErrorBanner sin aria-live; carrusel sin pausa (WCAG 2.2.2); contraste `--ink-3` en 11px.
- "Distribución real" sobre gaussiana sintética; stats de marketing fabricadas; campana de notificaciones decorativa; planes de pago sin flujo.
- Doble sistema de colores semánticos (tokens oklch vs hexes hardcodeados); overlays de mapa blancos en dark; empty-state duplicado 7+ veces.
- Hooks condicionales en FairValueResult (bomba latente de "Rendered more hooks"); interpolaciones sin guard (`±undefined%`).
- Timeout 10s vs cold start de Render >10s → primer request en prod siempre muere.

## LO QUE SÍ ESTÁ SÓLIDO (verificado por los 4)

Seguridad server-side: ownership, PII de contacto oculta a terceros en catálogo/detalle, favoritos
idempotentes, guards de rol con empty-states decentes, email case-insensitive, district re-derivado
server-side (anti-manipulación), jwt_secret fail-fast ≥32 chars. Copy sin rioplatense (grep exhaustivo),
tuteo consistente, cero console.log/TODO. Cleanup de mapas Leaflet, optimistic update con rollback en
favoritos, narrativa IA degrada con gracia, 400 fuera-de-Lima con mensaje claro. Flujo técnico de
publicar en alquiler funciona (201 en 0.2s) cuando no lo rompen las tildes.

---

## Estado del working tree al momento de la auditoría

- Branch `refactor/modular` con ~28 archivos modificados SIN commitear (trabajo previo de Codex, ya revisado y funcional: 157 tests verdes).
- 5 archivos `.md` de auditorías anteriores DENTRO de `src/wasi/` (violan la regla del paquete instalable): `plan.md`, `AUDIT_BASELINE.md`, `AUDIT_LOG.md`, `CHANGELOG_AUDITORIA.md`, `PLAN_RESOLUCION_AUDITORIA.md` → mover a `docs/` en el Sprint 0.
- Usuarios QA residuales en `wasi.db` local (listados arriba) → limpiar en Sprint 0.
