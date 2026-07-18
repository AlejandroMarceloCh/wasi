"""Benchmark PAREADO para decidir si agregar una fuente al modelo de venta.

Gate de la auditoría Babilonia (docs/AUDITORIA_DECISION_BABILONIA.md §9-bis). El
error que motivó esto: comparar el MAPE global con y sin una fuente nueva mezcla
DOS efectos —composición de la población de test y calidad del modelo—. Si la
fuente nueva es más difícil, el MAPE global sube aunque el modelo no empeore.

La prueba correcta es PAREADA: se fija un conjunto de test de la fuente base
(InfoCasas) y se comparan dos entrenamientos evaluados sobre EXACTAMENTE las
mismas filas de test:
  A) solo InfoCasas
  B) InfoCasas + fuente nueva (excluyendo del train las filas de la fuente nueva
     que caigan en una celda del fold de test, para no filtrar por vecindad).

Usa `fuente` propagada en clean_ventas.csv (provenance), no matching frágil.

Correr:
    PYTHONPATH=src app/backend/venv/bin/python scripts_experimento/paired_benchmark_venta.py [fuente_nueva]
    (fuente_nueva por defecto: 'babilonia')
"""
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.model_selection import GroupKFold

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "ventas_model"))
from train_venta import make_xgb, encode_distrito, build_X  # noqa: E402

from wasi.features.geo_index import IDW_COLS, geo_lookup  # noqa: E402

CLEAN = Path(__file__).resolve().parent.parent / "ventas_model" / "data" / "clean_ventas.csv"
INMUEBLE = ["m2", "dormitorios", "banos", "cocheras", "antiguedad_anios"]


def build_features(df: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for _, r in df.iterrows():
        try:
            geo = geo_lookup(float(r["lat"]), float(r["lng"]))
        except Exception:
            continue
        feat = {c: geo[c] for c in IDW_COLS}
        feat["distrito"] = geo.get("distrito") or geo.get("distrito_oficial") or r.get("distrito", "")
        for c in INMUEBLE:
            v = r[c]
            feat[c] = df[c].median() if pd.isna(v) else v
        feat["price_usd"] = r["price_usd"]
        feat["fuente"] = (r.get("fuente") or "infocasas")
        feat["coord_cell"] = f"{round(float(r['lat']),3)}_{round(float(r['lng']),3)}"
        rows.append(feat)
    return pd.DataFrame(rows)


def mape(y_true_usd, y_pred_usd):
    return float(np.mean(np.abs(y_true_usd - y_pred_usd) / y_true_usd) * 100)


def main():
    nueva = sys.argv[1] if len(sys.argv) > 1 else "babilonia"
    df = build_features(pd.read_csv(CLEAN))
    geo_cols = [c for c in df.columns if c.startswith(("dist_", "count_", "cantidad_"))]

    is_new = (df["fuente"] == nueva).values
    base = df[~is_new].reset_index(drop=True)
    print(f"Base (InfoCasas): {len(base)} | Fuente nueva ('{nueva}'): {int(is_new.sum())}")

    y_base = np.log1p(base["price_usd"].values)
    gkf = GroupKFold(n_splits=5)
    rows_a, rows_b, deltas, ns = [], [], [], []
    for k, (tr, te) in enumerate(gkf.split(base, y_base, base["coord_cell"].values), 1):
        test_cells = set(base.iloc[te]["coord_cell"])
        # A) solo InfoCasas
        enc_a, glob_a = encode_distrito(base.iloc[tr])
        Xtr_a = build_X(base.iloc[tr], enc_a, glob_a, geo_cols, INMUEBLE)
        Xte = build_X(base.iloc[te], enc_a, glob_a, geo_cols, INMUEBLE)
        ma = make_xgb(); ma.fit(Xtr_a, y_base[tr])
        pred_a = np.expm1(ma.predict(Xte))
        # B) InfoCasas train + fuente nueva (sin filas de la nueva en celdas de test)
        new_ok = df[is_new & ~df["coord_cell"].isin(test_cells)]
        train_b = pd.concat([base.iloc[tr], new_ok], ignore_index=True)
        enc_b, glob_b = encode_distrito(train_b)
        Xtr_b = build_X(train_b, enc_b, glob_b, geo_cols, INMUEBLE)
        Xte_b = build_X(base.iloc[te], enc_b, glob_b, geo_cols, INMUEBLE)
        mb = make_xgb(); mb.fit(Xtr_b, np.log1p(train_b["price_usd"].values))
        pred_b = np.expm1(mb.predict(Xte_b))

        real = base.iloc[te]["price_usd"].values
        a, b = mape(real, pred_a), mape(real, pred_b)
        rows_a.append(a); rows_b.append(b); deltas.append(b - a); ns.append(len(te))
        print(f"  fold {k}: n_test={len(te):5d}  soloInfo={a:.3f}%  +{nueva}={b:.3f}%  Δ={b-a:+.3f} pp")

    w = np.array(ns)
    wa = float(np.average(rows_a, weights=w)); wb = float(np.average(rows_b, weights=w))
    print("=" * 60)
    print(f"PONDERADO (mismas filas test InfoCasas, n={w.sum()}):")
    print(f"  solo InfoCasas: {wa:.3f}%   + {nueva}: {wb:.3f}%   Δ pareado: {wb-wa:+.3f} pp")
    verdict = ("NULO — agregar la fuente no cambia la calidad sobre InfoCasas"
               if abs(wb - wa) <= 0.05 else
               ("MEJORA" if wb < wa else "EMPEORA"))
    print(f"  VEREDICTO: {verdict}")
    print("=" * 60)
    print("Nota: el MAPE GLOBAL con la fuente incluida NO es comparable con el de")
    print("solo-InfoCasas (poblaciones de test distintas). Esta es la comparación válida.")


if __name__ == "__main__":
    main()
