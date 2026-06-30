# Wasi — Documentación del Proceso
 
**Producto de datos para decisiones de alquiler y venta de inmuebles en Lima Metropolitana**
 
Curso DS3022 — Desarrollo de Productos de Datos, UTEC

Equipo: Leonardo Montoya · Diana Ñañez · Alejandro Marcelo
 
Repositorio: `https://github.com/AlejandroMarceloCh/wasi`
 
Video de prototipo: `[pendiente — agregar enlace de YouTube]`
 
---
 
## 0. Resumen ejecutivo
 
Wasi estima el **precio de referencia** de un departamento en Lima y devuelve un **veredicto** (Ganga / Justo / Inflado) acompañado de un rango de incertidumbre, una explicación del precio (SHAP) y el contexto del barrio (seguridad y servicios). Sirve a dos usuarios con objetivos opuestos: el **inquilino**, que quiere no pagar de más, y el **propietario**, que busca el punto óptimo entre margen y rapidez de colocación.
 
El sistema se construyó en tres grandes fases, documentadas en este reporte:
 
1. **Data wrangling** — de scrapes crudos a un dataset limpio de 3,348 avisos
   de alquiler, cruzado con cuatro fuentes públicas (NSE, criminalidad,
   comisarías, 11,100 POIs de OpenStreetMap).
2. **Modeling** — 101 features, cinco modelos candidatos evaluados con
   **validación espacial honesta** (GroupKFold por celda geográfica), selección
   de XGBoost, y una capa de explicabilidad con TreeSHAP exacto.
3. **Prototyping** — un producto end-to-end (FastAPI + React) que sirve el
   modelo congelado con validaciones fail-fast, más una extensión a precio de
   **venta** como prueba de escalabilidad del pipeline.

| Métrica (modelo de alquiler) | Valor | Conjunto |
|---|---|---|
| MAPE | 16.4 % | GroupKFold espacial (n=503) |
| R² | 0.847 | Test |
| MAE | $159 | Test |
| RMSE | $298 | Test |
| Coverage P25–P75 | 41.75 % | Test (objetivo teórico 50 %) |
 
---
 
## 1. Planteamiento del problema
 
En Lima no existe una referencia pública y confiable de cuánto debería costar alquilar o comprar un departamento dado su tamaño, ubicación y entorno. Los portales muestran precios de **aviso** (lo que el anunciante pide), no de **cierre**, y no dan contexto sobre si ese precio es razonable. Esto deja a
inquilinos y propietarios negociando a ciegas.
 
Wasi convierte ese vacío en un producto de datos: un modelo entrenado sobre miles de avisos reales que produce un precio de referencia interpretable, con honestidad sobre su incertidumbre.
 
**Alcance y supuesto clave.** El modelo aprende de precios de **aviso**, no de **cierre** (esos datos no son públicos en Perú). Por eso el producto habla de "precio de referencia" y no de "precio real de mercado": es una limitación asumida y comunicada explícitamente en la interfaz.
 
---
 
## 1.1 Producto y modelo de negocio
 
Wasi sirve hoy a dos usuarios B2C con objetivos opuestos: el **inquilino**, que quiere no pagar de más, y el **propietario**, que fija un precio y muchas veces no lo mueve aunque el mercado diga otra cosa — lo que se traduce en vacancia prolongada o margen perdido. La estrategia comercial usa el segmento B2C (Free → Pro) para validar el producto con usuarios reales antes de escalar hacia el segmento de mayor ticket: **B2B**.
 
El B2B se identificó como la **mayor fuente de ingresos potencial** y se validó con una conversación con un profesional del sector inmobiliario, que confirmó
tres señales de demanda concretas:
 
