# Documentación de Wasi

## Vigentes

| Archivo | Qué es | Cuándo abrirlo |
|---|---|---|
| `BITACORA_FORMS.md` | Memoria por sprint (append-only). Sprints 0–22. | Siempre que retomes: reconstruye qué se tocó y con qué resultado. |
| `HALLAZGOS_CODEX.md` | Backlog numerado (#1–#36). Los commits lo citan. | Para saber qué significa "#20" en un mensaje de commit. |
| `CONSOLIDADO_HALLAZGOS_ROI.md` | 760 hallazgos → ~270 accionables, priorizados. | Para elegir en qué trabajar. |
| `RESULTADOS_VALIDACION_ESPACIAL.md` | Cómo se validó el modelo y con qué números. | Si alguien pregunta por el MAPE o la metodología. |
| `EVIDENCIA_ISSUES_MODELO.md` | Evidencia de #22 (cobertura), #29 (amenities), #30 (Jensen). | Al discutir mejoras del modelo. |
| `AUDITORIA_DECISION_BABILONIA.md` | Por qué el modelo de venta usa solo InfoCasas. | Antes de tocar el dataset de venta. |
| `AUDIT_LOG.md` · `CHANGELOG_AUDITORIA.md` | Bitácoras de las rondas de auditoría. | Para rastrear una decisión vieja. |

## `_historico/`

17 planes y briefs **ya ejecutados** (sprints, migración a Vite, auditorías,
tareas para agentes). Se conservan como registro, pero no son guía de trabajo:
lo que proponen ya se hizo o quedó superado. No arranques un sprint desde ahí
sin contrastar contra `BITACORA_FORMS.md`.

## Reproducir las métricas del modelo

```bash
PYTHONPATH=app/backend app/backend/venv/bin/python scripts/build_dataset_v2.py
app/backend/venv/bin/python scripts/train_model_v2.py
```

Salida en `data/processed/v2/metricas_v2.json`. El artefacto servido no se toca:
`train_model_v2.py --fit-final` deja un candidato aparte en `models/v2/candidato/`.
