"""Entrenamiento y validación reproducibles del modelo de alquiler v2.

Fuente única de verdad del esquema v2: mide qué rinde de verdad el modelo de
101 features con validación espacial honesta, y opcionalmente produce un
artefacto candidato.

## Qué hace distinto a lo que había

Todo lo que se ajusta con datos se ajusta **dentro de cada fold**, nunca sobre
el dataset completo:

- **Target encoding del distrito** — bayesiano con smoothing, refit por fold.
- **Imputación de estructurales** (`cocheras`, `antiguedad_anios`, …) — mediana
  agrupada por tipo de propiedad, calculada solo con el train del fold.
- **Imputación de distancias** (`dist_nearest_m_*`) — percentil 95 del train del
  fold, que es la regla que el README declara.
- **Amenities no reportadas** — a 0, porque el NaN ahí significa "la fuente no
  publica amenities", no "dato perdido". Es la deuda #29 (MNAR) documentada: se
  replica el criterio del training original en vez de cambiarlo por la puerta de
  atrás, porque cambiarlo sin reentrenar el servido crearía train/serve skew.

Los hiperparámetros son los que trae embebidos el artefacto servido, leídos de
él directamente, para que la comparación sea contra el mismo modelo y no contra
uno parecido.

Uso:
    # Solo medir (no toca ningún artefacto):
    app/backend/venv/bin/python scripts/train_model_v2.py

    # Medir y además dejar un artefacto candidato en models/v2/candidato/:
    app/backend/venv/bin/python scripts/train_model_v2.py --fit-final

El artefacto servido NUNCA se sobrescribe: `--fit-final` escribe en un
subdirectorio aparte y la promoción es una decisión manual.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import GroupKFold, KFold
from xgboost import XGBRegressor

ROOT = Path(__file__).resolve().parent.parent
DATASET = ROOT / "data" / "processed" / "v2" / "dataset_v2.csv"
MODELO_SERVIDO = ROOT / "models" / "v2" / "modelo_final_v2.joblib"
OUT_DIR = ROOT / "models" / "v2" / "candidato"
REPORTE = ROOT / "data" / "processed" / "v2" / "metricas_v2.json"

SMOOTHING = 20.0
N_FOLDS = 5


def cargar():
    df = pd.read_csv(DATASET)
    y = df.pop("__y_log").astype(float)
    distrito = df.pop("__distrito").astype(str)
    celda = df.pop("__celda").astype(str)
    precio = df.pop("__precio_usd").astype(float)
    return df, y, distrito, celda, precio


def hiperparametros_del_artefacto() -> dict:
    """Lee los hiperparámetros del modelo que hoy se sirve.

    Así la validación mide el mismo modelo que corre en producción, en vez de
    uno "parecido" elegido a ojo.
    """
    bundle = joblib.load(MODELO_SERVIDO)
    p = bundle["modelo"].get_params()
    return {
        "n_estimators": int(p["n_estimators"]),
        "max_depth": int(p["max_depth"]),
        "learning_rate": float(p["learning_rate"]),
        "subsample": float(p["subsample"]),
        "colsample_bytree": float(p["colsample_bytree"]),
        "reg_alpha": float(p["reg_alpha"]),
        "reg_lambda": float(p["reg_lambda"]),
        "random_state": 42,
        "objective": "reg:squarederror",
    }


def imputar_por_fold(X: pd.DataFrame, tr_idx, te_idx) -> tuple:
    """Imputa NaN usando solo estadísticos del train del fold.

    Devuelve (X_train, X_test) ya imputados. Nada se calcula con filas de test.
    """
    Xtr = X.iloc[tr_idx].copy()
    Xte = X.iloc[te_idx].copy()

    cols_nan = [c for c in X.columns if X[c].isna().any()]

    amenities = [c for c in cols_nan if c.startswith("tiene_")]
    distancias = [c for c in cols_nan if c.startswith("dist_nearest_m")]
    estructurales = [c for c in cols_nan
                     if c not in amenities and c not in distancias]

    # Amenities: NaN = la fuente no publica amenities = ausencia.
    for c in amenities:
        Xtr[c] = Xtr[c].fillna(0.0)
        Xte[c] = Xte[c].fillna(0.0)

    # Distancias: p95 del train (un POI "muy lejos", no cero).
    for c in distancias:
        p95 = Xtr[c].quantile(0.95)
        if np.isnan(p95):
            p95 = 0.0
        Xtr[c] = Xtr[c].fillna(p95)
        Xte[c] = Xte[c].fillna(p95)

    # Estructurales: mediana agrupada por tipo de propiedad (departamento vs
    # resto), calculada en train. Si el grupo no tiene dato, cae a la mediana
    # global del train.
    grupo_col = "tipo_propiedad_Departamento"
    for c in estructurales:
        if grupo_col in Xtr.columns:
            medianas = Xtr.groupby(grupo_col)[c].median()
            global_med = Xtr[c].median()
            if np.isnan(global_med):
                global_med = 0.0
            for frame in (Xtr, Xte):
                rellena = frame[grupo_col].map(medianas).astype(float)
                frame[c] = frame[c].fillna(rellena).fillna(global_med)
        else:
            med = Xtr[c].median()
            Xtr[c] = Xtr[c].fillna(med)
            Xte[c] = Xte[c].fillna(med)

    return Xtr, Xte


def encoding_por_fold(distrito: pd.Series, y: pd.Series, tr_idx, te_idx):
    """Target encoding bayesiano del distrito, ajustado solo con el train."""
    d_tr, y_tr = distrito.iloc[tr_idx], y.iloc[tr_idx]
    global_mean = y_tr.mean()
    agg = y_tr.groupby(d_tr).agg(["mean", "count"])
    enc = ((agg["count"] * agg["mean"] + SMOOTHING * global_mean)
           / (agg["count"] + SMOOTHING)).to_dict()
    col_tr = distrito.iloc[tr_idx].map(enc).fillna(global_mean).values
    col_te = distrito.iloc[te_idx].map(enc).fillna(global_mean).values
    return col_tr, col_te


def metricas(y_log_true, y_log_pred) -> dict:
    """Métricas en dólares reales (revierte el log del target)."""
    yt, yp = np.expm1(y_log_true), np.expm1(y_log_pred)
    err = yt - yp
    ss_res = float(np.sum(err ** 2))
    ss_tot = float(np.sum((yt - yt.mean()) ** 2))
    return {
        "mape_pct": float(np.mean(np.abs(err) / yt) * 100),
        "mae_usd": float(np.mean(np.abs(err))),
        "rmse_usd": float(np.sqrt(np.mean(err ** 2))),
        "r2": float(1 - ss_res / ss_tot),
    }


def validar(X, y, distrito, splitter, groups, hiper, etiqueta: str) -> dict:
    por_fold, y_true_all, y_pred_all = [], [], []
    it = (splitter.split(X, y, groups) if groups is not None
          else splitter.split(X, y))

    for i, (tr, te) in enumerate(it, 1):
        Xtr, Xte = imputar_por_fold(X, tr, te)
        enc_tr, enc_te = encoding_por_fold(distrito, y, tr, te)
        Xtr["distrito_enc"], Xte["distrito_enc"] = enc_tr, enc_te

        modelo = XGBRegressor(**hiper, n_jobs=-1)
        modelo.fit(Xtr, y.iloc[tr])
        pred = modelo.predict(Xte)

        m = metricas(y.iloc[te].values, pred)
        por_fold.append(m)
        y_true_all.append(y.iloc[te].values)
        y_pred_all.append(pred)
        print(f"    fold {i}/{N_FOLDS}: MAPE {m['mape_pct']:5.2f}%  "
              f"MAE ${m['mae_usd']:6.1f}  R² {m['r2']:.3f}")

    agregado = metricas(np.concatenate(y_true_all), np.concatenate(y_pred_all))
    resumen = {
        "esquema": etiqueta,
        "mape_pct": float(np.mean([m["mape_pct"] for m in por_fold])),
        "mape_std": float(np.std([m["mape_pct"] for m in por_fold])),
        "mae_usd": float(np.mean([m["mae_usd"] for m in por_fold])),
        "rmse_usd": float(np.mean([m["rmse_usd"] for m in por_fold])),
        "r2_pooled": agregado["r2"],
        "por_fold": por_fold,
    }
    print(f"  → {etiqueta}: MAPE {resumen['mape_pct']:.2f}% "
          f"± {resumen['mape_std']:.2f} · MAE ${resumen['mae_usd']:.0f} · "
          f"R² {resumen['r2_pooled']:.3f}\n")
    return resumen


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--fit-final", action="store_true",
                    help="además entrena sobre todo el dataset y guarda un "
                         "artefacto CANDIDATO (no toca el servido)")
    args = ap.parse_args()

    if not DATASET.exists():
        print(f"ERROR: falta {DATASET}. Corré antes build_dataset_v2.py")
        return 1

    X, y, distrito, celda, _ = cargar()
    hiper = hiperparametros_del_artefacto()
    print(f"Dataset v2: {len(X)} avisos × {X.shape[1]} features "
          f"(+distrito_enc por fold)")
    print(f"Celdas espaciales: {celda.nunique()} "
          f"(~{len(X)/celda.nunique():.2f} avisos/celda)")
    print(f"Hiperparámetros: los del artefacto servido "
          f"(n_est={hiper['n_estimators']}, depth={hiper['max_depth']}, "
          f"lr={hiper['learning_rate']})\n")

    print("GroupKFold espacial (el número honesto):")
    espacial = validar(X, y, distrito, GroupKFold(N_FOLDS), celda, hiper,
                       "GroupKFold espacial")

    print("KFold aleatorio (referencia optimista, para medir el gap):")
    aleatorio = validar(X, y, distrito, KFold(N_FOLDS, shuffle=True,
                                              random_state=42), None, hiper,
                        "KFold aleatorio")

    gap = espacial["mape_pct"] - aleatorio["mape_pct"]
    print(f"Gap espacial: +{gap:.2f} puntos de MAPE")

    reporte = {
        "dataset": str(DATASET.relative_to(ROOT)),
        "n_avisos": int(len(X)),
        "n_features": int(X.shape[1]) + 1,
        "hiperparametros": hiper,
        "validacion_espacial": espacial,
        "validacion_aleatoria": aleatorio,
        "gap_espacial_pts": float(gap),
        "nota": ("Encoding y toda imputación se ajustan por fold, solo con el "
                 "train de cada uno. Sin fuga del target ni de estadísticos."),
    }

    if args.fit_final:
        print("\nEntrenando artefacto candidato sobre el dataset completo…")
        Xf, _ = imputar_por_fold(X, np.arange(len(X)), np.arange(len(X)))
        global_mean = y.mean()
        agg = y.groupby(distrito).agg(["mean", "count"])
        enc = ((agg["count"] * agg["mean"] + SMOOTHING * global_mean)
               / (agg["count"] + SMOOTHING)).to_dict()
        Xf["distrito_enc"] = distrito.map(enc).fillna(global_mean).values

        modelo = XGBRegressor(**hiper, n_jobs=-1)
        modelo.fit(Xf, y)

        OUT_DIR.mkdir(parents=True, exist_ok=True)
        joblib.dump({"modelo": modelo, "nombre": "XGBoost"},
                    OUT_DIR / "modelo_final_v2.joblib")
        joblib.dump(np.array(list(Xf.columns)), OUT_DIR / "feature_names_v2.joblib")
        joblib.dump({"map": pd.Series(enc), "global_mean": float(global_mean)},
                    OUT_DIR / "target_enc_distrito_v2.joblib")
        reporte["artefacto_candidato"] = str(OUT_DIR.relative_to(ROOT))
        print(f"  Candidato en {OUT_DIR.relative_to(ROOT)} "
              f"({len(Xf.columns)} features). El servido NO se tocó.")

    REPORTE.write_text(json.dumps(reporte, indent=2, ensure_ascii=False))
    print(f"\nReporte: {REPORTE.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
