# 🎬 DIRECCIÓN — Trailer Wasi (ARQUITECTURA COMPLETA · prompts detallados)

> Pieza cinematográfica de apertura (~84s). Independiente del video-demo corporativo.
> **Estilo CONFIRMADO: Pixar / Disney 3D animado** (elegido por consistencia de caras — más fácil de mantener entre shots).
> Workflow: **imagen-inicial → image-to-video**. Cada shot = 1 imagen (frame de arranque) + 1 prompt de movimiento.
> Audio (música, quechua, SFX) se edita aparte en CapCut. Muteamos el audio de la IA.
> Personajes: cachimbos peruanos 17-19 años.

---

## 0. BLOQUE DE ESTILO — pegar SIEMPRE al final del prompt de IMAGEN (copia/pega exacto)

```
Animated 3D film still in the style of a modern Pixar / Disney animated movie,
expressive stylized 3D character animation, soft subsurface skin shading, warm
cinematic lighting, shallow depth of field, richly detailed background, vibrant
warm color palette, high-quality 3D render, expressive cinematic composition,
16:9 widescreen, ultra detailed. Peru.
```

**Reglas de oro:**
- Formato **16:9** siempre.
- En el prompt de **MOVIMIENTO** NO repitas el estilo (la imagen ya lo trae). Cierra SIEMPRE con: `smooth natural motion, consistent character design, stable facial features, no warping, no morphing, no flickering`.
- Micro-movimientos = se ven reales. Macro-acciones = se deforman. Acciones grandes, mantenlas lentas y sutiles.
- Si la IA mete texto deforme en pantalla → ese texto va en CapCut, no en el prompt.

---

## 1. FICHAS DE PERSONAJE (copiar el string EXACTO en cada shot del personaje — son las anclas)

> 🔑 CONSISTENCIA: genera primero la **imagen master** de cada uno (un plano medio que te guste) y úsala como **imagen de referencia/base** en sus demás shots. Saywa YA tiene master aprobada.

- **CAMILA (Iquitos · mujer):**
  `an 18-year-old Peruvian teenage girl from Iquitos, round youthful face, warm brown skin, large dark expressive eyes, full voluminous dark curly hair falling past her shoulders with loose curls framing her face, small gold stud earrings, wearing a colorful tropical floral blouse`

- **DIEGO (Mala · hombre):**
  `an 18-year-old Peruvian teenage boy from the coastal town of Mala, lean build, youthful face, short dark hair under a worn baseball cap, wearing a faded denim jacket over a plain t-shirt, carrying a large worn red backpack`

- **SAYWA (Cusco · mujer) ✅ master lista:**
  `an 18-year-old Quechua teenage girl from Cusco, warm bronze skin, high cheekbones, dark almond-shaped eyes, a single long dark braid resting over one shoulder, wearing a handwoven traditional Andean sweater with geometric patterns in terracotta-red, ochre and cream, a small silver earring and a beaded bracelet on her wrist`

---

## 2. DIVISIÓN DEL CORTO — 22 planos, 3 actos, ~84s

| Acto | Planos | Duración | Contenido |
|------|--------|----------|-----------|
| **1 — Los 3, solos y angustiados** | 12 (9 IA + 3 títulos) | ~48s | Camila / Diego / Saywa, cada uno con su tensión |
| **2 — El anuncio + el clic** | 4 IA | ~14s | Notificación Wasi → intercut → clic → explosión |
| **3 — Convergencia en la puerta** | 6 IA | ~22s | App → Saywa en la puerta → Diego caminando → Camila en taxi → se encuentran y entran juntos → cielo + logo |

**Conteo real:** 20 imágenes de escena (P2,3,4,6,7,8,10,11,12,13,14a,14b,15,16,17,18,19,20,21,22) + 2 masters nuevas (Camila, Diego — Saywa✅ ya está).
→ **~22 imágenes a generar y 19 animaciones** (14c reusa el clip del 13; las masters NO se animan).
Títulos ("IQUITOS"/"MALA"/"CUSCO") se hacen en CapCut, no IA.
⚠️ El Acto 3 ahora tiene 4 shots con personaje (P18-21) — más caro pero es la convergencia que pediste. Reserva Seedance 2.0 Mini / Kling 3.0 para el P21 (el encuentro).

