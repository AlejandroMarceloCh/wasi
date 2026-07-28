# 🎬 MANUAL DE ANIMACIÓN — Trailer Wasi (image-to-video)

> Workflow: cada imagen → Krea modo **Video** → pega el prompt de MOVIMIENTO → elige modelo → duración → Generate → descarga .mp4.
> Total generado ≈105s, se corta a ~84s en CapCut.

## Filosofía del prompt (IMPORTANTE)
- Prompts **abiertos**: declaran la **intención** del movimiento + micro-gestos clave. **NO** coreografían segundo a segundo ("first two seconds… then…") — eso sesga y encajona al modelo. Se le da la intención y él resuelve.
- Los **negative specs** (`no warping, no morphing, no flickering`) son restricciones de **calidad**, no de dirección → van SIEMPRE.
- La imagen ya trae el estilo Pixar y la escena. El prompt de movimiento no repite estilo ni re-describe el cuarto.

## Modelos
| Uso | Modelo | Clips |
|-----|--------|-------|
| Relleno / paisaje | **Hailuo 2.3 Fast** | P08, P22 |
| Clave (consistencia) | **Seedance 2.0** | P11, P16, P21 |
| Caballo de batalla | **Kling 3.0 Turbo** | el resto |

## Duraciones a marcar en Krea
`5,4,5,6,5,5,5,8,4` (Acto1) · `4,4,4,3,3,3,4` (Acto2) · `5,5,5,5,8,6` (Acto3)

---

# ACTO 1 — LOS TRES, SOLOS (0:00–0:48)

## [1] P02 · Camila ahogada en pestañas — Kling 3.0 Turbo · 5s
Imagen: `P02_camila_laptop.png` · Entra: abre el trailer tras título "IQUITOS".
```
Slow cinematic push-in toward the laptop screen over the shoulder. The screen glow flickers softly on her hair and shoulders, she scrolls slowly with subtle hand movement, her shoulders sink with a tired exhale, fine dust particles drift in the warm lamp light, the cold window light barely shifts. Quiet, heavy, intimate. smooth natural motion, consistent character design, stable facial features, no warping, no morphing, no flickering
```
Sale: más cerca de la pantalla → corta al close-up (P03).

## [2] P03 · Close-up del agotamiento — Kling 3.0 Turbo · 4s
Imagen: `P03_camila_closeup.png` · Entra: continúa la cercanía.
```
She slowly rubs her eye with her hand and blinks heavily, lets out a tiny tired sigh, loose curls drift gently, the laptop glow subtly flickers across her face, faint screen reflection shifting in her eyes. Very subtle, emotional, slow. smooth natural motion, consistent character design, stable facial features, no warping, no morphing, no flickering
```
Sale: parpadeo + suspiro → corta al plano del papá (P04).

## [3] P04 · El papá se asoma, ella se sobresalta — Kling 3.0 Turbo · 5s
Imagen: `P04_camila_papa.png` · Entra: ella cansada → rompe con el susto. (Este mantiene arco por el evento del susto.)
```
The shot opens calm for a moment, she is still hunched and tired. Then she startles: her head snaps sharply toward the doorway, her eyes go wide, her hand instinctively shoves the laptop lid halfway down in a guilty reflex, her shoulders flinching. In the blurred background her father gently tilts his head into the doorway with a concerned expression. The startle settles into a held, frozen beat of tension between them. Quick startle, then stillness. smooth natural motion, consistent character design, stable facial features, no warping, no morphing, no flickering
```
Sale: beat congelado padre-hija → corte a negro y título "MALA".

## [4] P06 · Diego sale ansioso al amanecer — Kling 3.0 Turbo · 6s
Imagen: `P06_diego_amanecer.png` · Entra: tras título "MALA".
```
He walks slowly forward away from the house into the quiet empty dawn street, the camera drifting back with him. His red backpack sways gently with each step, his head down, his eyes on his phone, its faint glow lighting his anxious face. Low morning haze drifts across the ground, soft dust at his feet, the pale dawn light warming the horizon. Contemplative, uncertain, the weight of leaving home. smooth natural motion, consistent character design, stable facial features, no warping, no morphing, no flickering
```
Sale: sigue caminando → corta al bus (P07).

## [5] P07 · Diego en el bus — Kling 3.0 Turbo · 5s
Imagen: `P07_diego_bus.png` · Entra: en tránsito, quieto.
```
He gazes out the bus window, distant and pensive, reflections of the passing landscape sliding across the glass and his face. The bus vibrates gently, warm golden light flickering over him, his fingers tightening on the backpack strap. Melancholic, lonely. smooth natural motion, consistent character design, stable facial features, no warping, no morphing, no flickering
```
Sale: mirada perdida → corta al plano del bus (P08).

