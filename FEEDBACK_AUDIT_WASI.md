# REPORTE DE INVESTIGACIÓN UX — WASI PROPTECH LIMA
## Entrevistas de usuario y expertos — 24 Jun 2026
### 9 fuentes: 6 videos de usabilidad + 3 entrevistas con expertos

---

## 1. RESUMEN EJECUTIVO

- **El producto tiene tracción real**: todos los usuarios (6/6) declararían usar Wasi en una decisión real de alquiler o fijación de precio. Los scores de satisfacción van de 4 a 5 sobre 5 en todas las sesiones. El semáforo justo/ganga/inflado es identificado espontáneamente como el diferenciador principal frente a portales como Urbania.
- **El flujo de propietario está roto técnicamente**: el botón "Publicar inmueble" no responde (BUG-01), el precio sugerido dispara valores absurdos ($16,457) mientras el usuario escribe (BUG-06), y el recálculo se activa al tocar campos de contacto (BUG-03). Ningún propietario pudo completar el flujo de forma autónoma y limpia.
- **La ausencia de fotos bloquea la conversión**: citada por 5 fuentes independientes. Inquilinos 3 y 4 no pudieron tomar la decisión de alquiler real sin evidencia visual del inmueble. Es el bloqueante de conversión más frecuente del corpus.
- **El breakdown de entorno genera deleite pero la escala porcentual confunde**: el momento "¡qué bacán!" de Propietario 2 al ver colegios y datos SIDPOL es el pico emocional más alto de todas las sesiones, pero los porcentajes crudos (1.25% parques, 0.50% supermercados) no son interpretables para usuarios no técnicos. Ningún usuario procesó correctamente el -5.7% total del entorno dentro del modelo de 101 variables.
- **El FairValue tiene un data leak arquitectural**: cuando el usuario analiza un listing que ya estaba en el training set, el modelo devuelve siempre "precio justo". Confirmado por el experto de UTEC. Invalida el veredicto en la vista de detalle del catálogo.
- **B2B es el camino viable de monetización**: los tres expertos convergieron en que B2C tiene baja disposición a pagar y alto riesgo de desintermediación. Las inmobiliarias medianas hacen benchmarking manual hoy (enviaban personas físicamente a levantar precios); Wasi reemplaza ese proceso a un costo menor que 2 analistas. Nexo Inmobiliario es el competidor directo.
- **El usuario más difícil de convencer (propietario con precio propio) es el que más valor extrae**: Propietario 1 rechazó el modelo al inicio (3/5), luego al ver el breakdown de POIs y entender que la urbanización de su zona justificaba el precio mayor, subió a 4/5 y declaró que cambiaría su precio al alza. La interpretabilidad del modelo es su mayor activo.

---

## 2. BUGS CRÍTICOS

### Severidad BLOQUEANTE

**BUG-01 — Botón "Publicar inmueble" sin respuesta**
- Descripción: el usuario completa el formulario de publicación, presiona el botón y no ocurre ninguna acción ni se muestra error.
- Evidencia: Propietario 1, 20:29–20:44. El moderador confirma: "puede que hay un problema con los botones."
- Frecuencia: 1 usuario (Propietario 1). Potencial real: cualquier propietario que llegue al final del flujo.
- Impacto: destruye el flujo core del lado propietario. No hay workaround.

**BUG-03 — Recálculo del precio sugerido al editar campos de contacto**
- Descripción: cada vez que el usuario toca el campo de email o teléfono en la sección de contacto, el modelo recalcula el precio sugerido, como si las características del inmueble hubieran cambiado.
- Evidencia: Propietario 2, 03:13–03:24. Cita: "Esto debería solo hacer actualizarse si es que cambió algo de acá arriba, no del formulario de abajo."
- Frecuencia: 1 usuario técnico que lo detectó; el bug probablemente afecta a todos.
- Impacto: genera confusión sobre qué determina el precio y produce valores absurdos como efecto secundario.

**BUG-06 — Precios absurdos ($16,457 / $1,591) mientras el usuario escribe en el campo precio**
- Descripción: el modelo se dispara con cada dígito ingresado en tiempo real en lugar de esperar a confirmar el campo.
- Evidencia: Propietario 2, keyframes 00375–00380. Valores visibles: $9,000 → $16,457 → $1,591 durante la escritura.
- Frecuencia: 1 usuario que lo documentó; el bug es reproducible para cualquier usuario.
- Impacto: erosiona la confianza en el modelo inmediatamente. Un usuario nuevo no sabe si el sistema está fallando o si esos son precios reales.

---

### Severidad ALTA

**BUG-02 — Lógica invertida en simulador de amenities**
- Descripción: quitar "Seguridad" muestra +$27 y quitar "Ascensor" también muestra valor positivo. Debería ser negativo en ambos casos según el modelo mental del usuario.
- Evidencia: Propietario 2, 02:37–02:48. Cita: "¿Por qué si le quito seguridad va a ser más 27? No debería ser al revés."
- Nota técnica: puede ser un artefacto real del modelo (correlación inversa en datos), pero sin explicación contextual destruye la confianza en toda la estimación.

**BUG-04 — Campo "Antigüedad" con valor default 0 (inválido para inmueble residencial)**
- Evidencia: Propietario 2, 01:21. Cita: "Acá no debería poner como 0, a no ser que sea una oficina."

**BUG-05 — Campo "Dormitorios" permite valor 0**
- Evidencia: Propietario 2, 01:29. Cita: "mínimo 0, no creo."
- En modo monoambiente/estudio debería auto-fijarse en 1 y deshabilitarse.

**BUG-07 — Navegación a "Mis propiedades" no es evidente post-publicación**
- Frecuencia: 2 usuarios (Propietario 1 y 2). Propietario 1 preguntó "¿Dónde están mis propiedades?" dos veces con un minuto de diferencia.

**BUG-10 — Precio calculado para ubicación incorrecta (persistencia de coordenadas entre sesiones)**
- Descripción: el flujo demo anterior dejó coordenadas de Barranco; el inmueble de San Martín de Porres heredó esas coordenadas y el modelo calculó un precio para la zona equivocada.
- Evidencia: Propietario 1. El copy generado por IA mencionaba "Barranco" para un inmueble en SMP.

**BUG-11 — Estado "Cargando inmueble..." sin timeout ni fallback**
- Frecuencia: 4 usuarios (Inquilinos 2, 3, 4, 5). Spinner infinito sin mensaje de error alternativo.