- **Inmobiliarias** — actualizan su benchmark de precios cada 1–2 semanas para competir por capital y clientes; hoy lo hacen manualmente. Wasi lo automatiza vía API.
- **Pricing para levantamiento de capital** — una inmobiliaria necesita reunir ~30 % del capital total de una obra antes de apalancarse con el banco; un precio de referencia objetivo ayuda a justificar esa negociación.
- **Propietarios que delegan el proceso** — muchos prefieren no gestionar publicación, filtro de inquilinos ni la parte legal del alquiler, y se lo encargan a una inmobiliaria. Esa inmobiliaria es, a su vez, la que necesita datos objetivos de Wasi para asesorar a su cliente.
Esto posiciona a Wasi no solo como una herramienta de consulta directa, sino como **infraestructura de datos** para el ecosistema inmobiliario (inmobiliarias,
portales como Urbania/Adondevivir, y fintech hipotecarias para pre-evaluación de colaterales y monitoreo de cartera). El detalle de la propuesta de valor, estrategia comercial y análisis de competencia está desarrollado en la presentación *"Propuesta de Valor y Visión del Producto"* que acompaña este
reporte.
 
---
 
## 2. Data wrangling
 
### 2.1 Fuentes de datos
 
| Fuente | Tipo | Granularidad | Aporte |
|---|---|---|---|
| AdondeVivir + Properati | Scraping propio | Punto (aviso) | 3,348 avisos de alquiler con precio, área, atributos |
| InfoCasas + Babilonia | Scraping propio | Punto (aviso) | 6,271 avisos de venta (modelo extendido) |
| INEI ENAPRES | Pública | Manzana | Estrato socioeconómico (NSE) |
| MININTER 2024 | Pública | Distrito | Denuncias totales de criminalidad |
| CENACOM | Pública | Punto | 50 comisarías georreferenciadas |
| OpenStreetMap | Pública | Punto | 11,100 POIs en 7 categorías |
 
Todas las fuentes son gratuitas: **cero APIs pagas**. Los scrapers
(`ventas_model/scrape_*.py`) usan rate-limiting cortés (~0.6 s entre requests)
y extraen coordenadas reales de cada aviso, lo cual es la base del componente
geográfico del modelo.
 
### 2.2 Limpieza (`notebooks/01_limpieza.ipynb`)
 
El notebook 01 lleva los scrapes crudos a un dataset validado siguiendo un
diccionario de datos con reglas de calidad por columna:
 
- **Deduplicación** por identificador de aviso.
- **Outliers de precio y precio/m²**: se descartan avisos fuera de rangos
  plausibles (p. ej. precios en soles mal convertidos, alquileres por día
  colados como mensuales, áreas imposibles).
- **Nulos con significado**: se distinguen dos tipos. Los nulos "de contenido"
  (área, baños) se imputan; los nulos "estructurales" (amenities `tiene_*` que
  Properati no reporta) se tratan como ausencia (0), no como dato faltante.
- **Imputación por mediana agrupada** por tipo de propiedad, para no aplastar la
  distribución con una mediana global.
- **`dist_nearest_m_*`**: los nulos geográficos se marcan con un flag y se
  imputan **después del split**, usando el percentil 95 calculado solo sobre
  train (evita fuga de información del conjunto de prueba).
Resultado: **3,348 avisos limpios** de alquiler.
 
### 2.3 Análisis exploratorio (`notebooks/02_eda.ipynb`)
 
El EDA reveló tres hechos que guiaron el modelado:
 
1. **El target tiene sesgo positivo alto** (skewness): pocos avisos muy caros
   estiran la cola. Esto motivó la transformación logarítmica del precio.
2. **Sesgo geográfico del stock**: la oferta se concentra en pocos distritos
   (Miraflores, San Isidro, Surco), lo que obliga a un manejo cuidadoso de los
   distritos con pocos datos.
3. **El precio/m² varía fuertemente por distrito**, confirmando que la ubicación
   debía ser una señal de primer orden en el modelo.
---
 
## 3. Feature engineering (`notebooks/03_feature_engineering.ipynb`)
 
