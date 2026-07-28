# T084 — Profile: UX (planes/soporte decorativos, claridad)

**TARGET:** `app/screens-profile.jsx`  
**LENTE:** ux  
**Fecha:** 2026-07-06

---

## Resumen

La pantalla de perfil comunica bien identidad y accesos a guardados/mis propiedades. Los modales de planes, preferencias e idioma prometen capacidades que el producto aún no ejecuta, lo que erosiona confianza si el usuario espera alertas o upgrade reales.

---

## Hallazgos

### [MEDIO] · CTAs de plan Pro sin acción · `screens-profile.jsx:192-195,323-365` — “Probar 14 días gratis”, “Gestionar plan” y “Ver planes” solo abren/cierran el mismo modal. · Expectativa de pago o trial; dead-end frustrante. · Deshabilitar con “Próximamente” o enlace a checkout/waitlist real.

### [MEDIO] · Preferencias de notificaciones solo locales · `screens-profile.jsx:245-262` — toggles persisten en `localStorage`; copy implica emails y alertas de gangas. · Usuario activa “Alertas de gangas” y nunca recibe nada; cree que la app está rota. · Copy honesto (“Solo en este navegador, aún sin envío”) o wire a backend.

### [MEDIO] · Card Pro en columna promete “alertas geoespaciales” · `screens-profile.jsx:178-197` — texto de marketing alineado al modal, sin feature detrás. · Misma decepción que CTAs; especialmente en usuarios Free. · Badge “En desarrollo” o alinear copy al alcance real (análisis + explorar).

### [BAJO] · Modal idioma simula elección · `screens-profile.jsx:296-319` — English “Pronto” pero fila Español parece selector activo. · Fricción innecesaria en menú que no cambia nada. · Ocultar entrada Idioma hasta i18n o una sola línea informativa.

### [BAJO] · FAQ largo sin búsqueda · `screens-profile.jsx:274-283` — cinco acordeones densos (ML, cobertura). · En móvil, encontrar “¿Puedo confiar en cobertura Baja?” requiere expandir todo. · Campo de búsqueda o anclas por tema.

### [BAJO] · Editar rol sin explicar impacto en navegación · `screens-profile.jsx:222-227` — cambiar a Propietario altera tabs (Sprint 4) sin hint en el modal. · Usuario no entiende por qué aparecen Leads/Mis propiedades. · Línea bajo Select: “Como propietario verás publicar y leads”.

### [INFO] · Soporte con email visible · `screens-profile.jsx:285-290`. · Clara y útil.

### [INFO] · FAQ con datos del modelo (`WASI_STATS`) · coherente con home. · OK.

---

## Veredicto

Perfil funcional para cuenta real; el riesgo es **promesa falsa en planes y notificaciones**. Ajustar copy o conectar backend es el ROI UX más alto sin tocar flujos core.
