# Data Product Canvas — ubIcA

> **Plantilla:** U2 slide 29 del curso DS3022.
> **Producto:** ubIcA — Precio de referencia de alquiler en Lima Metropolitana.
> **Fecha:** 2026-05-27.
> **Versión:** entrega final.

---

## 1. Problema

> ¿Qué fricción real estamos resolviendo?

El **41 % del mercado de alquileres de Lima** se concentra en 2 distritos (Miraflores + San Isidro). En el otro 59 %, la información es opaca:

- Inquilinos no tienen referencia real para negociar — un agente dice "ese precio es de mercado" sin que se pueda verificar.
- Propietarios fijan precios desde la intuición o copiando avisos vecinos (sin ajustar por amenities, antigüedad o entorno).
- Las herramientas existentes (AdondeVivir, Properati) muestran avisos pero **no estiman valor de mercado**.

**Resultado:** asimetría de información que castiga al lado más débil de la negociación. Para una decisión que pesa el 30-50 % del ingreso mensual de una familia, el dato debería ser público y honesto.

---

## 2. Cliente / Usuario

> ¿Quién paga el costo de la fricción hoy?

**Persona primaria:** **inquilino primerizo** (25-40 años, Lima Metropolitana, profesional, primera vez alquilando solo).
- Conoce el mercado por amigos, no por data.
- Necesita una **segunda opinión** rápida antes de firmar.

**Persona secundaria:** **propietario individual** (50-70 años, 1-3 inmuebles, no vive de la renta).
- Fija precios por inercia.
- Quiere "no quedarse" pero tampoco "regalarlo".

**Persona terciaria (out of scope MVP):** agente inmobiliario que quiere validar precios contra mercado.

---

## 3. Propuesta de valor

> Una sola frase. Si necesita dos, está mal redactada.

> **"Una segunda opinión honesta del precio de tu alquiler en Lima, basada en 3,348 avisos reales y datos públicos — no en intuición de agente."**

Cuatro promesas concretas:

1. **Honestidad sobre la incertidumbre** — banner UX cuando hay poca data cerca, en lugar de fingir precisión.
2. **Contexto integral** — score de seguridad (denuncias reales) y servicios (POI count), no solo el número.
3. **Razones legibles** — factores cualitativos (Premium / Estándar / Bajo promedio), contrafactuales "qué pasaría si tuvieras 1 baño más".
4. **Sin signup friction** — usuario demo `ana@ubica.pe` cargado al instante.

---

## 4. Solución técnica

> ¿Qué hacemos para entregar esa propuesta de valor?

```
[Usuario]
   │  pin en mapa Leaflet · form ~8 toques · 8 chips de amenities
   ▼
[Frontend React 18 (Babel standalone, sin build)]
   │  POST /api/fairvalue/predict {lat,lng,...}
   ▼
[Backend FastAPI + SQLAlchemy 2 + SQLite + JWT]
   │  1. geo_lookup(pin)        → KD-tree cKDTree + IDW haversine (1ms)
   │  2. osm_lookup(pin)        → 7 cats × 3 métricas = 21 features
   │  3. distrito_features      → INEI NSE + MININTER + CENACOM
   │  4. build_features_v2      → vector de 95 features
   ▼
[XGBoost v2 (modelo central)] + [3 XGBoost quantile P25/P50/P75]
   │  fair_value ($) + prediction_interval {p25, p50, p75}
   │  + factors (5) + counterfactuals (top-5)
   ▼
[Frontend renderiza]
   - GaugeChart con verdict ↑ Inflado / = Justo / ↓ Ganga
   - Rango "P25 – P75" + centro P50
   - Score del entorno (seguridad + servicios) con breakdown
```

---

## 5. KPIs

> ¿Cómo medimos que funciona?

**Técnicos (modelo):**
- **MAPE en test:** 15.74 % (XGBoost v2, mejora de 0.18 pp vs RF v1)
- **R² en test:** 0.861
- **MAE en USD:** $158 (mejora de $15 vs v1)
- **Coverage P25-P75:** 42.7 % (objetivo teórico 50 %; rango defendible)
- **Latencia /predict p95:** <1 s en localhost (con 10 re-predicciones por contrafactual)

**Producto (post-MVP, a definir):**
- % de usuarios que cambian su precio anunciado después de ver el verdict
- Tiempo desde pin hasta decisión (NPS post-uso)
- Tasa de uso del breakdown del score (proxy de educación financiera)

**Honestidad:**
- % de predicciones que disparan banner "cobertura baja" → 8 % (= 27 listings con n_comparables < umbral)

---

## 6. Datos requeridos

> ¿Qué fuentes y por qué cada una?

| Fuente | Qué aporta | Volumen | Frecuencia |
|--------|-----------|---------|------------|
| **Scraping AdondeVivir + Properati** | 3,348 listings reales con precio, área, ubicación, amenities | 3,348 filas × 75 columnas | Mensual (manual) |
| **INEI ENAPRES** | `estrato_nse` por manzana → contexto socioeconómico | 5 estratos × 40 distritos | Anual |
| **MININTER 2024** | Denuncias por distrito y categoría (violentas / patrimoniales / otras) | 40 distritos × 3 buckets | Anual |
| **CENACOM** | 50 comisarías geolocalizadas → señal de seguridad | 50 puntos | Cada 5 años |
| **OpenStreetMap** | 11,100 POIs en 7 categorías (supermercados, bancos, parques, ...) | 11,100 puntos | Trimestral |

