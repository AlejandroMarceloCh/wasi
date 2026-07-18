"""#30 — ¿El factor de smearing de Duan mejora el modelo de alquiler?

El modelo predice E[log(precio)]; al invertir con expm1 (naïve) se subestima la
media condicional por desigualdad de Jensen. El factor de smearing de Duan
(Duan 1983) corrige eso: factor = mean(exp(residuo_log)) sobre el train, y la
predicción corregida es expm1(pred_log) * factor.

Este script MIDE el efecto out-of-sample con GroupKFold espacial (mismo esquema
honesto que la validación del modelo): en cada fold, el factor se estima SOLO con
el train del fold y se evalúa en el test. Reporta MAPE y sesgo mediano con y sin
corrección, para decidir con evidencia si vale aplicarlo al serving.

Corre:
    PYTHONPATH=app/backend app/backend/venv/bin/python scripts_experimento/duan_smearing_alquiler.py
"""
import numpy as np
from sklearn.model_selection import GroupKFold

# Reusa la carga/encoding/modelo del experimento de validación espacial.
from groupkfold_alquiler_v2 import (
    load, encode_distrito_fold, make_model,
)


def metrics(y_log_true, y_usd_pred):
    yt = np.expm1(y_log_true)
    ape = np.abs(yt - y_usd_pred) / yt
    bias = (y_usd_pred - yt) / yt  # >0 = sobreestima
    return {
        "mape_pct": float(np.mean(ape) * 100),
        "medae_pct": float(np.median(ape) * 100),
        "median_bias_pct": float(np.median(bias) * 100),
    }


def main():
    X, y, distrito, cell, df = load()
    gkf = GroupKFold(n_splits=5)

    naive, duan = [], []
    factors = []
    for tr, te in gkf.split(X, y, groups=cell):
        col_tr, col_te = encode_distrito_fold(distrito, y, tr, te)
        Xtr = X.iloc[tr].copy(); Xtr["distrito_enc"] = col_tr
        Xte = X.iloc[te].copy(); Xte["distrito_enc"] = col_te

        m = make_model()
        m.fit(Xtr, y.iloc[tr])

        pred_tr_log = m.predict(Xtr)
        pred_te_log = m.predict(Xte)

        # Factor de Duan estimado SOLO con el train del fold.
        resid_tr = y.iloc[tr].values - pred_tr_log
        factor = float(np.mean(np.exp(resid_tr)))
        factors.append(factor)

        pred_naive = np.expm1(pred_te_log)
        pred_duan = pred_naive * factor

        naive.append(metrics(y.iloc[te].values, pred_naive))
        duan.append(metrics(y.iloc[te].values, pred_duan))

    def avg(rows, k):
        return float(np.mean([r[k] for r in rows]))

    print("=" * 60)
    print(f"Factor de Duan promedio por fold: {np.mean(factors):.4f} "
          f"(rango {min(factors):.4f}–{max(factors):.4f})")
    print(f"  → corrección media de +{(np.mean(factors)-1)*100:.2f}% en el precio")
    print("=" * 60)
    for name, rows in [("expm1 NAÏVE (actual)", naive), ("expm1 × Duan", duan)]:
        print(f"\n{name}")
        print(f"  MAPE:            {avg(rows,'mape_pct'):.2f}%")
        print(f"  MedAE:           {avg(rows,'medae_pct'):.2f}%")
        print(f"  Sesgo mediano:   {avg(rows,'median_bias_pct'):+.2f}%  (0 = insesgado)")
    d_mape = avg(duan, "mape_pct") - avg(naive, "mape_pct")
    d_bias = abs(avg(duan, "median_bias_pct")) - abs(avg(naive, "median_bias_pct"))
    print("\n" + "=" * 60)
    print(f"Δ MAPE (Duan − naïve): {d_mape:+.3f} pts  (negativo = mejora)")
    print(f"Δ |sesgo mediano|:     {d_bias:+.3f} pts  (negativo = menos sesgo)")
    print("VEREDICTO:", "APLICAR" if d_mape < -0.05 else
          ("NEUTRO/DOCUMENTAR" if abs(d_mape) <= 0.05 else "NO APLICAR (empeora)"))
    print("=" * 60)


if __name__ == "__main__":
    main()
