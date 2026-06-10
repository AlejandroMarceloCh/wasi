"""FASE 2 — Limpieza de los avisos de venta scrapeados.

Filtra outliers y avisos mal categorizados (alquiler colado, errores de precio)
usando precio/m2 como criterio de cordura. Entrada: data/raw_infocasas.csv.
Salida: data/clean_ventas.csv.
"""
from pathlib import Path

import pandas as pd

D = Path(__file__).resolve().parent / "data"


def main():
    frames = [pd.read_csv(D / "raw_infocasas.csv")]
    bab = D / "raw_babilonia.csv"
    if bab.exists():
        frames.append(pd.read_csv(bab))
    df = pd.concat(frames, ignore_index=True)
    # calcular precio_m2 si falta (Babilonia no lo trae)
    if "precio_m2" not in df.columns:
        df["precio_m2"] = df["price_usd"] / df["m2"]
    else:
        mask = df["precio_m2"].isna() | (df["precio_m2"] == 0)
        df.loc[mask, "precio_m2"] = df.loc[mask, "price_usd"] / df.loc[mask, "m2"]
    n0 = len(df)

    # property_type: solo departamentos (homogeneidad, como hizo alquiler)
    df = df[df["property_type"].fillna("").isin(["Departamento", ""])]
    # rangos de venta razonables
    df = df[df["price_usd"].between(20_000, 2_000_000)]
    df = df[df["m2"].between(20, 600)]
    df = df[df["precio_m2"].between(400, 6_000)]   # filtra alquiler colado y errores
    df = df[df["dormitorios"].between(0, 6)]
    df = df[df["banos"].between(1, 6)]
    df = df[df["cocheras"].between(0, 6)]
    # bbox de Lima
    df = df[df["lat"].between(-12.5, -11.6) & df["lng"].between(-77.3, -76.7)]
    # dedup por inmueble (misma coord/area/precio)
    df = df.drop_duplicates(subset=["lat", "lng", "m2", "price_usd"])

    df.to_csv(D / "clean_ventas.csv", index=False)
    import statistics as st
    ppm2 = df["precio_m2"].tolist()
    print(f"[clean] {n0} -> {len(df)} filas ({len(df)/n0*100:.0f}% sobrevive)")
    print(f"[clean] precio/m2: mediana ${st.median(ppm2):,.0f} | "
          f"precio: mediana ${st.median(df['price_usd']):,.0f}")
    print(f"[clean] distritos: {df['distrito'].replace('', 'N/A').nunique()} distintos")


if __name__ == "__main__":
    main()
