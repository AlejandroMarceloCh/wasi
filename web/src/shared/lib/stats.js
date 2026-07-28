// Números públicos del producto. Los del modelo de alquiler salen de
// GroupKFold espacial reproducible (scripts/train_model_v2.py →
// data/processed/v2/metricas_v2.json). Al cambiarlos acá se propagan a toda
// la home: no hardcodear métricas en las pantallas.
export const WASI_STATS = {
  ALQ_MAPE: '16.2',
  ALQ_MAPE_RANDOM: '15.5',
  ALQ_AVISOS: '3,348',
  DISTRITOS: '29',
  VARIABLES: '101',
  VENTA_MAPE: '15.8',
  VENTA_AVISOS: '6,271',
};