---

# ACTO 1 — LOS 3 (`0:00–0:48`)

### 🟠 Bloque CAMILA (Iquitos)

**Plano 1 · Título "IQUITOS"** → CapCut (texto ámbar comic-book sobre negro, con halftone).

---

**Plano 2 · Camila ahogada en pestañas** `0:04–0:09`

- **IMG:**
```
Over-the-shoulder medium shot from behind and slightly above [CAMILA], hunched
over a laptop late at night in her small humid bedroom in Iquitos, in the Peruvian
Amazon. The laptop screen glows bright and is completely covered with dozens of
overlapping browser tabs of rental listings and apartment photos, cluttered and
overwhelming. Around her: an unmade bed with a mosquito net pushed aside, an old
electric fan spinning on the desk, scattered clothes, a half-empty glass, sticky
notes on the wall, a small desk lamp casting a warm amber pool of light. Through the
open window behind her, lush tropical jungle vegetation and palm silhouettes against
the humid dark-blue Amazonian night, faint warm streetlight. Her shoulders are
tense, her silhouette small against the glowing screen. Mood: exhausting, sweltering,
overwhelming, lonely. Warm amber key light vs cool humid blue shadows. [BLOQUE DE ESTILO]
```
- **MOV:**
```
Slow cinematic push-in toward the laptop screen over the shoulder. The screen
glow flickers softly on her hair and shoulders, she scrolls slowly with subtle
hand movement, her shoulders sink with a tired exhale, fine dust particles drift
in the warm lamp light, the cold window light barely shifts. Quiet, heavy, intimate.
smooth natural motion, consistent character design, stable facial features, no warping, no morphing, no flickering
```

---

**Plano 3 · Close-up del agotamiento** `0:09–0:13`

- **IMG:**
```
Tight close-up of [CAMILA]'s clearly youthful 18-year-old teenage face (round soft
youthful features, not aged) lit only by the cold glow of the laptop and the warm
desk lamp from the side. She has light tiredness under her eyes, her brow slightly
furrowed in frustration, one hand pressing against her temple / rubbing one eye. A
few loose curls fall across her forehead. The bokeh of the cluttered room and screen
tabs blurs behind her. Reflection of the rental listings faintly visible in her
glassy eyes. Mood: drained, defeated but not giving up. Dramatic chiaroscuro
lighting, warm-cool contrast. [BLOQUE DE ESTILO]
```
- **MOV:**
```
She slowly rubs her eye with her hand and blinks heavily, lets out a tiny tired
sigh, loose curls drift gently, the laptop glow subtly flickers across her face,
faint screen reflection shifting in her eyes. Very subtle, emotional, slow.
smooth natural motion, consistent character design, stable facial features, no warping, no morphing, no flickering
```

---

**Plano 4 · El papá se asoma, ella se sobresalta** `0:13–0:18`

- **IMG:**
```
Medium shot of [CAMILA] sitting at her desk in the foreground, sharply lit by the
laptop. In the background, softly out of focus, the bedroom door is ajar and her
middle-aged father leans his head in with a gentle concerned expression, backlit by
warm hallway light. [CAMILA] is caught mid-startle, her head snapping toward him,
eyes wide, one hand instinctively moving to close the laptop lid, body slightly
recoiling, guilty and overwhelmed. Strong depth separation between her (sharp) and
the father (blurred). Tense, intimate, emotional beat. [BLOQUE DE ESTILO]
```
- **MOV:**
```
She startles and quickly pushes the laptop lid halfway down while turning her head
sharply toward the doorway, a small flinch of her shoulders; the father in the
background tilts his head slightly. Quick but controlled motion, then a held beat.
smooth natural motion, consistent character design, stable facial features, no warping, no morphing, no flickering
```

### 🔵 Bloque DIEGO (Mala)

**Plano 5 · Título "MALA"** → CapCut.

---

**Plano 6 · Diego sale ansioso al amanecer** `0:18–0:24`

