/* Wasi — números oficiales del modelo · única fuente de verdad.
   Los consumen la app (screens-*.jsx) y la landing (landing.html): cambiar un
   número aquí lo cambia en todos lados.

   Procedencia:
   - ALQ_MAPE: MAPE espacial GroupKFold (pipeline/scripts/_audit_spatial_cv.py).
   - ALQ_MAPE_RANDOM: split aleatorio (inflado por cercanía; solo para el FAQ).
   - VENTA_*: ventas_model/RESULTADOS.md.
   - DISTRITOS: tabla districts de la BD. VARIABLES: feature_names_v2.joblib. */
window.WASI_STATS = {
  ALQ_MAPE: '16.4',          // % error medio — validación espacial
  ALQ_MAPE_RANDOM: '15.7',   // % error medio — split aleatorio (inflado)
  ALQ_AVISOS: '3,348',       // avisos de alquiler en el training set servido
  DISTRITOS: '40',           // distritos de Lima con cobertura
  VARIABLES: '101',          // features por inmueble (modelo v2)
  VENTA_MAPE: '15.8',        // % error medio venta — validación espacial
  VENTA_AVISOS: '6,271',     // avisos de venta (InfoCasas + Babilonia)
};
