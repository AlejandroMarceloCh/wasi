"""FASE 4 — Entrenar XGBoost de precio de VENTA.

Aplica desde el dia 1 la leccion del leakage de alquiler: ademas del split
aleatorio para los artefactos, reporta el MAPE por GroupKFold ESPACIAL
(grupos = celdas de coordenada ~111 m) que es el numero honesto.
Entrada: data/ventas_features.csv. Salida: models/xgb_venta.joblib + RESULTADOS.md.
"""
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import GroupKFold, train_test_split
from xgboost import XGBRegressor

D = Path(__file__).resolve().parent / "data"
M = Path(__file__).resolve().parent / "models"
GEO_INMUEBLE = None  # se llena abajo


def mape(y_true, y_pred):
    return float(np.mean(np.abs((y_true - y_pred) / y_true)) * 100)


def make_xgb():
    return XGBRegressor(
        n_estimators=400, max_depth=5, learning_rate=0.05,
        subsample=0.8, colsample_bytree=0.8, min_child_weight=3,
        random_state=42, n_jobs=4,
    )


def encode_distrito(train_df):
    """Devuelve (mapa, global). El encoding de distrito (media de log-precio/m2)
    SOLO se ajusta con el train que se pasa -> sin leakage del target."""
    lpm2 = np.log1p(train_df["price_usd"] / train_df["m2"])
    return lpm2.groupby(train_df["distrito"]).mean(), lpm2.mean()


def build_X(sub, enc, glob, geo_cols, inmueble):
    """Arma la matriz de features para un subset, aplicando un encoding ya ajustado."""
    X = sub[geo_cols + inmueble].copy()
    X["distrito_enc"] = sub["distrito"].map(enc).fillna(glob)
    return X


def main():
    df = pd.read_csv(D / "ventas_features.csv").reset_index(drop=True)
    geo_cols = [c for c in df.columns if c.startswith(("dist_", "count_", "cantidad_"))]
    inmueble = ["m2", "dormitorios", "banos", "cocheras", "antiguedad_anios"]
    feat_cols = geo_cols + inmueble + ["distrito_enc"]

    y = np.log1p(df["price_usd"].values)          # log-target
    groups = df["coord_cell"].values

    # ---- A) split aleatorio 70/15/15 para el artefacto ----
    idx = np.arange(len(df))
    itr, itmp = train_test_split(idx, test_size=0.30, random_state=42)
    iva, ite = train_test_split(itmp, test_size=0.50, random_state=42)
    enc_a, glob_a = encode_distrito(df.iloc[itr])          # encoding SOLO con train
    Xtr = build_X(df.iloc[itr], enc_a, glob_a, geo_cols, inmueble)
    Xte = build_X(df.iloc[ite], enc_a, glob_a, geo_cols, inmueble)
    m = make_xgb()
    m.fit(Xtr, y[itr])
    yte_usd = np.expm1(y[ite])
    pte = np.expm1(m.predict(Xte))
    mape_rand = mape(yte_usd, pte)
    r2_rand = r2_score(yte_usd, pte)
    mae_rand = mean_absolute_error(yte_usd, pte)

    # ---- B) GroupKFold ESPACIAL (honesto): encoding refit por fold ----
    gkf = GroupKFold(n_splits=5)
    mapes_sp = []
    for tr, te in gkf.split(df, y, groups):
        enc_f, glob_f = encode_distrito(df.iloc[tr])       # sin leakage: solo train del fold
        Xtr_f = build_X(df.iloc[tr], enc_f, glob_f, geo_cols, inmueble)
        Xte_f = build_X(df.iloc[te], enc_f, glob_f, geo_cols, inmueble)
        mf = make_xgb()
        mf.fit(Xtr_f, y[tr])
        pred = np.expm1(mf.predict(Xte_f))
        mapes_sp.append(mape(np.expm1(y[te]), pred))
    mape_sp = float(np.mean(mapes_sp))
    mape_sp_sd = float(np.std(mapes_sp))

    # encoding final (sobre todo) para el artefacto de produccion
    enc, glob = encode_distrito(df)
    X = build_X(df, enc, glob, geo_cols, inmueble)

    # ---- artefacto final (entrena en todo) ----
    final = make_xgb()
    final.fit(X, y)
    M.mkdir(parents=True, exist_ok=True)
    joblib.dump({"model": final, "features": feat_cols, "distrito_enc": enc.to_dict(),
                 "distrito_glob": glob, "log_target": True}, M / "xgb_venta.joblib")

    # ---- reporte ----
    rep = f"""# RESULTADOS — Modelo de precio de VENTA (Wasi v2)

Dataset: InfoCasas (scrapeado 2026-06-06), departamentos en venta de Lima.
Filas: {len(df)} | Features: {len(feat_cols)} ({len(geo_cols)} geo + {len(inmueble)} inmueble + distrito_enc)
Target: precio_venta_usd (log). Modelo: XGBoost (400 arboles, depth 5).

## Metricas

| Validacion | MAPE | R2 | MAE USD |
|---|---|---|---|
| Split aleatorio (test 15%) | {mape_rand:.1f}% | {r2_rand:.3f} | ${mae_rand:,.0f} |
| **GroupKFold espacial (honesto)** | **{mape_sp:.1f}% ± {mape_sp_sd:.1f}** | — | — |

Leakage espacial: el split aleatorio infla la metrica (inmuebles del mismo
edificio caen en train y test). El numero a reportar es el ESPACIAL: {mape_sp:.1f}%.

## Comparacion honesta vs alquiler
- Alquiler: MAPE espacial 16.4% con 3,744 avisos.
- Venta v2: MAPE espacial {mape_sp:.1f}% con {len(df)} avisos.

## Veredicto
{'USABLE como v0/demo de extensibilidad.' if mape_sp < 25 else 'DEBIL: necesita mas datos o features. No usar en produccion aun.'}
El precio de venta es mas disperso que el alquiler (rango $20k-$2M), por lo que
un MAPE algo mayor es esperable. {'El numero es competitivo.' if mape_sp < 20 else 'Margen de mejora con mas avisos y features de tipo/estado.'}
"""
    (Path(__file__).resolve().parent / "RESULTADOS.md").write_text(rep, encoding="utf-8")
    print(f"[train] MAPE aleatorio {mape_rand:.1f}% | MAPE espacial {mape_sp:.1f}% ± {mape_sp_sd:.1f}")
    print(f"[train] R2 {r2_rand:.3f} | MAE ${mae_rand:,.0f} | modelo -> {M/'xgb_venta.joblib'}")
    print(f"[train] RESULTADOS.md escrito")


if __name__ == "__main__":
    main()