- **IMG:**
```
Wide-to-medium shot of [DIEGO] stepping out of the doorway of a small humble
coastal-town house at dawn in Mala, Peru. He has the heavy red backpack on both
shoulders, head down looking anxiously at his phone, brow tense. The quiet street
is empty: low concrete houses, a mototaxi parked far away, dusty road, electricity
cables overhead, the pale orange-pink dawn sky with the sea fog faintly in the
distance. Long soft morning shadows stretch across the road. Cool dawn palette with
warm sunrise accents on the horizon. Mood: uncertain, anxious, the weight of leaving
home. [BLOQUE DE ESTILO]
```
- **MOV:**
```
He walks slowly forward away from the house, the camera tracks back with him at a
steady pace, the phone glow lights his face, his backpack shifts slightly with each
step, morning haze drifts low, soft dust kicks up under his feet, the dawn light
slowly intensifies. Contemplative, steady.
smooth natural motion, consistent character design, stable facial features, no warping, no morphing, no flickering
```

---

**Plano 7 · Diego en el bus mira por la ventana** `0:24–0:29`

- **IMG:**
```
Medium shot inside an interprovincial bus of [DIEGO] sitting alone by the window
seat, the red backpack on his lap held tight, looking out the glass with a pensive
anxious gaze. Warm morning sunlight streams through the window casting golden bars
across his face and the worn bus seats. Outside the window, the coastal landscape
and highway rush past in motion blur. Reflections of the passing scenery slide over
the glass and over his face. Other passengers blurred in the background. Mood:
lonely transit, anticipation, nerves. Warm golden-hour light. [BLOQUE DE ESTILO]
```
- **MOV:**
```
He slowly turns his head to look out the window, the reflections of the passing
landscape slide continuously across the glass and his face, the bus vibrates gently,
golden light flickers over him as the scenery streaks past outside, his fingers
tighten slightly on the backpack strap. Smooth, melancholic.
smooth natural motion, consistent character design, stable facial features, no warping, no morphing, no flickering
```

---

**Plano 8 · El bus cruza el cuadro** `0:29–0:33`

- **IMG:**
```
Wide cinematic establishing shot of a single interprovincial bus driving along a
coastal highway at golden hour, seen from the side. The Pacific ocean and cliffs on
one side, dry desert hills on the other, the Peruvian Panamericana highway. Long
lens flare from the low sun, a trailing cloud of dust and warm haze behind the bus,
dramatic golden sky with comic-book clouds. Sense of distance and journey. Epic,
hopeful-yet-uncertain. [BLOQUE DE ESTILO]
```
- **MOV:**
```
The bus drives across the frame from one side to the other at speed, a trail of
dust and warm light following it, the camera does a slow smooth pan to follow the
bus, lens flare sweeping across the lens, clouds drifting slowly. Dynamic, cinematic.
smooth natural motion, no warping, no flickering
```

### 🟡 Bloque SAYWA (Cusco) — protagonista

**Plano 9 · Título "CUSCO"** → CapCut.

---

**Plano 10 · Saywa llega con maleta al aeropuerto** `0:33–0:38`

- **IMG:**
```
Medium tracking shot of [SAYWA] walking through the departures hall of Cusco airport,
pulling a small rolling suitcase, a travel bag on her shoulder. Tall windows on the
right flood the hall with warm golden sunset light, long shadows across the polished
floor. Blurred travelers and silhouettes move around her in the background, a flight
information board glows softly out of focus. Her braid sways slightly as she walks,
her expression a mix of determination and quiet nervousness. Warm amber light,
bustling but lonely. [BLOQUE DE ESTILO]
```
- **MOV:**
```
She walks forward at a steady pace, the suitcase rolling beside her, the camera
tracks smoothly alongside her, blurred travelers drift past in the foreground and
background, warm light flares from the windows, her braid and bag sway naturally
with her steps. Smooth tracking, lively but intimate.
smooth natural motion, consistent character design, stable facial features, no warping, no morphing, no flickering
```

---

**Plano 11 · Se sienta, videollamada con la madre** `0:38–0:46` (imagen NUEVA — la master da la cara de referencia; la madre debe verse EN la pantalla de la laptop)