Se construyen **101 features** a partir de las variables crudas y las fuentes
externas. El principio rector fue que cada feature tuviera una justificación de
dominio, no solo estadística.
 
### 3.1 Transformación del target
 
`precio_usd → log1p(precio_usd)`. Por el sesgo detectado en el EDA, se modela en
escala logarítmica. Consecuencia importante: los efectos del modelo son
**multiplicativos** sobre el precio base, no aditivos — algo que se respeta en
toda la cadena de explicabilidad.
 
### 3.2 Familias de features
 
- **Físicas** — área, dormitorios, baños, cocheras, antigüedad, es_estudio.
- **Geográficas (KD-tree de POIs)** — para cada aviso se calculan distancias y
  conteos a 7 categorías de POIs en radios de 1 km, usando un `cKDTree` sobre
  esfera unitaria con distancia haversine. Incluye **breakdown por tier**:
  supermercado premium (Wong/Vivanda) vs masivo (Plaza Vea), banco grande
  (BCP/BBVA) vs chico, farmacia de cadena vs barrial.
- **Socioeconómicas** — NSE por manzana (INEI), denuncias por distrito
  (MININTER), cercanía a comisarías (CENACOM).
- **Encoding del distrito** — Target Encoding con **suavizado bayesiano**: la
  media del distrito se mezcla con la media global ponderada por el número de
  avisos, lo que estabiliza los distritos con pocos datos. Se ajusta **solo en
  train** (y re-ajustado por fold en la validación espacial) para evitar fuga.
- **Categóricas de baja cardinalidad** — One-Hot para fuente y tipo de
  propiedad.
- **Derivadas** — ratios e interacciones (p. ej. ratio área/baños) con umbrales
  fijados en train.
### 3.3 Control de calidad de features
 
El notebook 03 analiza correlación con el target (Pearson para numéricas,
punto-biserial para binarias), multicolinealidad (VIF) y descarta o consolida
features redundantes. El escalado (StandardScaler) se aplica solo para los
modelos lineales; los modelos de árbol no lo requieren.
 
---
 
## 4. Modeling
 
### 4.1 Validación espacial honesta
 
La decisión metodológica más importante del proyecto. Un split aleatorio
ordinario produce **fuga espacial**: departamentos del mismo edificio (con
precios casi idénticos) caen en train y test a la vez, inflando artificialmente
la métrica. Para medir el rendimiento real se usó **GroupKFold agrupando por
celda geográfica**, de modo que un inmueble nunca se evalúa junto a sus vecinos
inmediatos.
 
El efecto es cuantificable y se reporta con transparencia:
 
| Esquema de validación | MAPE | Comentario |
|---|---|---|
| Split aleatorio | 15.7 % | Optimista — inflado por fuga espacial |
| **GroupKFold espacial** | **16.4 %** | El número honesto que se reporta |
 
### 4.2 Tournament de modelos (`notebooks/04` y `05`)
 
Se entrenaron cinco candidatos bajo el mismo esquema de validación, cada uno con
una hipótesis explícita:
 
| Modelo | Rol | Resultado |
|---|---|---|
| Linear Regression | Baseline / piso de performance | Sensible a outliers; colapsa en test |
| Ridge (L2) | Regularización de coeficientes | Marginalmente mejor que el baseline |
| Lasso (L1) | Selección implícita de features | Similar a Ridge |
| Random Forest | No-linealidades, robustez a outliers | Fuerte; finalista |
| **XGBoost** | Boosting secuencial | **Seleccionado** |
 
La selección final (`scripts/gate6_seleccion_modelo.py`) compara Random Forest
vs XGBoost sobre el holdout real de 503 casos, con el MAPE desglosado por rango
de precio. **XGBoost** gana por menor MAPE y mejor comportamiento en los
extremos de precio, además de habilitar TreeSHAP exacto para la explicabilidad.
 