---

### Severidad MEDIA

**BUG-08 — Columna "Teléfono" sobrante en tabla de Leads**
- Visible en el índice de keyframes con la etiqueta literal "Columna del medio (telefono) - sobra".
- Frecuencia: presente en todas las sesiones (5+ usuarios).

**BUG-09 — Simulador muestra "+$0" para toggle "Quitar seguridad" en ciertos listings**
- Delta no calculado o feature sin peso en el subconjunto de comparables.

**BUG-12 — Radio de POIs excluye establecimientos en el límite exacto del círculo**
- Propietario 1, 15:11. Cita: "no está dentro del círculo." El usuario conocía un Tottus a pocos metros que el modelo no registraba.

---

**DATA LEAK ARQUITECTURAL (no es un bug de UI, es un bug de modelo)**
- Cuando el usuario analiza un listing del catálogo que ya estaba en el training set, el FairValue devuelve siempre "precio justo".
- Confirmado por experto UTEC, línea 114: "Estás haciendo data leak."
- Impacto: invalida el veredicto del FairValue en la vista de detalle del catálogo. El modelo solo es válido en el flujo de entrada manual de datos.

---

## 3. FRICCIONES DE UX

### 3.1 Mapa

| Fricción | Descripción | Usuarios afectados |
|---|---|---|
| Sin buscador de dirección | El usuario debe arrastrar un pin sin campo de texto. Propietario 1 pasó ~60 segundos dando instrucciones verbales ("bájalo, súbelo, al revés") para ubicar San Martín de Porres. | Propietario 1, Propietario 2 |
| Sin leyenda de clusters | Los números dentro de los círculos del mapa no tienen explicación. Experto UTEC: "No sé qué significan estos números." | Experto UTEC |
| Sin buscador en Explorar | El mapa de exploración de listings tampoco tiene campo de dirección. | Propietario 1, Propietario 2, Inquilino 2 |
| Zoom sin actualización de precios | Inquilino 2 esperaba que al hacer zoom el mapa mostrara los precios de las cards actualizados al área visible. | Inquilino 2 |

### 3.2 Formularios (flujo propietario)

| Fricción | Descripción | Usuarios afectados |
|---|---|---|
| Foto solo acepta URL | El campo espera "https://.../foto.jpg". El propietario quiere subir un archivo JPG. No hay affordance para upload. | Propietario 2 |
| Validaciones al fondo del formulario | Los errores aparecen lejos del campo que los generó. Propietario 2: "Si hago seis mil, no veo ningún error hasta que bajo." | Propietario 2 |
| Campo dirección sin autocompletado de distrito | Al escribir "Av Larco", el campo "Distrito" no se rellena automáticamente. | Propietario 2 |
| Pin del mapa no es claramente arrastrable | No hay señal visual de que el pin se puede mover. | Propietario 2 |
| Botón "Calcular precio" habilitado sin distrito | Se puede ejecutar el cálculo sin haber seleccionado el campo obligatorio de distrito, produciendo precios sin sentido. | Propietario 2, 14:39 |
| Sin opción de borrar una propiedad publicada | Propietario 2: "Falta borrar." No hay CRUD completo en "Mis propiedades". | Propietario 2 |
| Sin previsualización antes de publicar | La propietaria (New Recording) quería ver cómo quedaba el aviso antes de que fuera visible al público. | Propietaria New Recording |
| Sin feedback de éxito post-publicación | Después de publicar, no hay toast ni redirección clara a "Mis propiedades". | Propietario 1, Propietario 2 |
| Vocabulario técnico inmobiliario | "Walking closet", "área exterior" y "arrendatario" generaron preguntas explícitas. | Propietario 1, Inquilino 4 |

### 3.3 Modelo / Análisis de precio

| Fricción | Descripción | Usuarios afectados |
|---|---|---|
| Botón "Ver análisis completo" no es un CTA primario | Está redactado como párrafo de texto, no como botón visual. 3 usuarios necesitaron que el entrevistador los señalara. | Inquilino 4, Inquilino 5, Propietario 2 |
| Porcentajes del entorno sin escala ni traducción | 1.25%, 0.50%, 0.15% sin contexto de cuánto es eso en dólares. | Inquilino 5, Propietario 2 |
| El slider de amenities muestra impacto de "agregar", no de "quitar" | El label dice "Quitar seguridad +$27", pero el usuario entiende que quitar algo debería bajar el precio. La dirección es contraintuitiva. | Propietario 2 |
| Sin resumen del "estado base" en el simulador | El simulador muestra deltas pero no hay referencia visual del inmueble base contra el que se calculan. | Inquilino 2, Propietario 1 |
| Moneda solo en USD sin conversión | El propietario peruano piensa en soles. El precio sugerido en dólares genera cálculos manuales en Spotlight ("857*3.5 = 2,999.5"). | Propietario 1, Inquilino 4 |
| Jerga ML visible en la carga | "Modelo Wasi v2 • error medio 16.4% • 3,348 avisos" visible al cargar. Inquilino 3: "no conozco mucho la plataforma." | Inquilino 3 |

### 3.4 Navegación general

| Fricción | Descripción | Usuarios afectados |
|---|---|---|
| "FairValue" como label no comunica función | El nombre en inglés no es autoexplicativo para usuarios hispanohablantes. Experto UTEC: "ponlo en quechua o que analice el precio o algo así." | Inquilino 3, Experto UTEC |
| Distinción flujo inquilino / flujo propietario no es obvia | Propietario 1 navega entre ambos flujos sin notar el cambio de contexto. El entrevistador de la sesión del Jirón también confundió módulos. | Propietario 1, Jirón Daniel Hernández |
| Sección "Leads" llamada "Leaps" (typo en UI) | El moderador lo leyó en voz alta y corrigió. El usuario no lo encontró solo. | Propietario 1 |
| Logo de Wasi no navega a inicio | Propietario 1 intentó hacer clic en el logo para volver al Explorar y no funcionó. | Propietario 1 |
| Landing no comunica qué es el producto | Experto UTEC: "no me queda claro si es solo alquiler, si es solo venta, si es los dos." | Experto UTEC, Inquilino 3 |

---

## 4. COMPRENSIÓN DEL MODELO DE PRECIOS

### Qué entienden bien (todos o mayoría)

