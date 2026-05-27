"""
Gate 3 — A/B offline de amenities  ·  protocolo escalonado top-8 → 12 → 15.

Pregunta: ¿cuántos chips de amenities necesita el form? El modelo usa 37
features `tiene_*`; el form no puede tener 37 chips. Este experimento mide
cuánto empeora el MAPE si el usuario solo informa las top-N amenities (las
demás se ponen en 0, como pasaría en producción).

Protocolo: probar top-8; si delta ≤ 2 pp se aprueba; si no, top-12; si no,
top-15. delta = MAPE(top-N) − MAPE(top-37), ambos con amenities_count
recalculado, así se aísla el efecto de reducir chips.

Uso:  ./venv/bin/python scripts/gate3_amenities.py
"""
from pathlib import Path
import sys

import joblib
import numpy as np
import pandas as pd

BACKEND = Path(__file__).resolve().parent.parent
MODELS = BACKEND / "models"
PIPELINE_DATA = BACKEND.parent.parent / "pipeline" / "data" / "processed"
GATES = BACKEND.parent.parent / "gates"

UMBRAL_PP = 2.0  # delta máximo de MAPE aceptable por nivel


def mape(real, pred) -> float:
    return float(np.mean(np.abs(pred - real) / real) * 100)


def construir_reducido(xtest: pd.DataFrame, tiene_keep: list[str],
                       tiene_all: list[str]) -> pd.DataFrame:
    """X_test simulando que el form solo capturó las amenities `tiene_keep`."""
    X = xtest.copy()
    drop = [c for c in tiene_all if c not in tiene_keep]
    X[drop] = 0
    # amenities_count (crudo) = suma de las tiene_* que quedan
    new_count = X[tiene_keep].sum(axis=1)
    X["amenities_count"] = new_count
    # area_x_amenities estaba en log1p → reconstruir en crudo y re-log
    area_raw = np.expm1(xtest["area_final_m2"])      # area está en features_log
    X["area_x_amenities"] = np.log1p(area_raw * new_count)
    return X


def main() -> int:
    rf = joblib.load(MODELS / "04_random_forest.joblib")
    xtest = pd.read_csv(PIPELINE_DATA / "X_test.csv")
    real = np.expm1(pd.read_csv(PIPELINE_DATA / "y_test.csv")["log_precio"].to_numpy())

    feat = list(rf.feature_names_in_)
    tiene_all = [f for f in feat if f.startswith("tiene_")]
    imp = dict(zip(feat, rf.feature_importances_))
    ranking = sorted(tiene_all, key=lambda c: imp[c], reverse=True)
    print(f"Amenities `tiene_*` en el modelo: {len(tiene_all)}")
    print("Top-15 por importancia RF:")
    for i, c in enumerate(ranking[:15], 1):
        print(f"  {i:2d}. {c:42s} {imp[c]:.4f}")

    # referencia: top-37 (todas) con amenities_count recalculado
    X_full = construir_reducido(xtest, ranking, tiene_all)
    mape_full = mape(real, np.expm1(rf.predict(X_full)))
    print(f"\nMAPE referencia (top-37, todas las amenities): {mape_full:.2f}%")

    resultados = {}
    for n in (8, 12, 15):
        X_n = construir_reducido(xtest, ranking[:n], tiene_all)
        m = mape(real, np.expm1(rf.predict(X_n)))
        resultados[n] = (m, m - mape_full)
        print(f"  top-{n:<2d}: MAPE {m:.2f}%   delta {m - mape_full:+.2f} pp")

    # protocolo escalonado
    elegido = None
    for n in (8, 12, 15):
        if resultados[n][1] <= UMBRAL_PP:
            elegido = n
            break

    if elegido:
        print(f"\nDECISIÓN: top-{elegido} aprobado "
              f"(delta {resultados[elegido][1]:+.2f} pp ≤ {UMBRAL_PP} pp)")
    else:
        print(f"\nDECISIÓN: top-15 no cumple → escalar a discusión")

    # ── escribir gate3_resultado.md ─────────────────────────────────────
    GATES.mkdir(exist_ok=True)
    tabla = "\n".join(
        f"| top-{n} | {resultados[n][0]:.2f}% | {resultados[n][1]:+.2f} pp | "
        f"{'✅ aprobado' if resultados[n][1] <= UMBRAL_PP else '❌ supera umbral'} |"
        for n in (8, 12, 15))
    chips = "\n".join(f"{i}. `{c}`" for i, c in enumerate(ranking[:elegido or 15], 1))
    md = f"""# Gate 3 — A/B de amenities  ·  RESULTADO

**Fecha:** 2026-05-21
**Decisión:** el form usa **top-{elegido or '15 (REVISAR)'}** amenities.
**Estado:** {'CERRADO' if elegido else 'ESCALAR A DISCUSIÓN'}.

## Experimento

El modelo usa {len(tiene_all)} amenities `tiene_*`. El form no puede tener
{len(tiene_all)} chips. Se mide cuánto empeora el MAPE en X_test (503 casos)
si el usuario solo informa las top-N amenities (el resto = 0, como en
producción). `delta = MAPE(top-N) − MAPE(top-37)`; ambos con
`amenities_count` recalculado para aislar el efecto de reducir chips.

MAPE referencia (top-37, todas): **{mape_full:.2f}%**  ·  umbral: delta ≤ {UMBRAL_PP} pp

| set | MAPE | delta vs top-37 | resultado |
|---|---|---|---|
{tabla}

## Set de amenities elegido para el form (top-{elegido or 15} por importancia RF)

{chips}

## Conclusión

{'Con top-' + str(elegido) + ' el MAPE se mantiene dentro de ' + str(UMBRAL_PP) + ' pp del modelo completo. El form muestra estos ' + str(elegido) + ' chips; las demás amenities se asumen 0. Set fijo para Fase 2 (build_features) y Fase 5 (wizard).' if elegido else 'Ningún set hasta top-15 cumple el umbral. Escalar a discusión antes de implementar.'}
"""
    (GATES / "gate3_resultado.md").write_text(md)
    print(f"\nEscrito: {GATES / 'gate3_resultado.md'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
