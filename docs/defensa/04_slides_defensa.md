# Slides de defensa — guion + contenido por slide

> **Formato:** 10-12 slides. ~30-45 s por slide = 5-9 min total (sin contar pitch ni demo).
> **Herramienta:** Keynote / Google Slides / Canva. No Powerpoint si puedes evitarlo.
> **Diseño:** texto mínimo, una métrica por slide, screenshots reales del producto.

---

## Slide 1 — Portada

```
ubIcA
Precio de referencia de alquiler en Lima Metropolitana

DS3022 — Desarrollo de Productos de Datos · UTEC
2026

Alejandro Marcelo
```

**Lo que dices:** nada o solo "Buenos días, soy Alejandro Marcelo y les voy a presentar ubIcA". Es portada.

---

## Slide 2 — El problema (gancho)

> Visual: foto/ilustración de un agente inmobiliario mostrando un contrato.

```
"Ese es el precio del mercado."

41 % del mercado de alquileres de Lima
se concentra en 2 distritos.

En el resto, la información es opaca.
```

**Lo que dices:** lectura del pitch — primeros 25 s del Acto 1 + 2 del pitch.

---

## Slide 3 — Producto en vivo (foto del FairValueResult)

> Screenshot del FairValueResult con el bloque del rango P25-P75 visible + factores cualitativos.

```
ubIcA
Pin → form de 8 toques → veredicto + rango + contexto en <1 s
```

**Lo que dices:**
> "Vamos a la demo en vivo en 1 minuto, pero primero un overview rápido de cómo está hecho."

---

## Slide 4 — Stack

```
FRONTEND          BACKEND              ML
─────────────     ──────────────       ─────────────
React 18          FastAPI              XGBoost v2
Babel standalone  SQLAlchemy 2         95 features
Leaflet (CDN)     SQLite + JWT         + 3 modelos quantile
Sin build         18 endpoints         MAPE 15,7 % · R² 0.86
```

**Lo que dices:**
> "Frontend sin build — un solo `index.html` con React vía Babel standalone, Leaflet por CDN.
> Backend FastAPI con SQLite por defecto, pero el código es agnóstico del motor: cambiar a Postgres es una variable de entorno.
> Modelo XGBoost v2 con 95 features, 4 fuentes de datos públicas."

---

## Slide 5 — Datos (4 fuentes externas)

```
3,348 listings reales (AdondeVivir + Properati)
       +
4 fuentes públicas
─────────────────────────
INEI ENAPRES    → estrato_nse
MININTER 2024   → denuncias del distrito
CENACOM         → 50 comisarías
OpenStreetMap   → 11,100 POIs (7 categorías)

→ 95 features para el modelo
```

**Lo que dices:**
> "Cero APIs pagas, cero data sintética. Todo es público y trazable.
> En proyectos donde la data es propietaria, es difícil defender el método. Acá cualquiera podría reproducir el pipeline."

---

## Slide 6 — Pipeline (diagrama Mermaid simplificado)

> Insertar uno de los 6 diagramas de `DIAGRAMAS.md` (el más limpio: arquitectura de inferencia).

```
[Usuario]
    │
    ▼
[geo_lookup] ──── KD-tree + IDW haversine ──── 3,348 listings
    │
    ▼
[build_features_v2] ──── 95 features
    │
    ├──► [XGBoost central] ──► fair_value
    └──► [3 XGBoost quantile] ──► [P25, P50, P75]
```

**Lo que dices:**
> "Toda la lógica del modelo vive detrás de `model_service.py`. Swap del modelo es 3 pasos documentados sin tocar `build_features`.
> El KD-tree con haversine real, no euclidiana — porque Lima tiene 70 km de extensión, la curvatura importa."

---

## Slide 7 — Innovación (lo que nadie más del curso hizo)

```
1. RANGO HONESTO en lugar de número falso
   XGBoost quantile P25 / P50 / P75
   Coverage 42,7 % sobre test (≈50 % teórico)

2. CONTRAFACTUALES LIGEROS
   "+1 baño → $1,080  (+8 %)"
   Perturbación numérica de 5 features accionables

3. UX QUE COMUNICA INCERTIDUMBRE
   Banner amarillo cuando confidence = Baja
   "Cobertura baja, referencia no precio"
```

**Lo que dices:**
> "Tres cosas que no son estándar en proyectos del curso:
> primero, en lugar de un número falsamente preciso, mostramos un rango.
> Segundo, contrafactuales ligeros — no DiCE, perturbación numérica simple, suficiente.
> Y tercero, cuando no sabemos, lo decimos. La honestidad sobre la incertidumbre es **bonus, no liability**."

---

## Slide 8 — DEMO EN VIVO

> Slide vacía o con el logo de ubIcA. La demo es lo que vende.

**Lo que dices:** ejecutar el script de `03_demo_guiada.md` (90 s cronometrados).

---

## Slide 9 — Validación + métricas