- **El semáforo justo/ganga/inflado**: comprendido correctamente por 4/6 usuarios sin explicación. Inquilino 3: "acá sí lo clasifica como que en justo, ganga o inflado. Eso sí me parece valioso." Propietario 2 explicó espontáneamente la lógica al moderador.
- **El entorno como driver de precio (dirección)**: todos los usuarios entienden que parques, supermercados, bancos y colegios suben el precio. Nadie cuestionó la dirección general.
- **El rango de precios ($717–$998) como campo de negociación**: Propietario 2 lo usó estratégicamente: "Podría empujarle hasta 900, que sería dentro del rango ya."
- **El nombre real de los POIs como ancla de verificación**: cuando el sistema nombra "Holi Supermercado", "Parque La Familia", "Clínica Delgado", el usuario puede corroborar con su experiencia geográfica. Propietario 2: "Ah, salen los supermercados, el parque chévere."
- **Simulador de amenities en términos dolarizados**: el impacto de cochera ($80), dormitorio (+$49), baño (+$57) es comprendido y aceptado sin cuestionamiento.

### Qué malinterpretan

- **La dirección del diferencial -$69**: Inquilino 3 invirtió la lógica. Cita: "me ahorraría 69 dólares ya que lo habían anunciado a 900 pero según el mercado debería estar como que 969." El número es correcto pero el usuario creyó que el propietario había rebajado para ella, no que el aviso ya era una ganga de mercado. Es un bug de copy, no de modelo.
- **Los porcentajes del entorno**: ningún usuario no técnico pudo dimensionar qué significa 1.25% vs 0.50% en una escala de 100. Inquilino 5 (el más analítico): "¿cómo dimensiono 1.25% en una escala del 100? La lectura estadística es así, pero una persona que no es muy afín a los números no dimensiona el peso real." Tampoco está escrito en ningún lugar visible que esas fracciones deben sumar el -5.7% total del entorno.
- **El MAPE 16.4% como incertidumbre**: todos los usuarios lo procesan como "el modelo es sólido" (lectura positiva del disclaimer), no como "un aviso que difiere $30 del precio de referencia puede estar dentro del error estadístico". Nadie ajustó su interpretación del semáforo por el margen de error.
- **El slider de amenities en la dirección "quitar"**: Propietario 2 esperaba que quitar seguridad redujera el precio. El modelo puede capturar correlaciones inversas (edificios sin amenities en zonas competitivas), pero sin contexto eso destruye la confianza.
- **"Precio de aviso" vs "precio de referencia" vs "precio de cierre"**: términos solapados que los usuarios no discriminan. Propietario 2 fue el único que leyó activamente el disclaimer "basado en avisos, no en precios reales."
- **Las mejoras dinámicas del barrio**: Propietario 1 razonó correctamente que el modelo no captura urbanización reciente (pistas, veredas construidas en el último año y medio). Asumió que el modelo debería actualizar ese dato, lo que no ocurre.

### Cómo mejorar la comunicación del modelo

1. **Reemplazar el diferencial numérico por una frase de veredicto unidireccional**: en vez de "-$69 (-7.1%)" que genera lecturas inversas, mostrar "Este aviso está $69 por debajo del precio de mercado — es una ganga" con la dirección inequívoca explicitada en texto.
2. **Traducir porcentajes de entorno a impacto en dólares**: "Parques cercanos: +$11/mes" en vez de "1.25%". Reservar los porcentajes para el análisis completo.
3. **Añadir una frase ancla antes del breakdown del entorno**: "Estos son los factores del entorno que más impactan el precio, del más al menos relevante:" y luego los items en orden descendente.
4. **Agregar tooltip en el simulador cuando el impacto es contraintuitivo**: "Quitar seguridad +$27: el modelo detecta que inmuebles sin seguridad en esta zona se anuncian a precio competitivo para compensar." Sin eso, cualquier output contraintuitivo contamina la confianza en todo el modelo.
5. **Anclar el semáforo al margen de error**: cuando la diferencia entre precio del aviso y precio de referencia es menor al 16.4%, mostrar zona gris o "dentro del margen estadístico" en vez de un veredicto binario inflado/justo/ganga.

---

## 5. CONFIANZA Y CREDIBILIDAD

### Lo que genera confianza

| Factor | Mecanismo | Evidencia |
|---|---|---|
| Nombre real de POIs | El usuario puede verificar con su experiencia geográfica. Actúa como prueba de que el modelo "sabe dónde vive". | Propietario 2: "Ah, salen los supermercados, el parque chévere." |
| Breakdown SHAP cuantificado | El momento "¡qué loco!" de Inquilino 2 al ver que quitar un sensor resta $36 es la reacción emocional positiva más espontánea del corpus. | Inquilino 2, 01:36 |
| Semáforo justo/ganga/inflado en listado | Todos los usuarios lo identifican como el diferenciador respecto a Urbania/Adondevivir. | Inquilino 3, 03:54; Experto UTEC |
| Rango de precios (no solo punto central) | Propietario 2 lo usa como banda de negociación: "Podría empujarle hasta 900, que sería dentro del rango ya." | Propietario 2, 05:42 |
| N de comparables ("257 avisos") | Señal de solidez muestral para usuarios no técnicos. Propietario 1: "El 5, porque acá me está dando buena información." | Propietario 1, 10:35 |
| Nivel de confianza "Alta" + texto narrativo IA | El texto explicativo procesa el 16% de error positivamente ("la estimación es bastante sólida") y eso es lo que retienen los usuarios. | Propietario 2, 05:50 |
| Calidad/nombre del POI como diferenciador | Inquilino 4: "El más caro es el que está más cerca de la Clínica Delgado." El usuario introduce el concepto de prestigio del POI que refuerza el precio. | Inquilino 4, 04:10 |

### Lo que destruye confianza

