# Demo guiada — 90 segundos cronometrados

> **Objetivo:** mostrar honestidad + precisión + entorno en 3 pins consecutivos.
> **Setup requerido:** backend en `:8000`, frontend en `:5500`, login con `ana@ubica.pe` / `demo1234`, **dashboard limpio** (Ana sin análisis previos).
> **Cronómetro:** practicar 3 veces antes. Si pasás 110 s, cortar el script.

---

## Setup pre-defensa (5 min antes)

```bash
# Verificar puertos limpios
lsof -i :8000 -i :5500

# Si hay procesos viejos, matarlos
# Levantar backend
cd ~/Desktop/PROYECTOS_2026/Proyecto_DPD/app/backend
./venv/bin/uvicorn main:app --port 8000 --host 127.0.0.1 --log-level warning &

# Levantar frontend (en otra pestaña)
cd ~/Desktop/PROYECTOS_2026/Proyecto_DPD/app
python3 -m http.server 5500 &

# Limpiar data de Ana (ver scripts/cleanup_ana.py si existe; sino ya está limpio)
# Verificar:
curl -s http://127.0.0.1:8000/api/health
# Debe responder: {"status":"ok","model_mode":"v2",...}
```

Abrir el browser en **http://localhost:5500/**, hacer login. Dashboard vacío.

---

## Script (90 s — leer en silencio mientras hacés clicks)

### Acto 1 — La Planicie (zona N≤5, mostrar honestidad) · 30 s

**[Click "Fair Value" en home]**

> "Arrastro el pin a La Planicie, una zona premium de La Molina."

**[Pin en aprox. lat -12.06, lng -76.94 — área residencial alta]**

> "Pongo un depto de 200 m², 4 dormitorios, 3 baños, 2 cocheras, 5 años de antigüedad. Precio anunciado: $3,500."

**[Click "Calcular"]**

> "Miren qué pasa cuando la zona tiene poca data.
> El modelo me da una predicción, pero notar **dos cosas**:
> el tag dice 'Confianza: Baja',
> y aparece un banner amarillo que dice 'cobertura baja en esta zona — tomá esto como referencia, no como precio exacto'.
> No estoy fingiendo precisión donde no la tengo."

---

### Acto 2 — Miraflores (zona densa, mostrar precisión) · 30 s

**[Click "Atrás", nuevo Fair Value]**

> "Ahora voy a Miraflores, donde tenemos 874 listings."

**[Pin en aprox. lat -12.12, lng -77.03 — frente a Larcomar]**

> "Depto similar: 80 m², 2 dormitorios, 2 baños, 1 cochera, 10 años, $1,100 de precio anunciado."

**[Click "Calcular"]**

> "Acá la cosa cambia: confianza alta, predicción $926 con rango P25 a P75 entre $838 y $998.
> Veredicto: el precio anunciado de $1,100 está inflado un 19 %.
> Y abajo, los factores: Ubicación 'Premium' por el barrio,
> Área 'Estándar' para la zona,
> Antigüedad 'Premium' porque es edificio nuevo.
> Y los contrafactuales: si tuviera 1 dormitorio más, subiría 12 %. Si tuviera 1 baño menos, bajaría 8 %."

---

### Acto 3 — San Martín de Porres (mix densidad + contexto) · 30 s

**[Botón "Ver contexto del barrio" o navegar manualmente a Entorno]**

**[Pin en aprox. lat -12.00, lng -77.07 — Av. Tomás Valle]**

> "Por último, San Martín de Porres — zona popular, menos premium pero con cobertura razonable.
> Esto es la pantalla de Entorno: arrastro el pin y todo se actualiza en vivo.
> Score de entorno: combina seguridad y servicios.
> El breakdown muestra **denuncias del distrito vs promedio Lima** — acá es 1.3× el promedio, se ve la barra roja.
> Servicios cercanos en 1 km: 3 supermercados, 2 farmacias, 4 bancos.
> Y si el pin se va fuera de Lima — lo arrastro a Trujillo — banner amarillo: 'por ahora solo cubrimos Lima Metropolitana'.
> No log a consola. Mensaje al usuario."

**[Volver al home]**

> "Eso es ubIcA. ¿Preguntas?"

---

## Cronómetro recomendado

| Acto | Tiempo objetivo | Tiempo aceptable |
|------|-----------------|------------------|
| Acto 1 (La Planicie) | 30 s | 25-35 s |
| Acto 2 (Miraflores) | 30 s | 25-35 s |
| Acto 3 (SMP + Entorno) | 30 s | 25-40 s |
| **Total** | **90 s** | **85-110 s** |

Si vas a las 100 s, está OK. Si pasás 120 s, ensayá de nuevo cortando descripciones.

---

## Coordenadas exactas (copy-paste si lat/lng pegado funciona en MapPicker)

Si el `MapPicker` acepta input numérico (no solo drag), usar estos valores. Si solo acepta drag, memorizar la zona visual:

| Zona | lat | lng | Razón |
|------|-----|-----|-------|
| La Planicie | -12.085 | -76.937 | Premium con n_comparables ≤ 5 → trigger banner |
| Miraflores (Larcomar) | -12.131 | -77.031 | Densidad alta, confidence Alta |
| San Martín de Porres | -12.005 | -77.073 | Popular, contexto interesante en breakdown |
| Trujillo (fuera de Lima) | -8.110 | -79.030 | Trigger HTTP 400 + banner amarillo |

---

## Fallbacks si algo falla

**Si el backend no responde:**
> "Disculpen, el backend tarda en inicializar. Mientras, les muestro el código del `model_service.py` que es la capa de aislamiento del modelo."
>
> Abrir `app/backend/model_service.py` en VSCode, mostrar las 3 validaciones de startup (hash + n_features + golden prediction).

**Si el frontend está roto visualmente:**
> "Hay un detalle visual; vamos directo al endpoint."
>
> Abrir `http://localhost:8000/docs` (Swagger) y demostrar `/api/fairvalue/predict` desde ahí. Es más técnico pero impecable.

**Si el mapa Leaflet no carga (CDN caído):**
> Demo solo con coordenadas en JSON vía Swagger. Decir explícitamente:
> "Leaflet se carga por CDN; en demo offline se hace por endpoint directo."

**Si te quedás en blanco a mitad:**
> Respirar. Decir literalmente "déjenme retomar". Volver al primer pin. No improvisar.

---

## Lo que NO hacer durante la demo

- **No** abrir las DevTools del browser (Console / Network). Distrae.
- **No** explicar el código (eso es para Q&A si lo piden).
- **No** mostrar el `git log`. Eso es para el `README`.
- **No** disculparte por bugs visuales menores. Si los notan, "buena observación, lo registramos en backlog".
- **No** mencionar lo que NO está hecho (S3.2, S3.3, dark mode). Solo mencionar si te preguntan directo.

---

## Ensayo

3 ensayos minimum:

1. **Ensayo 1 — solo:** cronometrar con el iPhone. Si pasás 100 s, identificar dónde sobraron palabras.
2. **Ensayo 2 — grabado:** video con QuickTime. Mirar la grabación: ¿se ve fluido? ¿hay pausas raras?
3. **Ensayo 3 — con audiencia:** alguien de confianza haciendo de jurado. Que te interrumpa con una pregunta a mitad. Practicar volver al script.
