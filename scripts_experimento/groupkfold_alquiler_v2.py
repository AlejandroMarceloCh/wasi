"""B-full — Validación espacial honesta del modelo de alquiler v2 (reproducible).

A diferencia de B-lite (que usó el split v1 ya hecho), esto reconstruye el dataset
desde el CSV limpio COMMITEADO (`data/inmuebles_alquiler_clean.csv`, 3,348 avisos)
y hace GroupKFold espacial con el **target encoding del distrito REFIT POR FOLD**
(solo con el train de cada fold) — así se elimina el leakage del encoding (T001),
que era el hallazgo "crítico" de la auditoría.

Hiperparámetros al estilo del modelo v2 servido (XGBoost, 489 árboles, depth 11).

Corre:
    PYTHONPATH=app/backend app/backend/venv/bin/python scripts_experimento/groupkfold_alquiler_v2.py
"""
import numpy as np
import pandas as pd
from sklearn.model_selection import GroupKFold, KFold
from xgboost import XGBRegressor

CSV = "data/inmuebles_alquiler_clean.csv"

# Columnas que NO entran como feature numérica.
DROP = {"id_portal", "url", "fuente", "tipo_propiedad", "distrito_oficial",
        "h3_index_8", "mismatch_type", "precision_geocoding", "precio_usd"}


def load():
    df = pd.read_csv(CSV)
    df = df[(df["precio_usd"] > 0) & (df["area_final_m2"] > 0)].reset_index(drop=True)
    y = np.log1p(df["precio_usd"].astype(float))
    distrito = df["distrito_oficial"].fillna("__NA__")
    cell = (df["latitud"].round(3).astype(str) + "_" + df["longitud"].round(3).astype(str))
    feat_cols = [c for c in df.columns if c not in DROP]
    X = df[feat_cols].select_dtypes(include=[np.number]).copy()
    return X, y, distrito, cell, df


def encode_distrito_fold(distrito, y, tr_idx, te_idx, smoothing=20.0):
    """Target encoding bayesiano ajustado SOLO con el train del fold."""
    d_tr = distrito.iloc[tr_idx]; y_tr = y.iloc[tr_idx]
    global_mean = y_tr.mean()
    agg = y_tr.groupby(d_tr).agg(["mean", "count"])
    enc = (agg["count"] * agg["mean"] + smoothing * global_mean) / (agg["count"] + smoothing)
    enc_map = enc.to_dict()
    col_tr = distrito.iloc[tr_idx].map(enc_map).fillna(global_mean).values
    col_te = distrito.iloc[te_idx].map(enc_map).fillna(global_mean).values
    return col_tr, col_te


def make_model():
    return XGBRegressor(
        n_estimators=489, max_depth=11, learning_rate=0.03,
        subsample=0.8, colsample_bytree=0.8, reg_alpha=0.1, reg_lambda=1.0,
        random_state=42, n_jobs=-1,
    )


def mape_real(y_log_true, y_log_pred):
    yt = np.expm1(y_log_true); yp = np.expm1(y_log_pred)
    return float(np.mean(np.abs(yt - yp) / yt) * 100)


def cv_mape(X, y, distrito, splitter, groups=None):
    scores = []
    it = splitter.split(X, y, groups) if groups is not None else splitter.split(X, y)
    for tr, te in it:
        enc_tr, enc_te = encode_distrito_fold(distrito, y, tr, te)  # refit por fold
        Xtr = X.iloc[tr].copy(); Xtr["distrito_enc"] = enc_tr
        Xte = X.iloc[te].copy(); Xte["distrito_enc"] = enc_te
        m = make_model(); m.fit(Xtr, y.iloc[tr])
        scores.append(mape_real(y.iloc[te].values, m.predict(Xte)))
    return np.mean(scores), np.std(scores)


def main():
    X, y, distrito, cell, df = load()
    print(f"Dataset v2-core: {len(X)} avisos, {X.shape[1]} features numéricas + distrito_enc por fold")
    print(f"Celdas espaciales únicas: {cell.nunique()}  (avisos/celda ~{len(X)/cell.nunique():.2f})\n")

    rnd_m, rnd_s = cv_mape(X, y, distrito, KFold(5, shuffle=True, random_state=42))
    sp_m, sp_s = cv_mape(X, y, distrito, GroupKFold(5), groups=cell)
    print("Target encoding REFIT POR FOLD (sin leakage):")
    print(f"  KFold aleatorio  : MAPE {rnd_m:5.2f}% ± {rnd_s:.2f}")
    print(f"  GroupKFold espac.: MAPE {sp_m:5.2f}% ± {sp_s:.2f}")
    print(f"  Gap espacial     : +{sp_m-rnd_m:.2f} puntos")


if __name__ == "__main__":
    main()