- **IMG:**
```
Intimate medium shot of [SAYWA] sitting on a bench in Cusco airport, an open laptop
on her lap. On the laptop screen, a video call shows her elderly Andean mother:
a weathered kind face, gray hair, traditional Andean hat and clothing, warm loving
expression. [SAYWA] looks at the screen with tenderness and hidden worry. Warm
sunset light from the big windows wraps around her, soft glow from the laptop on her
face. Her suitcase rests beside her. Background travelers blurred. Mood: tender,
bittersweet, a daughter far from home. Warm golden intimate lighting. [BLOQUE DE ESTILO]
```
- **MOV:**
```
Slow cinematic push-in toward [SAYWA]. She settles, looking warmly at the laptop
screen where her mother gently speaks and nods, the warm screen light flickers
softly on her face, a few strands of loose hair drift, she breathes gently, a faint
tightening of emotion in her expression. Tender and slow.
smooth natural motion, consistent character design, stable facial features, no warping, no morphing, no flickering
```
- **AUDIO (CapCut):** diálogo en QUECHUA + subtítulos:
  > Mamá: *"¿Yachankichu imaynatas wasiykiman chayanaykita?"* — ¿Sabes cómo vas a llegar a tu hogar?
  > Saywa: *"Arí, mamáy, yachani."* — Sí, mamá, sé. *(pero su cara dice que no)*
  > ⚠️ VERIFICAR el quechua con un hablante real antes de grabar.

---

**Plano 12 · Close-up: dice "sí" pero no sabe** `0:46–0:48`

- **IMG:**
```
Extreme close-up of [SAYWA]'s clearly youthful 18-year-old teenage face filling the
frame (soft youthful features, not aged), forcing a small reassuring half-smile for
her mother, but her dark almond eyes glance away to the side, glossy with held-back
doubt and fear. A subtle furrow between her brows betrays the lie.
The warm laptop glow lights one side of her face, soft sunset rim light on the other.
Single tear-glint potential in her eye. Mood: vulnerability, fear masked by courage.
Cinematic chiaroscuro. [BLOQUE DE ESTILO]
```
- **MOV:**
```
She holds the small forced smile, then swallows nervously, her eyes flick away to
the side and down, the smile faintly falters, a slow blink, a single strand of hair
drifts. Extremely subtle, emotional, held.
smooth natural motion, consistent character design, stable facial features, no warping, no morphing, no flickering
```

---

# ACTO 2 — EL ANUNCIO + EL CLIC (`0:48–1:02`)

**Plano 13 · Aparece la notificación WASI** `0:48–0:52`

- **IMG:**
```
Close-up of [SAYWA]'s clearly youthful 18-year-old teenage face as her dark laptop
screen suddenly lights up with a single glowing app notification, casting a warm
hopeful glow across her face. Her eyes lift and widen slightly, a spark of hope
breaking through her sadness. The
notification is a clean glowing card (leave the text area blank or abstract — the
"WASI" logo will be added later in post). Soft warm light blooming on her skin,
reflection in her eyes. Mood: a turning point, hope ignites. [BLOQUE DE ESTILO]
```
- **MOV:**
```
The screen lights up and the warm glow grows and spreads across her face, her eyes
slowly widen and lift toward the screen, a subtle hopeful breath, slow push-in.
Hopeful, building.
smooth natural motion, consistent character design, stable facial features, no warping, no morphing, no flickering
```

---

**Plano 14 · Intercut de los 3 viendo el aviso** `0:52–0:57` (genera 14a y 14b; 14c reusa el 13)

- **14a · CAMILA:**
```
Close-up of [CAMILA] in her dark bedroom, her phone screen suddenly lighting up
with a glowing app notification, warm hopeful glow on her tired face, her eyes
widening with surprise and hope, loose curls catching the light. (text blank, logo
added in post). [BLOQUE DE ESTILO]
```
- **14b · DIEGO:**
```
Close-up of [DIEGO] on the bus, his phone screen lighting up with a glowing app
notification, warm glow on his anxious face, his expression shifting toward hope,
golden window light behind him. (text blank, logo added in post). [BLOQUE DE ESTILO]
```
- **MOV (14a, 14b, y reuso 14c):**
```
The phone glow intensifies and spreads across the face, eyes widening with hope,
slight push-in, subtle breath. smooth natural motion, stable facial features, no warping, no morphing
```
- **Montaje (CapCut):** cortes cada vez MÁS rápidos entre los 3, música subiendo la tensión.