**No usamos:** APIs pagas (Google Places), data sintética, ni encuestas. Toda la data es **pública y trazable**.

---

## 7. Arquitectura

> Visto en `DIAGRAMAS.md` (6 Mermaid). Resumen:

- **Frontend** estático servible desde cualquier static host (S3, Vercel, Netlify, GitHub Pages).
- **Backend** FastAPI deployable en EC2 t2.micro, Render free tier, o Cloudflare Workers (con adaptador).
- **DB** SQLite (file) — la usamos como sesión + historial. Migración a Postgres es 1 variable de entorno.
- **Modelos** en `app/backend/models/v2/`: 1 central + 3 quantile + artefactos (encoder, log features). ~30 MB total.
- **Índice geográfico** `cKDTree` cargado en RAM al startup. 3,348 puntos = ~50 KB.
- **Aislamiento del modelo:** `model_service.py` es la única pieza que toca `.joblib`. Swap del modelo = 3 pasos documentados sin tocar `build_features`.

---

## 8. Costos

> Para sustentar el MVP en producción.

| Ítem | Costo mensual | Notas |
|------|---------------|-------|
| Backend EC2 t2.micro o Render free | $0 – $10 | Free tier alcanza para tráfico estudiantil |
| Frontend static (Vercel / Cloudflare Pages) | $0 | Sin build |
| SQLite hosted (file en EC2) | $0 | < 1 MB tras 1 año de uso |
| Dominio | ~$1 | ubica.pe es ~$15/año |
| Scraping mensual | ~2 h de tiempo humano | Sin proxy, sin scraping comercial |
| Reentrenamiento trimestral | ~30 min de tiempo humano | `train_quantile_v2.py` ya está reproducible |
| **Total operativo** | **~$11/mes** | Asumiendo dominio + Render paid si crece |

**Sin costo recurrente de APIs externas** (Google Maps, Properati API, etc.).

---

## 9. Riesgos y mitigación

> Lo que sabemos que puede salir mal.

| Riesgo | Probabilidad | Mitigación actual |
|--------|--------------|-------------------|
| **Sesgo a Miraflores** (874 listings vs SMP 12) | Alta | Sample weighting `1/sqrt(count_distrito)`, target encoding con Bayesian smoothing k=30, banner UX cuando confidence=Baja |
| **Modelo se vuelve obsoleto** (drift de mercado) | Media | Reentrenamiento manual trimestral documentado, `/api/model/info` expone `days_since_training` para monitoreo |
| **Listings fake / outliers** | Media | Capping p99 sobre área, dormitorios, etc. (computado en train, aplicado en val/test) |
| **Dependencia de scraping** | Alta | Documentado como riesgo. Si AdondeVivir bloquea, los modelos siguen funcionando con la data ya entrenada |
| **Leakage en feature engineering** (count_1km incluye al propio listing) | Confirmado | Documentado en `train_quantile_v2.py` y `gates/`. El modelo central tiene el mismo bias → coherente con el quantile, NO arreglado en este sprint |
| **Coverage P25-P75 = 42.7 % vs 50 % teórico** | Detectado | XGBoost quantile sin conformal calibration. Defendible; texto UI no afirma 50 % literal |
| **Cobertura escasa en zonas premium** (La Planicie, Casuarinas, n≤5) | Alta | Banner "cobertura baja" se dispara, confidence=Baja, rango ancho. Si el banner aparece, el usuario sabe |

---

## 10. Aprendizaje validado (Eric Ries)

> ¿Qué descubrimos construyendo esto que no sabíamos al inicio?

1. **El gap es de datos, no de modelo.** XGBoost vs Random Forest mueve la aguja solo 0.18 pp de MAPE. La diferencia real entre 16 % y 10 % de error vendría de más cobertura geográfica, no de más capas.
2. **La honestidad sobre la incertidumbre es bonus, no liability.** Mostrar "cobertura baja" no aleja al usuario — lo hace confiar más en los casos donde no aparece.
3. **La rúbrica del curso (DS3022) coincide con buena práctica industrial.** Contrafactual + error analysis + Canvas no son académicos, son lo que un equipo de data sólido entrega.
4. **El switch v1 → v2 con isolation layer pagó.** Cambiar de RF a XGBoost fue 3 pasos (copiar joblib, regenerar manifest, restart). Cero riesgo de drift silencioso porque el startup valida hash + n_features + golden prediction.

---

## Bonus — Anexos para defensa

- `DIAGRAMAS.md` — 6 diagramas Mermaid (sistema, pipeline, contrato API, etc.)
- `FLUJO_TRABAJO.md` — explicación fin-a-fin del sistema
- `docs/notebooks/11_analisis_residuos.ipynb` — error analysis con plots
- `gates/gate*_resultado.md` — los 6 gates pre-ejecución cerrados con evidencia
- `AUDIT_v2_vs_rubrica.md` — auditoría rúbrica vs implementación
- `app/backend/models/v2/quantile_coverage.json` — métricas reproducibles del quantile
