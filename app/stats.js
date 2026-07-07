

window.WASI_STATS = {
  ALQ_MAPE: '16.4',          // MAPE alquiler reportado (conservador). Validación espacial
                             // reproducible ~15.7% → docs/RESULTADOS_VALIDACION_ESPACIAL.md
  ALQ_MAPE_RANDOM: '15.7',   // MAPE con split aleatorio (~gap espacial de solo +0.5 pts)
  ALQ_AVISOS: '3,348',       // avisos del set de entrenamiento (no del catálogo live)
  DISTRITOS: '29',           // distritos con cobertura de zona (coincide con el mapa del home)
  VARIABLES: '101',          // features del modelo v2
  VENTA_MAPE: '15.8',        // MAPE venta (GroupKFold espacial)
  VENTA_AVISOS: '6,271',     // avisos de entrenamiento venta
};