---

**Plano 15 · El CLIC** `0:57–0:59`

- **IMG:**
```
Extreme macro close-up of a young finger about to tap a glowing app button on a
phone/laptop screen, the button pulsing with warm light, dramatic high-contrast
rim lighting, shallow focus, particles of light around the fingertip, tension in
the gesture, the moment before everything changes. (button text blank — logo in
post). [BLOQUE DE ESTILO]
```
- **MOV:**
```
The finger descends and taps the glowing button, the button pulses and flashes
brightly with a ripple of light on contact. Snappy, decisive, then a held beat.
smooth natural motion, no warping, no flickering
```

---

**Plano 16 · La EXPLOSIÓN** `0:59–1:02`

- **IMG:**
```
A massive explosion of colorful comic-book energy bursting outward from a phone
screen and filling the entire frame: radiating halftone dot bursts, CMYK chromatic
shockwaves, bold comic speed-lines, splashes of magenta, cyan, yellow and warm
gold, screen-print texture, kinetic Spider-Verse energy explosion, pure visual
euphoria and release. [BLOQUE DE ESTILO]
```
- **MOV:**
```
The colorful energy bursts violently outward from the center filling the whole
frame, halftone particles and chromatic shockwaves radiating fast, comic speed-lines
streaking outward, a bright flash. Fast, explosive, energetic. Transitions to white.
smooth natural motion, no flickering
```

---

# ACTO 3 — CONVERGENCIA EN LA PUERTA (`1:02–1:24`)

> 💡 LA IDEA: los 3 hilos del trailer convergen FÍSICAMENTE. Cada uno llega al mismo edificio por un medio distinto (Saywa ya en la puerta, Diego caminando, Camila en taxi), se encuentran ahí, se reconocen como los roommates que Wasi matcheó, y entran JUNTOS. Rima con la apertura (empezaron separados → terminan en el mismo punto). Misma calle/edificio/luz dorada en los 4 shots para que la convergencia se lea.

**Plano 17 · Usan la app Wasi — encuentran el MISMO depa** `1:02–1:06`

- **IMG:**
```
Dynamic close-up of two young hands holding a smartphone showing the Wasi map app
of a Lima neighborhood, a glowing location pin dropping onto a specific building, an
apartment listing card glowing warmly below with a price and a checkmark. Bright
optimistic lighting, vivid colors, a sense of discovery and relief. Clean modern UI
(keep on-screen text minimal/abstract, real UI added in post). [BLOQUE DE ESTILO]
```
- **MOV:**
```
The location pin drops and bounces onto the map, the map subtly zooms into the
building, the listing card glows and slides up. Quick, satisfying, optimistic.
smooth natural motion, no warping, no flickering
```
> Narrativamente justifica que los 3 lleguen a la MISMA casa: Wasi los matcheó.

---

**Plano 18 · SAYWA llega primero a la puerta** `1:06–1:10`

- **IMG:**
```
Medium shot of [SAYWA] standing at the entrance of a modest warm-colored Lima
apartment building, her rolling suitcase beside her, looking up at the facade while
checking the address on her phone, a hopeful nervous half-smile, the breeze moving
her braid. Typical Lima residential street: low buildings, a couple of palm trees,
parked cars, soft golden late-afternoon light, gentle urban haze. Mood: arrival,
the end of a long journey. [BLOQUE DE ESTILO]
```
- **MOV:**
```
She lowers her phone and looks up at the building with a slow hopeful smile, takes
a small breath of relief, her braid drifting in the breeze, warm light glowing.
smooth natural motion, consistent character design, stable facial features, no warping, no morphing, no flickering
```

---

**Plano 19 · DIEGO llega caminando** `1:10–1:14`