| Factor | Mecanismo | Evidencia |
|---|---|---|
| Outputs contraintuitivos del simulador sin explicación | Propietario 2: "Si tiene más seguridad es más caro. ¿Por qué sería más caro quitar el ascensor?" Rechazó el resultado y sospechó del modelo entero. | Propietario 2, 02:37 |
| Gap grande entre precio del modelo y precio mental del usuario | Propietario 1: "En dólares es un precio elevado." Dio 3/5 inicial de acuerdo, subió a 4/5 solo después de contextualizar con el moderador. | Propietario 1, 07:08 |
| Porcentajes del entorno sin traducción | Los usuarios no técnicos los ignoran; los técnicos se frustran al no poder dimensionarlos. | Inquilino 5, 04:42–07:02 |
| Ausencia de fuente de datos POIs | Inquilino 5 preguntó repetidamente de dónde venían los POIs y solo cuando el moderador dijo "Google Maps" reaccionó positivamente. Cita: "¡Qué hablas, qué bacán!" | Inquilino 5, 14:07–14:10 |
| Bugs técnicos visibles (precios absurdos, botón roto) | Un propietario vio $16,457 en pantalla mientras escribía su precio. Erosión inmediata de credibilidad. | Propietario 2, 14:05–14:35 |
| Copy del modelo con distrito equivocado | El análisis IA mencionaba "Barranco" para un inmueble en San Martín de Porres. Bug grave de credibilidad. | Propietario 1, sesión propietario demo |
| Ausencia de fotos | Los usuarios no pueden verificar que el precio estimado corresponde a la realidad del inmueble. | Inquilino 3, Inquilino 4 |

**Observación crítica del experto UTEC**: "No muestres datos por vender uno. Solo muestra los datos que estás seguro que realmente son buenos. Si tu modelo está mal y le jodiste la vida, no solo le jodiste a ellos, sino también se lo van a comunicar a todos sus parientes."

---

## 6. FEATURE REQUESTS PRIORIZADAS

| # | Feature | Quién la pide | Frecuencia | Impacto estimado |
|---|---|---|---|---|
| FR-01 | Fotos reales del inmueble (interiores, distribución, portada) | Inquilino 3, Inquilino 4, Experto UTEC, Propietario 2, New Recording | 5 fuentes independientes | CRÍTICO — bloquea decisión de alquiler real |
| FR-03 | Listings comparables visibles junto al FairValue | Experto UTEC, Jirón Daniel Hernández | 2 expertos | ALTO — confianza para B2B y corredores |
| FR-04 | Visualización alternativa a porcentajes crudos del entorno (impacto en $) | Inquilino 5, Propietario 2, Experto UTEC | 3 fuentes | ALTO — afecta interpretabilidad del producto core |
| FR-05 | Autocompletado de dirección en formulario de publicación | Propietario 2 | 1 fuente con descripción técnica detallada | ALTO — bloquea flujo propietario |
| FR-09 | Landing page / onboarding claro | Experto UTEC, Inquilino 3, Jirón Daniel Hernández | 3 fuentes | ALTO — usuarios nuevos no entienden el producto |
| FR-10 | Leyenda del mapa (qué son los clusters y colores) | Experto UTEC | 1 fuente (experto técnico) | ALTO — UX básica faltante |
| FR-20 | Gap precio de aviso vs precio de cierre (rango de negociación) | Experto UTEC, Jirón Daniel Hernández | 2 expertos | ALTO — diferenciador analítico para B2B |
| FR-08 | Módulo inversor: ROI / payback / retorno anual | Jirón Daniel Hernández | 1 experto, segmento específico | ALTO — abre nuevo segmento de pago |
| FR-23 | Módulo B2B: benchmark automático para inmobiliarias | Jirón Daniel Hernández, Experto UTEC | 2 expertos | ALTO — monetización principal |
| FR-02 | Upload múltiple de fotos (no URL única) | Propietario 2 | 1 fuente con spec técnica | MEDIO — complementa FR-01 |
| FR-15 | Validación inline del formulario (errores junto al campo) | Propietario 2 | 1 fuente técnica | MEDIO — UX básica del formulario |
| FR-07 | Variable "urgencia de alquiler" como input del modelo | Propietario 2 | 1 fuente | MEDIO — enriquece la estimación |
| FR-12 | Fuente de datos citada explícitamente ("Datos: Google Maps") | Inquilino 5 | 1 fuente, pedido 3 veces en la sesión | MEDIO — genera confianza con fricción mínima de implementación |
| FR-11 | Indicador de seguridad / criminalidad (SIDPOL) | Inquilino 5, Propietario 1, Experto UTEC | 3 fuentes | MEDIO — ya hay datos, falta hacerlos visibles con fuente |
| FR-25 | Búsqueda de inmuebles filtrada por tipo de POI cercano | Inquilino 5 | 1 fuente (visión de producto articulada) | MEDIO — diferenciador de producto a futuro |
| FR-14 | Preview del aviso antes de publicar | New Recording | 1 fuente | MEDIO — confianza del propietario antes de lanzar |
| FR-13 | Chatbot para profundizar en el "por qué" del precio | Experto UTEC | 1 fuente | MEDIO — valor en B2B y usuarios técnicos |
| FR-17 | Renombrar "FairValue" a término en español | Experto UTEC | 1 fuente | BAJO — fricción real pero baja en otros usuarios |
| FR-19 | Reglas del edificio (mascotas, subarriendo) | Jirón Daniel Hernández | 1 fuente | BAJO — depende de cobertura en scraping |
| FR-26 | Integración con corredor / asesoría legal | New Recording | 1 fuente | BAJO — cambio de modelo de negocio, no de producto ML |

---

## 7. MAPA DE CONFUSIÓN POR ZONA DEL PRODUCTO

### Zona: Pantalla de FairValue / Precio de Referencia

| Confusión | Frecuencia | Tipo |
|---|---|---|
| Dirección del diferencial -$69 (¿quién ahorra qué?) | 2 usuarios (Inquilino 2, Inquilino 3) | Copy / Comunicación |
| "Valores del mercado" no es autoexplicativo | 1 usuario (Inquilino 2) | Vocabulario |
| "FairValue" no comunica función a hispanohablantes | 2 usuarios (Inquilino 3, Experto UTEC) | Vocabulario / Naming |
| MAPE 16.4% leído como "el modelo es sólido", no como incertidumbre | 5/6 usuarios | Estadística / Comunicación |
| Distinción precio de aviso / precio de referencia / precio de cierre | 4 usuarios | Modelo mental |

### Zona: Breakdown de Entorno

| Confusión | Frecuencia | Tipo |
|---|---|---|
| Porcentajes sub-1% sin escala de referencia ni traducción a $ | 3 usuarios explícitos (Inquilino 5 más articulado) | Comunicación estadística |
| Los porcentajes deben sumar -5.7% (no está escrito en ningún lugar) | 1 usuario técnico (Inquilino 5) | Arquitectura de información |
| Radio de búsqueda de POIs no explicado | 1 usuario (Propietario 1) | Transparencia del modelo |
| Fuente de los POIs desconocida | 1 usuario (Inquilino 5, pedido 3 veces) | Transparencia de datos |

