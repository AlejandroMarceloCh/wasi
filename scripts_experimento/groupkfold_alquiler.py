"""B-lite — Validación espacial honesta del modelo de alquiler (experimento).

Reproduce, desde los datos COMMITEADOS (pipeline/data/processed/X_*.csv), la
comparación entre:
  - KFold aleatorio (lo que da el ~16% "optimista")
  - GroupKFold ESPACIAL por celda geográfica (~111 m) — el número honesto

No toca el modelo servido. Solo mide. Corre:
    PYTHONPATH=app/backend app/backend/venv/bin/python scripts_experimento/groupkfold_alquiler.py
"""
import numpy as np
import pandas as pd
from sklearn.model_selection import GroupKFold, KFold
from xgboost import XGBRegressor

BASE = "pipeline/data/processed"


def load_full():
    X = pd.concat([pd.read_csv(f"{BASE}/X_train.csv"),
                   pd.read_csv(f"{BASE}/X_val.csv"),
                   pd.read_csv(f"{BASE}/X_test.csv")], ignore_index=True)
    y = pd.concat([pd.read_csv(f"{BASE}/y_train.csv"),
                   pd.read_csv(f"{BASE}/y_val.csv"),
                   pd.read_csv(f"{BASE}/y_test.csv")], ignore_index=True).iloc[:, 0]
    return X.reset_index(drop=True), y.reset_index(drop=True)


def mape_real(y_log_true, y_log_pred):
    """MAPE en precio REAL (USD), no en log."""
    yt = np.expm1(y_log_true)
    yp = np.expm1(y_log_pred)
    return float(np.mean(np.abs(yt - yp) / yt) * 100)


def make_model():
    return XGBRegressor(
        n_estimators=400, max_depth=8, learning_rate=0.05,
        subsample=0.8, colsample_bytree=0.9, reg_alpha=0.1, reg_lambda=1.0,
        random_state=42, n_jobs=-1,
    )


def cv_mape(X, y, splitter, groups=None):
    scores = []
    it = splitter.split(X, y, groups) if groups is not None else splitter.split(X, y)
    for tr, te in it:
        m = make_model()
        m.fit(X.iloc[tr], y.iloc[tr])
        pred = m.predict(X.iloc[te])
        scores.append(mape_real(y.iloc[te].values, pred))
    return np.mean(scores), np.std(scores)


def main():
    X, y = load_full()
    print(f"Dataset: {X.shape[0]} avisos, {X.shape[1]} features (v1)")

    # Celda espacial ~111 m: agrupa avisos casi en las mismas coordenadas.
    cell = (X["latitud"].round(3).astype(str) + "_" + X["longitud"].round(3).astype(str))
    n_cells = cell.nunique()
    print(f"Celdas espaciales únicas: {n_cells}  (avisos/celda ~{X.shape[0]/n_cells:.2f})\n")

    for drop_enc in (False, True):
        Xu = X.drop(columns=["distrito_enc"]) if drop_enc else X
        tag = "SIN distrito_enc" if drop_enc else "CON distrito_enc"
        rnd_m, rnd_s = cv_mape(Xu, y, KFold(5, shuffle=True, random_state=42))
        sp_m, sp_s = cv_mape(Xu, y, GroupKFold(5), groups=cell)
        print(f"[{tag}]")
        print(f"  KFold aleatorio  : MAPE {rnd_m:5.2f}% ± {rnd_s:.2f}")
        print(f"  GroupKFold espac.: MAPE {sp_m:5.2f}% ± {sp_s:.2f}")
        print(f"  Gap espacial     : +{sp_m-rnd_m:.2f} puntos\n")


if __name__ == "__main__":
    main()
