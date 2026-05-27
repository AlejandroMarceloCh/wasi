"""Helper para features socioeconómicas y de seguridad por distrito (v2).

Carga 3 fuentes:
  - Tabla manual `distritos_lima_features.py` → estrato_nse + categoria_distrito
  - CSV `comisarias_por_distrito.csv` → n_comisarias_distrito (CENACOM 2017)
  - CSV `denuncias_lima_clean.csv` → denuncias por tipo (MININTER 2024)

Expone `lookup(distrito_oficial)` que devuelve dict con todas las features.
"""
from __future__ import annotations

import unicodedata
from pathlib import Path
from typing import Dict

import pandas as pd

from distritos_lima_features import attach_features, get_district_table, _norm

_DATA = Path(__file__).resolve().parent / "data" / "external"


class DistritoFeatures:
    """Singleton lazy con joins precomputados por distrito normalizado."""

    def __init__(self):
        nse = get_district_table()                # nombre_norm, estrato_nse, categoria_distrito
        com = pd.read_csv(_DATA / "comisarias_por_distrito.csv")
        com['nombre_norm'] = com['distrito_nombre'].apply(_norm)
        com = com[['nombre_norm', 'n_comisarias']]

        # Denuncias del año más reciente con cobertura completa
        den = pd.read_csv(_DATA / "denuncias_lima_clean.csv")
        anio = 2024 if 2024 in den['ANIO'].unique() else int(den['ANIO'].max())
        den = den[den['ANIO'] == anio].copy()

        def clasificar(mod: str) -> str:
            m = str(mod).strip()
            if any(x in m for x in ['Robo', 'Extorsi', 'Secuestro', 'Violencia']):
                return 'violentas'
            if any(x in m for x in ['Hurto', 'Estafa']):
                return 'patrimoniales'
            return 'otras'

        den['bucket'] = den['P_MODALIDADES'].apply(clasificar)
        den['nombre_norm'] = den['DIST_HECHO'].apply(_norm)
        agg = den.groupby(['nombre_norm', 'bucket'], as_index=False)['cantidad'].sum()
        piv = agg.pivot_table(
            index='nombre_norm', columns='bucket', values='cantidad', fill_value=0
        ).reset_index()
        piv.columns.name = None

        # Join todo en una sola tabla
        table = nse.merge(com, on='nombre_norm', how='left')
        table = table.merge(piv, on='nombre_norm', how='left')
        for col in ['n_comisarias', 'violentas', 'patrimoniales', 'otras']:
            if col in table.columns:
                table[col] = table[col].fillna(0).astype(int)

        # Renombrar a feature names usadas por el modelo
        table = table.rename(columns={
            'n_comisarias':    'n_comisarias_distrito',
            'violentas':       'denuncias_violentas_distrito',
            'patrimoniales':   'denuncias_patrimoniales_distrito',
            'otras':           'denuncias_otras_distrito',
        })

        self._table = table.set_index('nombre_norm').to_dict('index')
        # Promedios globales para fallback de distritos no encontrados
        self._defaults = {
            'estrato_nse': 2,
            'categoria_distrito': 'popular',
            'n_comisarias_distrito': int(com['n_comisarias'].median()),
            'denuncias_violentas_distrito': int(piv.get('violentas', pd.Series([0])).median()),
            'denuncias_patrimoniales_distrito': int(piv.get('patrimoniales', pd.Series([0])).median()),
            'denuncias_otras_distrito': int(piv.get('otras', pd.Series([0])).median()),
        }

    def lookup(self, distrito_oficial: str) -> Dict:
        key = _norm(distrito_oficial)
        return self._table.get(key, self._defaults)


_DF: DistritoFeatures | None = None


def get_distrito_features() -> DistritoFeatures:
    global _DF
    if _DF is None:
        _DF = DistritoFeatures()
    return _DF