### Zona: Simulador "¿Cómo cambiaría tu precio?"

| Confusión | Frecuencia | Tipo |
|---|---|---|
| Quitar amenity muestra precio positivo (dirección contraintuitiva) | 1 usuario (Propietario 2) — rechazo activo | Presentación del modelo |
| Sin estado base del inmueble visible junto al simulador | 2 usuarios (Inquilino 2, Propietario 1) | Arquitectura de información |
| "+$0" para "Quitar seguridad" en algunos listings | 1 usuario (Inquilino 2) | Bug / Feature no activa |

### Zona: Formulario de Publicación (Propietario)

| Confusión | Frecuencia | Tipo |
|---|---|---|
| Dormitorios puede quedar en 0 | 1 usuario técnico (Propietario 2) | Bug de validación |
| Errores de validación al fondo, no inline | 1 usuario (Propietario 2) | UX |
| Foto solo acepta URL, no archivo | 1 usuario (Propietario 2) | Affordance / Modelo mental |
| Dirección no autocompleta el distrito | 1 usuario (Propietario 2) | UX / Feature faltante |
| Botón "Calcular" habilitado sin distrito | 1 usuario (Propietario 2) | Bug de estado |
| "Walking closet" y "área exterior" no claros | 1 usuario (Propietario 1) | Vocabulario |
| "Cocina equipada" ambigua | 1 usuario (Propietario 1) | Vocabulario |
| Campo "Antigüedad": ¿desde compra, construcción o entrega? | 1 usuario (Propietario 1) | Ambigüedad del campo |

### Zona: Mapa / Explorar

| Confusión | Frecuencia | Tipo |
|---|---|---|
| Sin buscador de dirección textual | 2 usuarios (Propietario 1, Propietario 2) | Feature faltante |
| Clusters sin leyenda | 1 experto (Experto UTEC) | UX básica |
| Bug: todos los precios en cards muestran $900 | 1 usuario (Inquilino 2) | Bug de renderizado |

---

## 8. DIFERENCIAS INQUILINO VS PROPIETARIO

### Pregunta central en el producto

- **Inquilino**: "¿Me están cobrando de más?" Llegan con zona y presupuesto cerrado. Usan el FairValue como veredicto externo de validación.
- **Propietario**: "¿Estoy dejando dinero en la mesa?" Tienen un precio en mente (tasación propia) y usan el modelo para saber si pueden cobrar más o si están ahuyentando inquilinos.

### Dónde se genera la confianza

- **Inquilino**: el semáforo visible en el listado + la explicación causal del breakdown. La confianza viene del veredicto + razón, no de los números crudos. Inquilino 3 dio 5/5 "porque yo confío en las personas" — confianza afectiva, no epistémica.
- **Propietario**: el rango de precios como banda de negociación y el breakdown de POIs para justificar un precio más alto ante el inquilino. La confianza es más condicional y financieramente motivada. Propietario 2 (el más sofisticado) leyó el disclaimer activamente y calculó hasta dónde podía "empujar" dentro del rango.

### Fuentes de confusión distintas

- **Inquilino**: los porcentajes del entorno, el vocabulario técnico, la ausencia de fotos como bloqueante de decisión, y la dirección del diferencial de precio.
- **Propietario**: los bugs del formulario de publicación (validaciones, dormitorios en 0, botón roto, foto como URL), la confusión entre flujo FairValue y flujo de publicación, y la brecha grande entre su precio mental en soles y el precio del modelo en dólares.

### Features que piden

- **Inquilino**: fotos de interiores y distribución, más listings en scroll, zoom interactivo en mapa, conversor de costo mensual/trimestral.
- **Propietario**: upload múltiple de fotos (con archivo, no URL), autocompletado de dirección, urgencia de alquiler como input del modelo, borrar/editar propiedades publicadas, validaciones inline, preview antes de publicar.

### Flujo de decisión

- **Inquilino**: flujo lineal y reactivo → llegan al listing → ven el semáforo → si interesa van al FairValue → el veredicto actúa como gatillo de contacto o descarte. La fricción principal está en encontrar el botón de análisis completo.
- **Propietario**: flujo activo y creativo → tienen un inmueble → ingresan características → calculan precio sugerido → comparan contra su expectativa → deciden si publicar y a qué precio. La fricción está en el mapa (ubicación) y en el formulario (bugs y vocabulario).

### Tensiones estructurales inquilino vs propietario

1. **Precio**: el inquilino quiere que el aviso esté inflado para negociar a la baja; el propietario quiere que su inmueble valga más. El mismo modelo sirve intereses opuestos.
2. **Profundidad de análisis**: el inquilino quiere un veredicto simple (semáforo); el propietario quiere el breakdown completo para actuar sobre los drivers.
3. **Fotos**: ambos las necesitan pero por razones distintas (el inquilino para decidir contactar, el propietario para atraer leads).
4. **Horizonte temporal**: el inquilino decide una vez; el propietario necesita algo más parecido a un dashboard de gestión con alertas de renovación y seguimiento de leads.
5. **Confianza en el modelo**: el inquilino confía más rápido porque el veredicto valida su intuición. El propietario es más escéptico si el precio difiere mucho del suyo porque tiene más en juego.

---

## 9. JOURNEY EMOCIONAL

### Top 3 Momentos de Deleite

**#1 — El breakdown cuantificado del entorno con nombres reales de POIs**
El pico emocional más alto de todas las sesiones. Propietario 2 al ver la densidad de colegios y datos SIDPOL: "Oye, hay una cantidad enorme de colegios, ¿no? ¡Uf, qué buena!" / "¡Qué hablas, qué bacán!" Inquilino 2: "Ah, ay, qué loco" al ver que sin sensor se restan $36. Propietario 1 (propietaria viviendo en el exterior): descubre que la urbanización de su zona valoró su casa sin que ella lo supiera — "esto me agrada porque a pesar que estoy lejos, puedo saber cuánto realmente se puede alquilar mi predio." Es el momento con mayor carga emocional positiva de todo el corpus.

**#2 — El semáforo justo/ganga/inflado en el listado**
El diferenciador percibido más claro y consistente. Todos los usuarios lo identifican espontáneamente. Inquilino 3: "La diferencia es que acá sí lo clasifica como que en justo, ganga o inflado. Eso sí me parece valioso." Propietario 2 lo explicó solo al moderador sin que se lo preguntaran: "Hay tres tipos de targets: inflado, justo y ganga." Juan (experto ex-inmobiliaria): "¿Por qué se negocia para arriba o para abajo un precio? También me parece un golazo."