- **IMG:**
```
Medium tracking shot of [DIEGO] walking up the sidewalk toward the same building
entrance, his red backpack on both shoulders, a paper with an address in his hand.
He slows down as he looks up and notices someone at the door (Saywa), a surprised
hopeful smile beginning to form. Same Lima street, same warm golden light, same
building in frame. Mood: recognition dawning. [BLOQUE DE ESTILO]
```
- **MOV:**
```
He walks forward, slows his pace, his eyes lift and widen with recognition, a smile
grows across his face, he raises a hand in a small greeting. Warm, hopeful.
smooth natural motion, consistent character design, stable facial features, no warping, no morphing, no flickering
```

---

**Plano 20 · CAMILA llega en taxi** `1:14–1:18`

- **IMG:**
```
Medium shot of [CAMILA] stepping out of a classic yellow Lima taxi at the curb in
front of the same building, pulling her duffel bag, pushing the car door closed, her
voluminous curls bouncing, turning toward the entrance with bright anticipation. The
yellow taxi and the same Lima street behind her, warm golden light. Mood: the last
one to arrive, excitement. [BLOQUE DE ESTILO]
```
- **MOV:**
```
She steps out of the taxi, swings the door shut, slings her bag over her shoulder
and turns toward the building, curls bouncing, the taxi pulling away behind her.
smooth natural motion, consistent character design, stable facial features, no warping, no morphing, no flickering
```

---

**Plano 21 · EL ENCUENTRO — entran juntos** `1:18–1:22` ⭐ (shot clave — usa las 3 masters como referencia)

- ⚠️ Mantén las 3 anclas y la MISMA puerta/luz de los planos 18-20. Acción simple (se miran, ríen, entran) — no la compliques o se deforma.
- **IMG:**
```
Warm medium shot of the three teenagers (17-19 years old) meeting for the first
time right at the open entrance of the Lima apartment building: [CAMILA] with her
voluminous curly hair and duffel bag, [DIEGO] with his red backpack and denim
jacket, and [SAYWA] with her long braid and suitcase. A beautiful beat of mutual
recognition and joy as they realize they are the roommates Wasi matched together,
warm genuine smiles, golden-hour light wrapping them, the building doorway open and
inviting before them. Cozy, hopeful, the start of a chosen family. [BLOQUE DE ESTILO]
```
- **MOV:**
```
The three look at each other with dawning recognition and warm laughter, then turn
together and step through the open doorway into the building side by side. Warm,
joyful, a soft camera push-in following them in.
smooth natural motion, consistent character design, stable facial features, no warping, no morphing, no flickering
```

---

**Plano 22 · Cielo + logo** `1:22–1:24`

- **IMG:**
```
Serene wide shot of the warm Lima sky at golden hour above the apartment building,
soft clouds breaking open with gentle sun rays, a couple of birds gliding, deeply
peaceful and hopeful, the calm after the journey. Warm pastel comic-book sky. [BLOQUE DE ESTILO]
```
- **MOV:**
```
The clouds drift slowly and break open, warm light gently blooms and intensifies,
birds glide across. Calm, slow, breathing. smooth natural motion, no flickering
```
→ encima el logo **WASI** en CapCut, swell musical final.

---

## 3. PLAN DE BATALLA (orden para mañana)

0. **🔴 VALIDA EL VIDEO PRIMERO (Gate 3, aún pendiente).** Antes de generar las ~22 imágenes, anima la master de Saywa que YA tienes con el prompt de MOV del plano 11, usando **Kling 3.0 Turbo**. Si el movimiento sale limpio → la herramienta sirve, sigue. Si deforma → ajustamos modelo/prompt ANTES de invertir tiempo. Esto te ahorra horas.
1. **Master de cada personaje primero.** Saywa ✅. Genera la master de **Camila** y de **Diego** (plano medio que te guste) ANTES de sus shots. Esas 2 imágenes son tu referencia de consistencia.
2. **Genera todas las IMÁGENES del Acto 1** (planos 2,3,4,6,7,8,10,11,12) usando las masters como base. Aprueba cada una antes de animar.
3. **Anima cada imagen** (image-to-video) con su prompt de MOV. Si una sale deformada → regenera el video, no la imagen.
4. Repite Actos 2 y 3.
5. **Muteá el audio IA.** Todo (música tensión, quechua, SFX, logo) va en CapCut.
6. **Color grade único** al final → unifica los 19 clips. Cortes al beat de la música.

