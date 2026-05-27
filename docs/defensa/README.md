# Sprint 4 — Defensa oral

> Carpeta con todos los artefactos para sustentar ubIcA frente al jurado del curso DS3022.

---

## Archivos en este directorio

| Archivo | Para qué | Tiempo total |
|---------|----------|--------------|
| [`01_canvas.md`](01_canvas.md) | Data Product Canvas — 10 bloques, U2 slide 29 | leer 5 min |
| [`02_pitch_90s.md`](02_pitch_90s.md) | Elevator pitch memorizable + variantes | memorizar 2 h |
| [`03_demo_guiada.md`](03_demo_guiada.md) | Script de demo cronometrado (3 pins) | ensayar 3× |
| [`04_slides_defensa.md`](04_slides_defensa.md) | 12 slides con guion por slide | armar 2 h |
| [`05_qa_defensivo.md`](05_qa_defensivo.md) | 5 preguntas core + 2 reserva + reglas | memorizar 2 h |

---

## Plan de defensa — orden y tiempos

```
00:00  Saludo + slide 1 (portada)                       10 s
00:10  Slide 2 — Problema (gancho)                      25 s
00:35  Slide 3 — Producto                               20 s
00:55  Slide 4 — Stack                                  40 s
01:35  Slide 5 — Datos                                  35 s
02:10  Slide 6 — Pipeline                               40 s
02:50  Slide 7 — Innovación (3 puntos)                  45 s
03:35  Slide 8 — DEMO EN VIVO ★                         90 s
05:05  Slide 9 — Validación + métricas                  35 s
05:40  Slide 10 — Limitaciones honestas                 40 s
06:20  Slide 11 — Próximos pasos                        30 s
06:50  Slide 12 — Cierre                                15 s
07:05  Q&A                                              5-10 min
```

**Total exposición:** ~7 min · **Q&A:** 5-10 min · **Total:** 12-17 min.

---

## Checklist 24 h antes

- [ ] Slides finalizadas en Google Slides (16:9), exportadas a PDF de respaldo.
- [ ] Backend levantado, frontend levantado, dashboard de Ana limpio.
- [ ] Login probado: `ana@ubica.pe` / `demo1234`.
- [ ] 3 ensayos completos del pitch + demo cronometrados.
- [ ] Pitch memorizado al 100 % (no leer de papel).
- [ ] Q&A core 1-5 memorizadas, reservas 1-2 ojeadas.
- [ ] Laptop con cargador. Adaptador HDMI o USB-C según proyector.
- [ ] Tab abierta en `localhost:5500/` desde antes.
- [ ] Cierre todas las apps que pueden notificar (Slack, WhatsApp Desktop, Mail).
- [ ] DevTools del browser cerradas. Ventana en pantalla completa.

---

## Checklist 1 h antes

- [ ] Llegada 15 min antes para verificar proyección + audio.
- [ ] Backend respondiendo en `:8000/api/health` con `status: "ok"` y `model_mode: "v2"`.
- [ ] Pasar el cursor por encima de "MAPE" y "R²" en el FairValueResult → verificar que aparecen tooltips.
- [ ] Tomar agua antes. Respirar profundo 3 veces.

---

## Si te tiembla la voz

- Hablar **más despacio**, no más rápido. Lo opuesto a lo que el cerebro quiere.
- Mirá al jurado más amigable (siempre hay uno que asiente).
- Si te equivocás en una métrica, decila y seguí. Nadie va a verificar 15,7 vs 15,74 en vivo.
- Tomar agua entre slide 6 y slide 7. Da pausa natural sin parecer dudoso.

---

## Backlog si te dan feedback en la defensa

Anotalo en una libreta visible. El jurado valora que tomes apuntes. Después del proyecto, agregalo a:
- `_archive/docs_obsoletos/PENDIENTES_rubrica.md` o
- Nuevo issue en el repo GitHub si lo subís.

NO interrumpas al jurado mientras habla. NO defiendas lo indefendible. Si tienen razón, asentí.

---

## Material de soporte para la defensa

| Recurso | Path | Cuándo mostrarlo |
|---------|------|------------------|
| Diagramas Mermaid | `../DIAGRAMAS.md` | Si piden detalle de arquitectura |
| Flujo end-to-end | `../FLUJO_TRABAJO.md` | Si piden detalle de feature engineering |
| Notebook 11 con plots | `../notebooks/11_analisis_residuos.ipynb` | Si preguntan por error analysis |
| Gates | `../gates/` | Si preguntan por validación pre-ejecución |
| Auditoría Codex | `../codex_audit_resultado.md` | Si preguntan por auto-evaluación |
| Métricas quantile reproducibles | `../../app/backend/models/v2/quantile_coverage.json` | Si preguntan por coverage del rango |

---

## Ranking emocional de cierre

| Rúbrica criterio | Probable nota | Cómo defenderlo |
|------------------|---------------|-----------------|
| Funcionalidad (5) | 5/5 | Demo funciona en vivo, /health responde, 63 tests verdes |
| Diseño y Usabilidad (5) | 5/5 | 29 aria-labels WCAG, tooltips, banner low-coverage, breakdown del score |
| Integración Datos+Modelo (7) | 6.5 - 7/7 | 4 fuentes públicas, 95 features, contrafactual, Notebook 11 error analysis |
| Innovación (3) | 3/3 | Quantile P25-P75 (no se hace en proyectos del curso típicos), contrafactual ligero, UX que comunica incertidumbre |
| **TOTAL ESPERADO** | **19.5 — 20 / 20** | — |

Si llegás a 20/20 → fiesta. Si llegás a 19.5 → ya superaste el objetivo declarado.

---

## Última línea

> "Mentir cuesta más que callar." — Esa es la diferencia con cualquier otro estimador del mercado.