**#3 — El simulador "¿Cómo cambiaría tu precio?" con impactos en dólares**
Inquilino 5 lo analizó en detalle (cochera = +$56, dormitorio adicional = +$49, antigüedad = impacto menor de lo esperado) y usó los números para razonar sobre trade-offs. Propietario 2 calibró su intuición de precio hacia arriba usando los POIs como argumento: "Mi primera intuición es subirlo a 950, y viendo esto, siento que sería más rápido alquilarlo a 900." Es el momento donde el producto más directamente cambia la conducta real del propietario.

---

### Top 3 Momentos de Frustración

**#1 — Ausencia de fotos como bloqueante de conversión**
Inquilino 3 lo menciona dos veces: "Tendría que ver más fotos. Dependería mucho de las fotos." Inquilino 4: "Me gustaría que hayan fotos del lugar para tener una referencia de si es una casa, si es un departamento, si es un mini departamento, si está dentro o no de un condominio." El producto da toda la información analítica necesaria, pero sin la evidencia visual el usuario no puede cerrar la decisión. Es el único bloqueante que afecta directamente la métrica de conversión.

**#2 — Navegación del mapa sin buscador de dirección**
Propietario 1 (propietaria desde el exterior): "Bájalo, bájalo, allí, bájalo, bájalo, súbelo, no, no, te estoy diciendo" — más de 60 segundos dando instrucciones verbales al moderador para ubicar un inmueble en San Martín de Porres. La frustración es visible en el audio. Sin un campo de búsqueda textual, el flujo de publicación del propietario es prácticamente inutilizable para zonas que no sean el centro de Lima.

**#3 — Porcentajes del entorno sin contexto de escala**
Inquilino 5 (el más analítico) articuló el problema con más precisión que cualquier investigador de UX podría: "¿Cómo dimensiono 1.25% en una escala del 100? La lectura estadística es así, pero una persona que no es muy afín a los números dice: oye, parques influyen 1.25 y supermercados en 0.50. O sea, no dimensiona el peso real." Pasó más de 2 minutos (04:33–07:11) intentando entender la aritmética del breakdown sin resolución satisfactoria. Es la fricción más larga documentada en una sola sección del producto.

---

## 10. ESTRATEGIA Y NEGOCIO

### B2B vs B2C: consenso de los tres expertos

Los tres expertos convergen: B2B es el camino viable. Juan (Jirón Daniel Hernández), el más directo: "Si quieres lucrar con esto, el B2C me parece difícil. Más esto lo veo en el B2B siendo competitivos con los precios que te cuesta un equipo que hace esto. Ponte que dos personas están haciendo este benchmark. Tienes que ser más barato que esos dos jóvenes."

El experto técnico de UTEC: "Hay más oportunidad en meterte en temas B2B. Es un mercado que prácticamente no está acaparado."

La propietaria (New Recording) ilustra involuntariamente por qué el B2C es difícil: ella paga comisión a un corredor porque le entrega un servicio integral (filtro de inquilinos, contratos, asesoría legal). Wasi solo cubre pricing; para que esta usuaria migrara del corredor, la plataforma tendría que cubrir el servicio completo.

### Riesgo de desintermediación

Juan: "Gran riesgo: que te desintermedien. Por eso lo que más te conviene sería cobrar por fin mensual. Y el fin mensual en verdad te lo va a pagar la empresa. No te lo paga mucho el usuario como un comprador." La suscripción mensual elimina el incentivo del usuario de ver el precio y saltarse la plataforma.

### Willingness to Pay

- **B2C**: baja. Pocos usuarios pagarían mensualmente solo por el precio de referencia.
- **B2B**: existe y está cuantificable. El benchmark de precios que hoy hacen las inmobiliarias grandes requiere 2 personas haciendo scraping manual y visitas físicas a competidores que no publican precios directamente. Juan: "Imagínate que donde yo trabajaba mandaban a un huevón uno por uno a ir a levantar información a estas inmobiliarias que no te dan la data así de fácil."

### Casos de uso reales en empresas (frecuencia alta)

1. Benchmark pre-lanzamiento: antes de fijar precios de un nuevo proyecto, la inmobiliaria revisa los precios de la competencia.
2. Seguimiento de competitividad durante el período de venta/alquiler.
3. Análisis de zona para decidir el pricing de un edificio boutique vs promedio del distrito.
4. Corredores que necesitan sustentar el precio ante el cliente comprador/vendedor.

Juan: "Las corporaciones grandes siempre es tipo teoría de juego. Tú sacas un departamento, la inmobiliaria que va a sacar un edificio antes de poner sus precios también está viendo los tuyos."

### Competencia

Nexo Inmobiliario es el competidor directo en B2B. Las inmobiliarias grandes ya tienen suscripción con Nexo y equipos internos de BI. La propuesta de Wasi debe ser: más barato que Nexo + más barato que 2 analistas internos. No hay app equivalente activa en Lima actualmente (la que existía migró a Ecuador).

### Módulos con mayor WTP identificados

1. Módulo inversor ROI/payback: Juan, "Si compras el departamento a este precio y lo empiezas a alquilar a esto, ¿cuánto es tu payback? ¿Cuánto es tu ROI anual? Para el inversor que no tiene el conocimiento financiero pero quiere saber el ROI."
2. Módulo B2B benchmark: dashboard de comparación de portafolio propio vs mercado, por distrito y corte mensual.
3. Módulo de corredores: comparables reales + sustento del precio para presentar ante clientes.

### Modelo de monetización recomendado por expertos

Suscripción mensual pagada por empresas (inmobiliarias, corredoras, valuadores). No comisión por transacción (riesgo de desintermediación). No pago por usuario final (WTP muy baja). El precio de la suscripción debe posicionarse por debajo del costo de 2 personas haciendo el mismo trabajo manualmente.

---

## 11. FEEDBACK TÉCNICO / DATOS

### Mapa y clustering

- **H3 de Uber como alternativa a círculos con números**: el experto UTEC lo propuso explícitamente. Los hexágonos permiten segmentar por precio promedio por celda, y cuando una celda tiene pocas muestras, expandir el radio hasta alcanzar un N mínimo.
- **Leyenda obligatoria**: ningún usuario entendió qué representan los números en los círculos. Es la primera mejora de UX del mapa.

