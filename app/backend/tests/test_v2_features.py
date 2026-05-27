"""Tests senior para el pipeline v2: features socioeconómicas, OSM lookup,
distrito features y predicción end-to-end.

Estos tests cubren los componentes nuevos del v2 (no testeados en v1):
  - osm_lookup.OSMIndex (cobertura, counts, distancias)
  - distrito_features.DistritoFeatures (estrato, comisarías, denuncias)
  - distritos_lima_features.attach_features (cobertura de los 40 distritos)
  - ml_v2.build_features_v2 (forma + invariantes)
  - predict_fair_value v2 (sanidad de predicciones por zona)
"""
import os
import sys
import pytest
from pathlib import Path

import pandas as pd

# Garantizar ruta del backend
BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from model_service import USE_V2, model_service


# Skip todos los tests v2 si no está activo
pytestmark = pytest.mark.skipif(
    not USE_V2,
    reason="v2 no activo (DPD_FORCE_V1 o modelo_final_v2.joblib ausente)"
)


@pytest.fixture(scope="module", autouse=True)
def _load_model():
    if not model_service.is_loaded:
        model_service.load()


# ─── osm_lookup ─────────────────────────────────────────────────────────────

def test_osm_lookup_miraflores_centrico():
    """Miraflores céntrico debe tener varios supermercados y bancos en 1km."""
    from osm_lookup import get_osm
    out = get_osm().lookup(-12.1185, -77.0290)
    # Miraflores es zona comercial densa — debe haber al menos 1 supermercado en 1km
    assert out['count_1km_osm_supermercados'] >= 1
    assert out['count_1km_osm_bancos'] >= 3
    assert out['count_1km_osm_farmacias'] >= 5
    # dist_nearest no puede ser negativa
    for k, v in out.items():
        if k.startswith('dist_nearest_'):
            assert v >= 0
        if k.startswith('count_'):
            assert v >= 0 and v == int(v)


def test_osm_lookup_zona_residencial_remota():
    """Punta Hermosa (balneario) debe tener cobertura POI MUCHO más baja."""
    from osm_lookup import get_osm
    out = get_osm().lookup(-12.3340, -76.7900)
    # Punta Hermosa: pocos POIs vs Miraflores
    assert out['count_1km_osm_supermercados'] <= 2
    # El dist_nearest a estación de Metro debe ser GRANDE (no hay Metro al sur)
    assert out['dist_nearest_m_osm_estaciones'] > 5000


def test_osm_lookup_devuelve_33_features():
    """7 cats × 3 metricas (21) + 6 tier (Sprint 3.2) + 6 premium (Sprint 3.6) = 33."""
    from osm_lookup import get_osm, OSM_CATEGORIES, PREMIUM_CATEGORIES
    out = get_osm().lookup(-12.1185, -77.0290)
    for cat in OSM_CATEGORIES:
        assert f'count_500m_osm_{cat}' in out
        assert f'count_1km_osm_{cat}' in out
        assert f'dist_nearest_m_osm_{cat}' in out
    for tname in ('supermercados_premium', 'supermercados_mass',
                  'bancos_premium', 'bancos_mass',
                  'farmacias_cadena', 'farmacias_indep'):
        assert f'count_1km_osm_{tname}' in out
    # Sprint 3.6 — 3 categorias premium (colegios_top, clinicas_premium, restaurantes_premium)
    for cat in PREMIUM_CATEGORIES:
        assert f'count_1km_osm_{cat}' in out
        assert f'dist_nearest_m_osm_{cat}' in out
    assert len(out) == len(OSM_CATEGORIES) * 3 + 6 + len(PREMIUM_CATEGORIES) * 2


# ─── distrito_features ──────────────────────────────────────────────────────

def test_distrito_features_premium_vs_popular():
    """Miraflores debe tener estrato alto, SJL bajo."""
    from distrito_features import get_distrito_features
    df = get_distrito_features()
    mira = df.lookup('Miraflores')
    sjl  = df.lookup('San Juan de Lurigancho')
    assert mira['estrato_nse'] >= 4
    assert sjl['estrato_nse'] <= 2
    assert mira['categoria_distrito'] == 'establecido'
    assert sjl['categoria_distrito'] == 'popular'
    # SJL debe tener MUCHAS más denuncias violentas que Miraflores (es real)
    assert sjl['denuncias_violentas_distrito'] > mira['denuncias_violentas_distrito']


def test_distrito_features_fallback_para_no_existente():
    """Distrito desconocido cae a defaults (estrato=2, popular)."""
    from distrito_features import get_distrito_features
    df = get_distrito_features()
    fake = df.lookup('Distrito Que No Existe XYZ')
    assert fake['estrato_nse'] == 2
    assert fake['categoria_distrito'] == 'popular'


