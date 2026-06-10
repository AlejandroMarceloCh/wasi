# RESULTADOS — Modelo de precio de VENTA (Wasi v2)

Dataset: InfoCasas (scrapeado 2026-06-06), departamentos en venta de Lima.
Filas: 6271 | Features: 22 (16 geo + 5 inmueble + distrito_enc)
Target: precio_venta_usd (log). Modelo: XGBoost (400 arboles, depth 5).

## Metricas

| Validacion | MAPE | R2 | MAE USD |
|---|---|---|---|
| Split aleatorio (test 15%) | 14.8% | 0.856 | $43,234 |
| **GroupKFold espacial (honesto)** | **15.8% ± 0.7** | — | — |

Leakage espacial: el split aleatorio infla la metrica (inmuebles del mismo
edificio caen en train y test). El numero a reportar es el ESPACIAL: 15.8%.

## Comparacion honesta vs alquiler
- Alquiler: MAPE espacial 16.4% con 3,744 avisos.
- Venta v2: MAPE espacial 15.8% con 6271 avisos.

## Veredicto
USABLE como v0/demo de extensibilidad.
El precio de venta es mas disperso que el alquiler (rango $20k-$2M), por lo que
un MAPE algo mayor es esperable. El numero es competitivo.