### Almacenamiento de imágenes

Las URLs de Urbania y Adondevivir son temporales. Experto UTEC: "Vean también una forma de almacenarlo con el tiempo, porque recuerden que esos URLs son temporales. Tal vez después de cierto tiempo guardarlo en un bucket S3." Sin esto se pierden las imágenes de los listings históricos, que son señal de valor percibido.

### Calidad del scraping

- **Área construida vs área de terreno**: Urbania mezcla ambas definiciones. El área construida (suma de todos los pisos) puede ser 2-3x el área del terreno. Si el modelo no distingue, los precios por m2 quedan sesgados. Experto UTEC: "El precio que ponen oficial muchas veces lo ponen pequeño para que te den la atención, y el precio del área construida es diferente al precio del área del terreno."
- **Precios en texto de descripción vs campo oficial**: el precio scrapeado del campo estructurado puede diferir del precio real en el texto libre. El equipo ya usa regex para completar campos faltantes, pero el riesgo de desacuerdo entre ambos es real.
- **Outliers / avisos con precios artificiales**: listings con precios anómalos (muy bajos como señuelo) sesgan los promedios del distrito. Juan: "Detectar cuando algún edificio con un precio raro te está desviando los promedios."
- **Frecuencia de scraping**: el equipo actualiza cada 3 semanas. Juan señala que las inmobiliarias hacen benchmarking continuo. 3 semanas puede ser demasiado lento para capturar movimientos de precio, especialmente en distritos activos.

### Data leak del FairValue

El modelo fue entrenado con los listings del catálogo. Cuando un usuario abre el detalle de un listing que ya estaba en el training set y lo pasa por el FairValue, el modelo devuelve siempre "precio justo" porque ya vio ese ejemplo. Experto UTEC: "Estás haciendo data leak." Impacto: el FairValue solo es válido en el flujo de entrada manual de datos del inquilino, no en la vista de detalle del catálogo. Soluciones posibles: hold-out temporal (entrenar solo con listings de N semanas atrás) o indicar en el detalle que el análisis es estimativo porque el modelo pudo haber visto ese precio.

### Pesos de POIs

El sistema usa pesos manuales para diferenciar calidad de supermercados (Wong > Metro por percepción). El experto UTEC valida que los POIs más importantes son salud y educación (colegios y hospitales), seguido de bancos. Los supermercados pesan distinto según el distrito. El mecanismo de pesos manuales no escala; idealmente deberían salir del propio modelo o de una fuente autoritativa.

### Segmentación high-end / low-end

Dentro de un mismo distrito hay propiedades con valores extremos (penthouses, semisótanos deteriorados) que un modelo único no maneja bien. El experto UTEC usa 2 modelos con un orquestador que detecta el segmento y enruta al sub-modelo correspondiente. Wasi actualmente no maneja esta distinción.

### Precio de aviso vs precio de cierre

El modelo conoce el asking price (precio publicado) pero no el precio real de cierre de la transacción. Experto UTEC: "Hay una cosa que se llama precio de venta y otra que es precio de cierre. Sería bueno que recuperen esos datos para dar una métrica de cuánto es el rango de negociación." Este gap hace que el MAPE real puede ser mayor al 16.4% reportado.

### Formularios como fuente de datos para el modelo

El experto UTEC señala que los formularios de publicación de propietarios (aunque con 30% de campos completados) son una fuente legítima de datos nuevos para reentrenamiento. El campo de precio que los usuarios copian sin reflexión (valor placeholder = 80 en algún campo) introduce ruido.

---

## 12. TOP 20 CITAS VERBATIM

| # | Cita | Fuente | Tipo |
|---|---|---|---|
| 1 | "¡Qué hablas, qué bacán!" | Propietario 2, 13:22 — al ver datos de denuncias SIDPOL en el entorno | Deleite espontáneo máximo |
| 2 | "Mandaban a un huevón uno por uno a ir a levantar información a estas inmobiliarias que no te dan la data así de fácil." | Jirón Daniel Hernández, línea 56 | Dolor de mercado que Wasi resuelve |
| 3 | "¿Por qué se negocia para arriba o para abajo un precio? También me parece un golazo." | Jirón Daniel Hernández, línea 62 | Validación del simulador |
| 4 | "Si quieres lucrar con esto, el B2C me parece difícil. Más esto lo veo en el B2B siendo competitivos con los precios que te cuesta un equipo que hace esto." | Jirón Daniel Hernández, líneas 118–123 | Estrategia de negocio |
| 5 | "¿Cómo dimensiono 1.25% en una escala del 100? La lectura estadística es así, pero una persona que no es muy afín a los números no dimensiona el peso real." | Inquilino 5, 04:42–07:02 | Fricción crítica de comunicación estadística |
| 6 | "Mi primera intuición es subirlo a 950, y viendo esto, siento que sería más rápido alquilarlo a 900." | Propietario 2, 07:04 | El modelo cambia conducta real del propietario |
| 7 | "A pesar que estoy lejos, puedo saber cuánto realmente está, se puede alquilar mi predio." | Propietario 1, 23:43–23:53 | Propuesta de valor para propietarios en el exterior |
| 8 | "No muestres datos por vender uno. Solo muestra los datos que estás seguro que realmente son buenos. Si tu modelo está mal y le jodiste la vida, se lo van a comunicar a todos sus parientes." | Experto UTEC, líneas 400–413 | Advertencia crítica sobre umbral de confianza |
| 9 | "Estás haciendo data leak." | Experto UTEC, línea 114 | Bug arquitectural confirmado |
| 10 | "Tenerlo como automatizado con esta aplicación probablemente te sale más barato que tener a tu equipo de BI con cinco datos haciendo eso." | Jirón Daniel Hernández, líneas 113–114 | Propuesta de valor B2B |
| 11 | "El 5, porque acá me está dando buena información." | Propietario 1, 10:35 | Adopción de usuario 60+ no técnico |
| 12 | "Me explicó bien a detalle como que las razones del porqué del precio y sus diferencias en el mercado. Creo que fue coherente el precio." | Inquilino 2, 03:27 | Validación de la explicabilidad del modelo |
| 13 | "Tendría que ver más fotos. Dependería mucho de las fotos." | Inquilino 3, 02:29 | Bloqueante de conversión más frecuente |
| 14 | "Yo lo pondría explícitamente, de que toda la información que está saliendo, tiendas de conveniencia, supermercados, hospitales, todo, es Google Maps." | Inquilino 5, 19:01 | Feature request de atribución que genera confianza |
| 15 | "Porque yo confío en las personas." | Inquilino 3, 04:30 | La confianza es interpersonal, no epistémica — riesgo de producto |
| 16 | "Si le quito seguridad va a ser más +27? No debería ser al revés." | Propietario 2, 02:37 | Rechazo activo por lógica contraintuitiva del simulador |
| 17 | "Acá también pondría listings de los comparables. La persona les va a preguntar en base a qué." | Experto UTEC, líneas 146–168 | Feature crítica para B2B y credibilidad |
| 18 | "Yo lo pondría explícitamente, de que toda la información que está saliendo es Google Maps." | Inquilino 5, 19:01 | Transparencia de fuentes como generador de confianza |
| 19 | "No sé si ese también podría ser otro factor para calcular en la IA: de poner alquiler en tiempo inmediato, en unos meses, o tres meses." | Propietario 2, 09:46 | Feature request de urgencia como variable del modelo |
| 20 | "No solo le jodiste a ellos, sino también se lo van a comunicar a todos sus parientes y a toda la gente." | Experto UTEC, líneas 401–413 | Riesgo reputacional por error del modelo en decisión de alta magnitud |