> **Nota de trazabilidad.** Los notebooks didácticos exploran los cinco modelos
> en detalle; el modelo **desplegado en producción** es XGBoost (artefactos en
> `app/backend/models/v2/`). El criterio de decisión fue el MAPE espacial y la
> robustez en los extremos, consistente con `gate6`.
 
### 4.3 Hiperparámetros y tuning
 
Los hiperparámetros de XGBoost se optimizaron con búsqueda sobre **5-fold
cross-validation** (no sobre un único split de validación, para no sobreajustar
la selección de hiperparámetros). El criterio de optimización fue el MAPE medio
de CV, que resultó estable entre folds.
 
### 4.4 Cuantificación de incertidumbre
 
Además del modelo central (P50), se entrenan dos modelos **quantile** (P25 y
P75) que producen una banda intercuartil. El producto muestra esta banda como
"rango de mercado". El coverage empírico medido fue **41.75 %** frente al 50 %
teórico — es decir, los intervalos sub-cubren ligeramente; esto se documenta
abiertamente como limitación conocida, con conformal prediction señalado como
mejora futura.
 
### 4.5 Explicabilidad (SHAP)
 
Se usa **TreeSHAP exacto**, nativo de XGBoost (`pred_contribs=True`), no una
aproximación por sampling. Para cada predicción devuelve la contribución de cada
feature con garantía de aditividad (`precio_base + Σ contribuciones =
predicción`). Las 101 contribuciones se agregan en grupos legibles (Ubicación,
Tamaño, Servicios cercanos, Amenities, Antigüedad, Seguridad) y se convierten a
efecto porcentual. Esto alimenta el waterfall de la interfaz y los
counterfactuals del simulador (cada slider re-ejecuta el modelo con una feature
perturbada).
 
---
 
## 5. Prototyping
 
### 5.1 Arquitectura
 
```
Frontend (React 18 + Leaflet, sin build, vía CDN)
        │  fetch + JWT
        ▼
Backend (FastAPI + SQLAlchemy + SQLite)
        │
        ├─ geo_index.py      → distrito + POIs (cKDTree + haversine)
        ├─ ml_v2.py          → 101 features (réplica exacta del notebook 03)
        ├─ model_service.py  → XGBoost central + quantiles + TreeSHAP
        └─ venta_service.py  → modelo de venta (extensión)
```
 
### 5.2 Paridad entrenamiento–serving
 
El riesgo clásico de un producto de ML es que las features en producción no
coincidan con las del entrenamiento. Wasi lo resuelve haciendo que
`ml_v2.build_features_v2()` **replique exactamente** la construcción del
notebook 03: misma fórmula y mismos artefactos serializados (target encoder,
caps de outliers) que viajan junto al modelo.
 
### 5.3 Validaciones fail-fast
 
Al arrancar, `model_service.py` ejecuta tres chequeos que **impiden levantar el
servidor si el modelo cambió** de forma inesperada:
 
1. **Hash SHA-256** de cada artefacto contra `manifest.json`.
2. **Número de features** esperado (101).
3. **Golden predictions** — casos congelados con tolerancia de 0.1 %.
Esto convierte un posible error silencioso (servir un modelo equivocado) en un
fallo ruidoso e inmediato.
 
### 5.4 Capa de narrativa LLM
 
Encima del SHAP —nunca debajo— una capa con Groq (`llama-3.3-70b-versatile`)
redacta un resumen en español. El **signo y la magnitud de cada efecto se
calculan en Python** antes de armar el prompt: el LLM solo redacta sobre números
ya computados, eliminando la alucinación numérica. Si no hay API key, el
endpoint degrada a 503 y el resto de la app funciona igual.
 
### 5.5 Extensión a venta (`ventas_model/`)
 
Como prueba de que el pipeline escala, se replicó el enfoque para **precio de
venta** con un dataset propio de 6,271 avisos de InfoCasas. Mismo método:
GroupKFold espacial, target encoding re-ajustado por fold. Resultado: **MAPE
espacial 15.8 %**, competitivo con el de alquiler. El módulo está **aislado**
(no toca el modelo de alquiler congelado), lo que demuestra extensibilidad sin
riesgo para el sistema principal.
 