# ─── attach_features (tabla manual cubre dataset) ──────────────────────────

def test_attach_features_cobertura_dataset_real():
    """La tabla manual debe cubrir todos los distritos del dataset (no devolver
    NaN para ningún listing real). Si falla, hay que ampliar la tabla."""
    from distritos_lima_features import attach_features
    csv = BACKEND_DIR.parent.parent / 'pipeline' / 'data' / 'processed' / 'inmuebles_clean_v1.csv'
    if not csv.exists():
        pytest.skip("dataset del pipeline no disponible")
    df = pd.read_csv(csv, usecols=['distrito_oficial'])
    out = attach_features(df, col_distrito='distrito_oficial')
    assert 'estrato_nse' in out.columns
    assert 'categoria_distrito' in out.columns
    assert out['estrato_nse'].notna().all()
    # Como mínimo 3 valores únicos de estrato (1..5) deben aparecer
    assert out['estrato_nse'].nunique() >= 3


# ─── build_features_v2 ─────────────────────────────────────────────────────

def _form(**kw):
    base = dict(lat=-12.121, lng=-77.030, area=85, dormitorios=2, banos=2,
                cocheras=1, antiguedad_anios=6, es_estudio=False,
                amenities=["ascensor", "seguridad"], precio=1200)
    base.update(kw)
    return base


def _geo(lat=-12.121, lng=-77.030):
    from geo_index import geo_lookup
    return geo_lookup(lat, lng)


def test_build_features_v2_shape_y_columnas_clave():
    from ml_v2 import build_features_v2
    X = build_features_v2(_form(), _geo())
    assert X.shape[0] == 1
    assert X.shape[1] == len(model_service.feature_order)
    # Las features nuevas deben estar y tener valores razonables
    for col in ['estrato_nse', 'n_comisarias_distrito',
                'count_1km_osm_supermercados', 'dist_nearest_m_osm_estaciones',
                'denuncias_violentas_distrito']:
        assert col in X.columns, f'{col} ausente del feature_order del modelo cargado'
    # estrato_nse debe ser entero 1-5
    e = float(X['estrato_nse'].iloc[0])
    assert 1 <= e <= 5


def test_build_features_v2_sin_nan_ni_inf():
    """Una predicción nunca debería producir NaN/Inf — eso sí rompe el modelo."""
    import numpy as np
    from ml_v2 import build_features_v2
    X = build_features_v2(_form(), _geo())
    assert not X.isnull().any().any(), 'NaN en features v2'
    assert not np.isinf(X.values).any(), 'Inf en features v2'


# ─── predict_fair_value end-to-end ─────────────────────────────────────────

def test_predict_miraflores_es_zona_cara():
    """Para depto Miraflores 80m² 3 dorm, fair_value debe estar > $800
    (es zona alta del dataset)."""
    from ml import predict_fair_value
    res = predict_fair_value(_form(
        lat=-12.1185, lng=-77.0290, area=80, dormitorios=3,
    ))
    assert res['fair_value'] > 800
    assert res['distrito'] == 'Miraflores'
    assert res['confidence'] == 'Alta'   # Miraflores tiene 134+ comparables


def test_predict_smp_es_zona_barata():
    """SMP 80m² 3 dorm debe predecir < $700."""
    from ml import predict_fair_value
    res = predict_fair_value(_form(
        lat=-12.0080, lng=-77.0570, area=80, dormitorios=3,
    ))
    assert res['fair_value'] < 700
    assert res['distrito'] == 'San Martin de Porres'


def test_predict_low_coverage_marca_confianza_baja():
    """Un punto en zona premium SIN comparables (La Planicie, La Molina)
    debe devolver confidence=Baja y disparar el banner del frontend."""
    from ml import predict_fair_value
    res = predict_fair_value(_form(
        lat=-12.0820, lng=-76.9355, area=80, dormitorios=3, cocheras=2,
    ))
    assert res['distrito'] == 'La Molina'
    assert res['confidence'] == 'Baja'
    assert res['n_comparables'] < 20  # disparador del banner UX


def test_predict_no_lima_lanza_400():
    """Un pin fuera de Lima (ej. Cusco) debe lanzar OutOfBoundsError."""
    from ml import predict_fair_value
    from geo_index import OutOfBoundsError
    with pytest.raises(OutOfBoundsError):
        predict_fair_value(_form(lat=-13.5170, lng=-71.9785))  # Cusco