---

## 13. NEXT STEPS RECOMENDADOS

### Acción 1 — Reparar el flujo de publicación del propietario (sprint actual, 3–5 días)

Este flujo tiene 3 bugs bloqueantes que invalidan cualquier test con propietarios reales:

- BUG-01: el botón "Publicar inmueble" no responde. Prioridad P0.
- BUG-03: desacoplar el trigger del recálculo del precio del estado del formulario de contacto. Solo recalcular cuando cambian características del inmueble.
- BUG-06: aplicar debounce o mover el cálculo a onBlur / submit en el campo de precio. Eliminar el recálculo en tiempo real dígito a dígito.

Complementariamente: validaciones inline (errores junto al campo, no al fondo), valor mínimo 1 en dormitorios, bloquear el botón "Calcular precio" hasta que el distrito esté seleccionado.

**Criterio de éxito**: cualquier propietario puede completar el flujo de publicación de inicio a fin sin asistencia y sin ver un valor absurdo en pantalla.

---

### Acción 2 — Agregar buscador de dirección al mapa (sprint actual / siguiente, 2–3 días)

El mayor bloqueo del flujo de propietario después de los bugs del formulario. Propietario 1 pasó más de 60 segundos incapaz de ubicar su inmueble. Implementar autocompletado de dirección (Nominatim o Google Places API) que:

- Centra el mapa en la dirección ingresada y coloca el pin automáticamente.
- Rellena el campo "Distrito" automáticamente en el formulario.
- Aplica tanto al flujo de publicación del propietario como al flujo de FairValue del inquilino.

**Criterio de éxito**: un propietario puede ubicar su inmueble en menos de 10 segundos escribiendo la dirección.

---

### Acción 3 — Reemplazar porcentajes crudos del entorno por impacto en dólares (sprint siguiente, 1–2 días)

La fricción de comprensión estadística más documentada del corpus. Cambio mínimo de alto impacto:

- Mostrar junto a cada categoría de POI el impacto en dólares: "Parques: +$11/mes" en lugar de "1.25%".
- Añadir una frase ancla antes del breakdown: "Factores del entorno que más impactan el precio de este inmueble, del más al menos relevante:" seguida de los items ordenados de mayor a menor impacto.
- Atribuir la fuente explícitamente: "Datos de POIs: Google Maps" / "Datos de seguridad: SIDPOL / Ministerio del Interior."
- Los porcentajes pueden mantenerse en el análisis completo para usuarios técnicos, pero no deben ser la representación primaria.

**Criterio de éxito**: un usuario no técnico puede leer el breakdown del entorno y responder correctamente "¿qué factor impacta más el precio de este inmueble?" sin ayuda del entrevistador.

---

### Acción 4 — Integrar fotos del inmueble en listings y detalle (próximas 2–4 semanas)

El bloqueante de conversión más frecuente del corpus (5 fuentes independientes). Sin esto, inquilinos 3 y 4 no pudieron cerrar su decisión de alquiler aunque les pareciera útil el producto. Plan mínimo viable:

- Scraping de URLs de imágenes de Urbania/Adondevivir para los listings actuales del catálogo.
- Almacenamiento en S3 para evitar la expiración de URLs temporales.
- Mostrar al menos 3–5 fotos en el detalle del listing, con foto de portada visible en la card del mapa.
- Para el formulario de propietario: reemplazar el campo de URL única por upload de múltiples archivos (JPG, máx 2MB por imagen, mínimo 1, recomendado 5).

**Criterio de éxito**: un inquilino puede ver fotos del inmueble antes de contactar al propietario, eliminando "tendría que ver más fotos" como bloqueante de decisión.

---

### Acción 5 — Corregir el data leak del FairValue y documentar la limitación (próximas 1–2 semanas)

El bug más silencioso pero más grave de cara a la credibilidad del producto con usuarios sofisticados y con el segmento B2B.

- Identificar los listings del catálogo que pertenecen al training set del modelo.
- En la vista de detalle de esos listings, o bien: (a) omitir el FairValue y mostrar solo el precio de referencia con una nota "Este inmueble formó parte del entrenamiento del modelo", o (b) implementar un hold-out temporal (entrenar solo con listings de más de N semanas y aplicar el modelo solo a listings más recientes que el corte).
- Documentar la distinción precio de aviso / precio de cierre como limitación explícita del modelo en el texto del disclaimer. El MAPE real puede ser mayor al 16.4% reportado si se mide contra precios de cierre.

**Criterio de éxito**: el FairValue muestra resultados válidos estadísticamente en la vista de detalle, o muestra un aviso claro cuando el resultado no es confiable para ese listing específico.

---

*Reporte generado a partir de 9 fuentes: 6 sesiones de usabilidad grabadas en video (Inquilinos 2–5, Propietarios 1–2) + 3 entrevistas de expertos (Jirón Daniel Hernández, Universidad de Ingeniería y Tecnología, New Recording). Fecha de las entrevistas: 24 junio 2026. Total de horas de material analizado: aproximadamente 90 minutos de video + 3 audios de entrevistas de 5–25 minutos cada una. 20 agentes de análisis paralelo procesaron el corpus de transcripciones y keyframes OCR.*