---
 
## 6. Testing y validación
 
El backend incluye **126 tests pytest** en 17 archivos que cubren:
 
- Predicción end-to-end (`/api/fairvalue/predict`).
- Counterfactuals y simulador.
- Modelos quantile y coverage.
- Geo-index (distancias, vecinos).
- Schemas de entrada/salida.
- Arranque fail-fast del modelo.
- Robustez del pipeline de features.
A nivel de modelo, la validación incluye el análisis de residuos
(`notebooks/11_analisis_residuos.ipynb`) por distrito y rango de precio, que
confirma que los errores más altos ocurren en los extremos (propiedades muy
baratas o muy caras), un comportamiento esperado y documentado.
 
### 6.1 Evaluación con usuarios
 
Se realizaron **8 sesiones de prueba** por Zoom con grabación de pantalla
(5 inquilinos, 3 propietarios). Hallazgos principales: el veredicto convence
(acuerdo 4.6/5 inquilino), **los 3 de 3 propietarios** ajustaron el precio que
pensaban pedir tras ver el posicionamiento de Wasi, y la fricción principal fue
la descubribilidad de la función Fair Value. Detalle completo en la
presentación de evaluación de producto.
 
---
 
## 7. Reproducibilidad
 
```bash
# Clonar
git clone https://github.com/AlejandroMarceloCh/wasi.git
cd wasi
 
# Setup (una sola vez: crea venv e instala dependencias)
make setup
 
# Levantar (dos terminales)
make backend     # FastAPI en http://localhost:8000
make frontend    # Estático en http://localhost:5500
 
# Tests
make test
```
 
Demo local: `http://localhost:5500` · usuario `ana@wasi.pe` / `demo1234`.
 
**Orden de reproducción del pipeline de ML:**
 
```
notebooks/01_limpieza.ipynb            → dataset limpio
notebooks/02_eda.ipynb                 → análisis exploratorio
notebooks/03_feature_engineering.ipynb → 101 features
notebooks/04_entrenamiento_modelos.ipynb → 5 candidatos, GroupKFold espacial
notebooks/05_evaluacion_seleccion.ipynb  → selección + serialización
notebooks/11_analisis_residuos.ipynb     → diagnóstico de errores
```
 
Todos los datos necesarios para replicar (datasets de train/test, POIs,
denuncias, comisarías, metadata) están versionados en
`app/backend/data/` y `ventas_model/data/`.
 
---
 
## 8. Limitaciones conocidas
 
1. **Precios de aviso, no de cierre.** El modelo aprende de lo que se pide, no de
   lo que se paga. Comunicado en la UI como "precio de referencia".
2. **Coverage de intervalos sub-óptimo** (41.75 % vs 50 %). Mejora futura:
   conformalized quantile regression.
3. **Cobertura geográfica desigual.** Los distritos con pocos avisos tienen
   mayor incertidumbre; mitigado con suavizado bayesiano y un indicador de
   confianza en la UI.
4. **Sesgo de retransformación log→USD.** El uso de `expm1` introduce un sesgo
   menor de Jensen, no corregido (impacto bajo en MAPE).
5. **Venta es v0.** El modelo de venta es una demostración de extensibilidad, sin
   la capa completa de SHAP/narrativa del modelo de alquiler.
---
 
## 9. Próximos pasos
 
- Mejorar la descubribilidad de Fair Value (principal fricción de usuario).
- Robustecer el formulario de publicación del propietario (validación, carga de
  ubicación, fotos del inmueble).
- Calibrar los intervalos con conformal prediction.
- Evaluar los perfiles de agente e inversionista (no cubiertos en esta ronda).
- Migrar a la convención cookiecutter-data-science (separar `src/` de `app/`)
  sin duplicar el código de features.