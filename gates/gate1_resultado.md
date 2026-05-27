# Gate 1 — outlier_caps  ·  RESULTADO

**Fecha:** 2026-05-20
**Decisión:** `outlier_caps` se **EXCLUYE** del pipeline de inferencia.
**Estado:** CERRADO.

---

## Pregunta del gate

¿En qué punto del pipeline se aplica `outlier_caps.joblib` y cómo se replica
1:1 en inferencia? O bien: ¿se excluye, con justificación y revalidación?

## Contenido del artefacto

`outlier_caps.joblib` es un `dict` de 8 columnas → cap superior único
(valores en espacio crudo, pre-log1p):

| columna | cap superior |
|---|---|
| banos | 4.0 |
| dormitorios | 4.0 |
| cocheras | 3.0 |
| antiguedad_anios | 41.57 |
| area_final_m2 | 361.57 |
| area_por_dormitorio | 111.43 |
| amenities_count | 24.0 |
| cantidad_denuncias | 470.0 |

## Evidencia — el artefacto nunca se aplicó a los datos de modelado

Se revirtió el `log1p` donde aplica y se midió el máximo real en los splits
sobre los que el RF se entrenó y evaluó:

| columna | cap | train_max | test_max | ¿capeado? |
|---|---|---|---|---|
| banos | 4.0 | 8.0 | 8.0 | **NO** |
| dormitorios | 4.0 | 10.0 | 19.0 | **NO** |
| cocheras | 3.0 | 4.0 | 4.0 | **NO** |
| antiguedad_anios | 41.57 | 73.0 | 84.0 | **NO** |
| area_final_m2 | 361.57 | 1180.0 | 582.0 | **NO** |
| area_por_dormitorio | 111.43 | 295.0 | 160.0 | **NO** |
| amenities_count | 24.0 | 31.0 | 28.0 | **NO** |
| cantidad_denuncias | 470.0 | 1640.0 | 1640.0 | **NO** |

Las 8 columnas tienen valores que superan su cap en `X_train.csv` y
`X_test.csv` → los caps **nunca se aplicaron** a los datos de modelado.

Refuerzo desde el código: los notebooks `01_limpieza` y `03_feature_engineering`
**no contienen** ningún `joblib.dump` de `outlier_caps` ni ninguna llamada
`.clip()` que aplique estos caps. El artefacto fue producido por código que
ya no está en los notebooks activos (consistente con el estado inconsistente
ya documentado del repo de Leo).

## Conclusión

El RF (`04_random_forest.joblib`) se entrenó y se evaluó sobre features
**sin capear**. Sus métricas publicadas (MAPE 15,9 %, MAE $173, R² 0,785)
son ya las métricas "sin caps".

Aplicar `outlier_caps` en inferencia introduciría **train-serving skew**:
el modelo vería en producción una distribución distinta a la de entrenamiento.

**Acción:** `build_features` (Fase 2) NO aplica `outlier_caps`. El artefacto
se conserva en `models/` solo como referencia histórica. La validación de
rangos de entrada se hace en el contrato API (HTTP 422), que es una decisión
de producto independiente, no una réplica de este artefacto.

**Revalidación de métricas:** no se requiere — las métricas vigentes ya
corresponden al pipeline sin caps.