## [6] P08 · El bus cruza la Panamericana — Hailuo 2.3 Fast · 5s
Imagen: `P08_bus_panamericana.png` · Entra: paisaje, respiro visual.
```
The lone bus drives across the frame along the coastal highway, the camera panning smoothly to follow it, small against the vast landscape. A trail of golden dust drifts behind it, a warm lens flare sweeping across, the dramatic clouds drifting slowly. Sweeping, epic, solitary. smooth natural motion, no warping, no flickering
```
Sale: el bus se aleja → fade y título "CUSCO".

## [7] P10 · Saywa llega al aeropuerto — Kling 3.0 Turbo · 5s
Imagen: `saywa_master_v2.png` · Entra: tras título "CUSCO".
```
She walks steadily through the airport hall, pulling her suitcase, the camera tracking alongside her. Her long braid sways with each step, blurred travelers drifting past, warm sunset light flaring from the windows over her. Determined yet nervous, alone in a crowd. smooth natural motion, consistent character design, stable facial features, no warping, no morphing, no flickering
```
Sale: caminando hacia una banca → corta a la videollamada (P11).

## [8] P11 · Videollamada con la madre — Seedance 2.0 · 8s ⭐
Imagen: `P11_saywa_videollamada.png` · Entra: ya sentada.
```
A slow tender push-in toward her as she gazes warmly at the laptop screen, where her elderly Andean mother speaks and nods lovingly. The warm screen light glows on her face, loose strands drifting, her breath gentle, a quiet flicker of held-back emotion crossing her expression. Tender, bittersweet, intimate. smooth natural motion, consistent character design, stable facial features, no warping, no morphing, no flickering
```
Sale: emoción contenida → corta al close-up (P12). Diálogo quechua en CapCut.

## [9] P12 · "Sí, mamá" (pero miente) — Kling 3.0 Turbo · 4s
Imagen: `P12_saywa_closeup_si.png` · Entra: cerramos sobre su cara.
```
She holds a small forced half-smile, then her eyes flick away and down, unable to hold the gaze, the smile faintly faltering. A slow blink, a strand of hair drifting. Restrained, vulnerable, the lie behind the smile. smooth natural motion, consistent character design, stable facial features, no warping, no morphing, no flickering
```
Sale: sonrisa a punto de quebrarse → cierra Acto 1. Música casi en silencio.

---

# ACTO 2 — EL ANUNCIO + EL CLIC (0:48–1:02)

## [10] P13 · Aparece la notificación WASI — Kling 3.0 Turbo · 4s
Imagen: `P13_saywa_notificacion.png`
```
Her face in shadow suddenly catches a warm amber notification glow blooming across it from the screen below, her eyes widening and lifting toward it, a spark of fragile hope breaking through the sadness. Soft golden particles drift up, a subtle push-in. Hopeful, a turning point. smooth natural motion, consistent character design, stable facial features, no warping, no morphing, no flickering
```
Sale: cara iluminándose → arranca el intercut (P14).

## [11] P14a · Camila ve la notificación — Kling 3.0 Turbo · 4s
Imagen: `P14a_camila_notificacion.png`
```
Her tired face catches the warm amber glow blooming up from her phone, her weary eyes widening with sudden surprise and hope, exhaustion cracking open, curls catching the light. Golden particles drift up. Hope breaking through fatigue. smooth natural motion, consistent character design, stable facial features, no warping, no morphing, no flickering
```
Sale: corte rápido → Diego (P14b).

## [12] P14b · Diego ve la notificación — Kling 3.0 Turbo · 4s
Imagen: `P14b_diego_notificacion.png`
```
His anxious golden-lit face catches a second warm bloom from his phone, his eyes widening with surprise and hope, his jaw loosening, the furrow softening, the cap brim catching the light. Golden particles drift up. Anxiety breaking into hope. smooth natural motion, consistent character design, stable facial features, no warping, no morphing, no flickering
```
Sale: los 3 clips de reacción se intercortan cada vez más rápido en CapCut → al CLIC.

## [13-15] EL CLIC ×3 dedos — Kling 3.0 Turbo · 3s c/u
Imágenes: `P15_clic.png` (Saywa) · `P15b_camila_dedo.png` · `P15c_diego_dedo.png`
```
The finger descends and taps the glowing button, which pulses and flashes brightly, a ripple of warm light spreading across the screen, tiny golden particles scattering up. Decisive, electric. smooth natural motion, no warping, no flickering
```
Sale: el flash del tercer dedo empalma con la explosión (P16).