## 4. Notas
- Modelo imagen: Krea 2 / Nano Banana 2 (Pro). Video: ver tabla §4.bis.
- Si un personaje cambia de cara entre shots → vuelve a la master como referencia.
- Duración por video: 4-5s basta. Kling permite hasta 15s pero no lo necesitas.
- **Quechua: verificar con hablante real.**

## 4.bis. QUÉ MODELO DE VIDEO USAR (clave para que rindan los 20k CU)

> ⚠️ **NUNCA uses Veo 3 para image-to-video: ~1,017 CU/video → 20k = solo ~19 clips.** Te funde el presupuesto.

| Tipo de shot | Modelo | Por qué |
|---|---|---|
| **Relleno** (bus, cielo, mototaxi, transiciones) | **Hailuo 2.3 Fast** | barato, calidad media basta |
| **Caballo de batalla** (mayoría: Camila, Diego, planos sueltos) | **Kling 3.0 Turbo** | balance calidad/costo, buena consistencia, rápido |
| **Shots CLAVE** (P11 videollamada, P21 el encuentro de los 3, P16 explosión) | **Seedance 2.0 Mini** (o Kling 3.0) | mejor consistencia de personaje (94% benchmark I2V) |
| **Probar en 1 shot** | **PixVerse V5.5** | el mejor para anime/estilizado — compara vs Kling |
| ❌ Nunca | Veo 3 | 1,017 CU/video, mata el presupuesto |

**CALIBRA:** genera los primeros 3-4 videos con Kling Turbo, mira el consumo real de CU → multiplica × ~45. Si rinde, sobra hasta para el video-demo.

## 5. SONIDO Y MÚSICA (todo en CapCut — es el 50% de la emoción)

- **Curva emocional:** Acto 1 = música mínima, íntima, melancólica (piano/cuerdas). Sube despacio en Saywa. Acto 2 (notificación→intercut) **crece la tensión** con cortes cada vez más rápidos. El **CLIC** = beat de silencio total (1 frame) → **golpe musical** en la explosión. Acto 3 = cálida y esperanzadora, swell final en el logo.
- **Pista libre para YouTube:** YouTube Audio Library (gratis), Pixabay Music (gratis), Epidemic Sound / Artlist (trial). Busca *"emotional cinematic trailer build-up"*.
- **SFX:** tecleo (Camila), motor de bus (Diego), murmullo de aeropuerto (Saywa), *ding* de notificación, *whoosh* + golpe en la explosión, risas + ciudad en el cierre.
- **Quechua:** grábalo con buen mic, voz real, sincronizado al plano 11, subtítulos blancos abajo.
- **Corte al beat:** alinea los cortes del intercut (Acto 2) con los golpes de la música.

## 6. SPECS DE EXPORTACIÓN (para YouTube)

- Resolución **1920×1080 (16:9)** o 4K si upscaleas (Enhancer de Krea).
- FPS **24** (look cine) o 30 — mantén UNO consistente.
- Formato **MP4 / H.264**.
- Duración **75–90s** (el trailer; el video-demo del curso es aparte, 5–7 min).
- **Color grade único** sobre TODOS los clips → unifica los 19 clips y disimula saltos entre generaciones.

## 7. CHECKLIST DE CONTINUIDAD (revisar en CADA shot antes de aprobar)

- [ ] **Camila** siempre con **rulos voluminosos oscuros** + aretes. (Acto 1 con blusa floral.)
- [ ] **Diego** siempre con **gorra / casaca de jean** + (Acto 1) **mochila roja**.
- [ ] **Saywa** siempre con **trenza larga** + **pulsera de cuentas** + arete. (Acto 1-2 chompa andina; Acto 3 casual.)
- [ ] Misma **paleta Spider-Verse cálida** (se unifica con el grade final).
- [ ] **Edad** 17-19 visible (no adultos). Si sale mayor, agrega `teenage, youthful face`.
- [ ] Ningún **texto inventado/deforme** en primer plano (la IA escribe mal — "WASI" va en CapCut).
