"""
Calibración de `confidence`  ·  Fase 0.5 (diferida) del PLAN.

Backtest leave-one-out ESTRICTO sobre los 503 listings de X_test:
para cada listing se reconstruye su contexto geográfico por IDW excluyendo
sí mismo, las coordenadas idénticas y los vecinos a < 10 m, se predice y se
mide el error relativo. Luego se relaciona el error con la densidad de
comparables y se fijan los umbrales Alta / Media / Baja.

Salida: app/backend/confidence_thresholds.json

Uso:  ./venv/bin/python scripts/calibrate_confidence.py
"""
from pathlib import Path
import json
import sys

import numpy as np
import pandas as pd

BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))

from geo_index import IDW_COLS, POI_TYPES, _haversine_m, _to_unit_sphere, get_index  # noqa: E402
from model_service import model_service  # noqa: E402

PIPELINE_DATA = BACKEND.parent.parent / "pipeline" / "data" / "processed"

RADIO_COMPARABLES_M = 1000.0
EXCL_M = 10.0   # se excluye sí mismo + coords idénticas + vecinos < 10 m
K_IDW = 8


def loo_geo(idx, lat, lng):
    """Reconstruye el contexto geo por IDW excluyendo vecinos a < 10 m.

    Devuelve (dict de IDW_COLS, densidad de comparables en 1 km).
    """
    k = min(120, idx.n)
    _, cand = idx._tree.query(_to_unit_sphere([lat], [lng]), k=k)
    cand = np.atleast_1d(cand).ravel()
    d = _haversine_m(lat, lng, idx._lat[cand], idx._lng[cand])
    keep = d >= EXCL_M                      # excluye sí mismo, idénticos y < 10 m
    cand, d = cand[keep], d[keep]

    d_all = _haversine_m(lat, lng, idx._lat, idx._lng)
    densidad = int(np.sum((d_all >= EXCL_M) & (d_all <= RADIO_COMPARABLES_M)))

    order = np.argsort(d)[:K_IDW]
    ci, cd = cand[order], d[order]
    w = 1.0 / np.maximum(cd, EXCL_M)
    w = w / w.sum()
    geo = {c: float(np.dot(w, idx._geo[c][ci])) for c in IDW_COLS}
    return geo, densidad


def main() -> int:
    model_service.load()
    idx = get_index()
    xtest = pd.read_csv(PIPELINE_DATA / "X_test.csv")
    real = np.expm1(pd.read_csv(PIPELINE_DATA / "y_test.csv")["log_precio"].to_numpy())
    log_feats = set(model_service.log_features)

    rel_err = np.zeros(len(xtest))
    densidad = np.zeros(len(xtest), dtype=int)

    for i in range(len(xtest)):
        fila = xtest.iloc[i].copy()
        geo, dens = loo_geo(idx, fila["latitud"], fila["longitud"])
        densidad[i] = dens
        # sobrescribir solo las columnas geo con los valores LOO
        for c in IDW_COLS:
            fila[c] = np.log1p(geo[c]) if c in log_feats else geo[c]
        fila["total_poi_1km"] = sum(geo[f"count_1km_{t}"] for t in POI_TYPES)
        pred = model_service.predict(pd.DataFrame([fila])[model_service.feature_order])
        rel_err[i] = abs(pred - real[i]) / real[i]

    print(f"Backtest LOO sobre {len(xtest)} listings de X_test\n")
    print(f"Error relativo global: mediana {np.median(rel_err)*100:.1f}%  "
          f"media {np.mean(rel_err)*100:.1f}%")
    print(f"Densidad de comparables: min {densidad.min()}  "
          f"mediana {int(np.median(densidad))}  max {densidad.max()}\n")

    # error por bin de densidad (quintiles)
    bordes = np.unique(np.quantile(densidad, [0, .2, .4, .6, .8, 1.0]).astype(int))
    print(f"{'densidad':>16s} {'n':>5s} {'mediana err':>12s} {'p75 err':>10s}")
    bins = []
    for lo, hi in zip(bordes[:-1], bordes[1:]):
        m = (densidad >= lo) & (densidad < hi if hi != bordes[-1] else densidad <= hi)
        if m.sum() == 0:
            continue
        med = float(np.median(rel_err[m]))
        p75 = float(np.percentile(rel_err[m], 75))
        bins.append((int(lo), int(hi), int(m.sum()), med, p75))
        print(f"{lo:>7d}-{hi:<8d} {m.sum():>5d} {med*100:>11.1f}% {p75*100:>9.1f}%")

    # El error depende DÉBILMENTE de la densidad: el único corte fuerte es la
    # zona muy escasa (quintil inferior). Por eso:
    #   - Baja  = densidad por debajo del quintil 20 (error netamente peor).
    #   - Media = entre el quintil 20 y la mediana.
    #   - Alta  = densidad por encima de la mediana (más comparables de respaldo).
    media_min = int(np.quantile(densidad, 0.20))
    alta_min = int(np.quantile(densidad, 0.50))

    def stats(mask):
        return (round(float(np.median(rel_err[mask])), 3),
                round(float(np.percentile(rel_err[mask], 75)), 3),
                int(mask.sum()))

    baja = densidad < media_min
    media = (densidad >= media_min) & (densidad < alta_min)
    alta = densidad >= alta_min

    thresholds = {
        "metodo": "backtest leave-one-out estricto sobre X_test (503 listings); "
                  "excluye sí mismo, coordenadas idénticas y vecinos < 10 m.",
        "metrica": "error relativo |pred-real|/real con geo reconstruido por IDW",
        "hallazgo": "el error depende débilmente de la densidad; el corte fuerte "
                    "es la zona muy escasa. Alta/Media separa por densidad mediana.",
        "alta_min_comparables": alta_min,
        "media_min_comparables": media_min,
        "error_global_mediana": round(float(np.median(rel_err)), 4),
        "verificacion_por_tier": {
            "baja":  {"mediana_err": stats(baja)[0],  "p75_err": stats(baja)[1],  "n": stats(baja)[2]},
            "media": {"mediana_err": stats(media)[0], "p75_err": stats(media)[1], "n": stats(media)[2]},
            "alta":  {"mediana_err": stats(alta)[0],  "p75_err": stats(alta)[1],  "n": stats(alta)[2]},
        },
    }
    out = BACKEND / "confidence_thresholds.json"
    out.write_text(json.dumps(thresholds, indent=2, ensure_ascii=False))
    print(f"\nUmbrales:  Alta ≥ {alta_min} · Media ≥ {media_min} · Baja < {media_min} (o fallback)")
    for tier in ("baja", "media", "alta"):
        v = thresholds["verificacion_por_tier"][tier]
        print(f"  {tier:6s} n={v['n']:3d}  mediana {v['mediana_err']*100:.1f}%  p75 {v['p75_err']*100:.1f}%")
    print(f"Escrito: {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
