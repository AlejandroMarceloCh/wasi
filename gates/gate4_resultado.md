# Gate 4 — equivalencia del pipeline  ·  RESULTADO

**Fecha:** 2026-05-21
**Estado:** CERRADO.

## Check A — orden y dtype de las 74 features

Hash SHA-256 del vector canónico (nombre:dtype): `59f69e27dc8f98901b1c4522506887acbe388cdd5ff8afa2107965ce5e2bc121`.
`build_features` produce las columnas exactamente en el orden de
`feature_order.json`. **OK — sin tolerancia.**

## Check B — equivalencia de valores

`build_features` se corrió sobre 20 listings reales (coordenadas
únicas) y se comparó contra su fila de `X_test.csv`. Sobre las
37 features **intrínsecas** (estructurales, geo, derivadas,
`distrito_enc`, log1p) la peor diferencia relativa fue **0.00000%**
(umbral ≤ 0,01 %). **OK.**

Las columnas de amenities fuera de los 8 chips, `amenities_count`,
`area_x_amenities` y las OHE de `fuente`/`mismatch`/`tipo_propiedad` se
excluyen de la comparación exacta: `build_features` les aplica el
comportamiento de producción (form de 8 chips — Gate 3 — y defaults de
submission de usuario), no un error de transformación. El efecto de la
reducción a 8 chips es +2,7 % de diferencia mediana por listing y
−0,06 pp de MAPE agregado (medido en Gate 3).

## Conclusión

La cadena de transformación de `build_features` es **equivalente** al
feature engineering de Leo: log1p sobre las 18 columnas correctas, fórmulas
derivadas exactas, `distrito_enc` por target encoder, geo passthrough — todo
con 0,00000 % de diferencia. Gate 4 cerrado.