## [16] P16 · La EXPLOSIÓN — Seedance 2.0 · 4s ⭐
Imagen: `P16_explosion.png` · Entra: empalma con el flash del clic.
```
The warm energy erupts outward from the center, filling the frame with golden, teal and magenta particles and shockwaves radiating fast with motion blur, light streaks shooting out, the center blooming to a blinding white-gold flash. Explosive, euphoric. smooth natural motion, no flickering
```
Sale: todo a blanco → transición al Acto 3. (Opcional: frame final blanco si Seedance lo permite.)

---

# ACTO 3 — CONVERGENCIA (1:02–1:24)

## [17] P17 · Browsing Wasi, gauge en verde — Kling 3.0 Turbo · 5s
Imagen: `P17_wasi_gauge.png` · Entra: desde el blanco de la explosión.
```
The app comes to life: a glowing location pin drops and bounces onto a building on the map, the map easing in toward it, the listing card sliding up, the gauge needle sweeping into the green zone with a soft green badge pulsing. Quick, satisfying, optimistic. smooth natural motion, no warping, no flickering
```
Sale: gauge en verde → corta a Saywa en la puerta (P18).

## [18] P18 · Saywa llega primero a la puerta — Kling 3.0 Turbo · 5s
Imagen: `P18_saywa_puerta.png` · Entra: exterior Lima, luz dorada.
```
She lowers her phone and lifts her gaze up the building facade, a hopeful nervous half-smile spreading, a small breath of relief easing her shoulders, the breeze moving her braid, warm afternoon light glowing over her. Arrival, nervous hope. smooth natural motion, consistent character design, stable facial features, no warping, no morphing, no flickering
```
Sale: mirando el edificio → corta a Diego (P19).

## [19] P19 · Diego llega caminando — Kling 3.0 Turbo · 5s
Imagen: `P19_diego_caminando.png` · Entra: misma calle, misma luz.
```
He walks up the sidewalk toward the building, slowing as his gaze lifts and his eyes widen with dawning recognition, a surprised hopeful smile growing, one hand starting to rise in a tentative greeting, his red backpack shifting as he slows. Recognition, unexpected connection. smooth natural motion, consistent character design, stable facial features, no warping, no morphing, no flickering
```
Sale: gesto de saludo a medio empezar → corta a Camila (P20).

## [20] P20 · Camila llega en taxi — Kling 3.0 Turbo · 5s
Imagen: `P20_camila_taxi.png` · Entra: misma calle, misma luz.
```
She steps out of the yellow taxi and swings the door shut, her curls bouncing, slinging her duffel bag over her shoulder and turning toward the building with a bright wide smile of anticipation, the taxi pulling away behind her. Energetic, joyful, the last to arrive. smooth natural motion, consistent character design, stable facial features, no warping, no morphing, no flickering
```
Sale: girando hacia la puerta → corta al encuentro (P21).

## [21] P21 · EL ENCUENTRO — entran juntos — Seedance 2.0 · 8s ⭐⭐
Imagen: `P21_encuentro.png` · Entra: los 3 frente a frente.
```
The three look at one another with dawning recognition, warm genuine smiles spreading, breaking into shared relieved laughter, then turning together and stepping through the open doorway side by side, the camera gently pushing in behind them, golden light wrapping them. Joyful, warm, a beginning. smooth natural motion, consistent character design, stable facial features, no warping, no morphing, no flickering
```
Sale: los 3 cruzan la puerta → corte suave al cielo (P22).

## [22] P22 · Cielo de Lima + logo WASI — Hailuo 2.3 Fast · 6s
Imagen: `P22_cielo_lima.png` · Entra: subimos al cielo.
```
The warm golden clouds drift slowly and gently break open, soft sun rays blooming and intensifying, a few birds gliding across, the camera serene and nearly still. Calm, peaceful, the light after the journey. smooth natural motion, no flickering
```
Sale: el cielo se abre → logo WASI (CapCut) con fade-in, swell musical, fundido a negro.

---

## ¿Falta algún frame?
No falta nada crítico. Opcionales si sobra CU:
1. Frame blanco final para P16 (end-frame) → transición perfecta.
2. Frame interior del depa (los 3 de espaldas entrando a una sala cálida) antes del cielo → cierra el arco "hogar".