```
TESTS                       63 passed, 2 skipped
─────────────────────────────────────────────────
Backend  · health, predict, entorno, ml, schemas
ML       · build_features, predict, quantile
Geo      · KD-tree, fuera de bbox, fallback density

GATES PRE-EJECUCIÓN         6 cerrados
─────────────────────────────────────────────────
Gate 1   · outlier caps (excluido por leakage train-serving)
Gate 2   · contrato API congelado
Gate 3   · A/B amenities (UX-8 con MAPE −0.26 pp)
Gate 4   · equivalencia pipeline (hash exacto + 0.00000%)
Gate 5   · mapping DB (SQLite + geo_index)
Gate 6   · selección final modelo (RF → XGB v2 ganador)
```

**Lo que dices:**
> "Antes de codear, cerré 6 gates con evidencia. Antes de cada sprint, auditoría sabueso. 63 tests pytest, incluyendo end-to-end por zona.
> El proceso es tan importante como el resultado."

---

## Slide 10 — Limitaciones honestas (3)

```
1. SESGO A MIRAFLORES
   874 listings vs SMP 12. Mitigado con sample weighting
   1/sqrt(count_distrito) + Bayesian smoothing k=30.
   Solución estructural: re-scrape con foco en zonas escasas.

2. LEAKAGE EN FEATURE ENGINEERING ORIGINAL
   count_1km_* del CSV crudo incluye al listing en su propio cálculo.
   El central v2 y el quantile heredan el mismo sesgo → coherentes
   entre sí. Documentado en train_quantile_v2.py.

3. MODELO NO SE REENTRENA AUTOMÁTICAMENTE
   Reentrenamiento manual trimestral documentado.
   /api/model/info expone days_since_training para monitoreo.
```

**Lo que dices:**
> "Tres cosas que no resolvimos y queremos decir explícitamente, porque ocultarlo es peor que reconocerlo.
> Un sesgo de cobertura geográfica que el banner UX comunica.
> Un leakage heredado del feature engineering original que el central y el quantile sufren coherentemente.
> Y un pipeline sin reentrenamiento automático — manual trimestral, documentado."

---

## Slide 11 — Próximos pasos

```
INMEDIATO (post-defensa)
  • Re-scrape focalizado en La Planicie, Casuarinas, Las Lomas
  • Conformal calibration sobre quantile (coverage 50 % exacto)
  • Endpoint /api/feedback para cerrar el loop con usuarios

CORTO PLAZO (3-6 meses)
  • RENIPRESS clínicas + MINEDU colegios privados como features
  • Quantile loss con conformal split → ICs garantizados
  • Notificación cuando un anuncio queda fuera del rango histórico

LARGO PLAZO
  • Expansión a Arequipa, Trujillo, Cusco (mismas fuentes públicas)
  • API pública con rate limiting
  • Modelo dinámico (re-entrenamiento mensual auto)
```

**Lo que dices:**
> "El producto está en su 1.0. Lo que viene es ampliar cobertura, no cambiar arquitectura.
> Conformal calibration del quantile es lo siguiente — coverage 50 % exacto matemáticamente, no aproximado."

---

## Slide 12 — Cierre + agradecimientos

```
ubIcA

"Una segunda opinión honesta del precio de tu alquiler en Lima."

3,348 listings reales.
4 fuentes públicas.
95 features.
0 APIs pagas.

→ MAPE 15,7 %  ·  R² 0.86  ·  63 tests
→ http://localhost:5500/

Alejandro Marcelo · 2026
```

**Lo que dices:**
> "Eso es ubIcA. Mentir cuesta más que callar. Gracias."

---

## Citas académicas validadas (referirse según pregunta)

> Sabueso Codex 5.3 validó cuáles aplican literal y cuáles son inspiración. NO citar Karpathy, He et al. ni Lin et al. como equivalencia técnica — usar como **inspiración conceptual** si surge.

| Autor | Cuándo citar | Fuerza |
|-------|--------------|--------|
| Eric Ries — *The Lean Startup* | "MVP = aprendizaje validado" | ✅ literal |
| DJ Patil | "producto de datos" | ✅ literal |
| Bill Schmarzo | "descriptivo → predictivo → prescriptivo" | ✅ literal |
| Christoph Molnar — *Interpretable ML* | "interacción no aditiva → XGBoost > Linear" | ✅ literal |
| CRISP-DM / TDSP | Marco metodológico | ✅ literal |
| Andrej Karpathy | "datasets > algorithms" | ⚠️ presentar como filosofía aplicada, no equivalencia técnica |
| He et al. 2014 (FB ads) | Target encoding con suavizado bayesiano | ⚠️ inspiración del concepto, no respaldo literal del k=30 |
| Lin et al. 2017 (Focal Loss) | Sample weighting `1/sqrt(count_distrito)` | ⚠️ inspiración conceptual; el paper es de clasificación |

---

## Formato físico de slides

- **Aspect ratio:** 16:9.
- **Tipografía:** 1 sola — sans serif (Inter, IBM Plex, SF Pro). 24pt mínimo para body.
- **Color:** paleta de ubIcA (mismo azul `#2563eb` del frontend), no más de 3 colores.
- **Sin imágenes stock** salvo la del slide 2 (agente inmobiliario).
- **Screenshots reales** del producto, sin mockups.
- **Logo de UTEC** en esquina inferior izquierda solo en portada y cierre.
