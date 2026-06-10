"""Tests de robustez del pipeline de datos (data quality gate + model gate).

Garantizan que las validaciones que protegen produccion no se rompan en silencio:
si alguien afloja un umbral o rompe un check, estos tests fallan.
"""
import sys
from pathlib import Path

import pandas as pd
import pytest

PIPELINE_DIR = Path(__file__).resolve().parents[3] / "pipeline"
sys.path.insert(0, str(PIPELINE_DIR))

from validation import (validate_training_dataset, validate_scraped,  # noqa: E402
                        DataQualityReport)

DATASET = PIPELINE_DIR / "data" / "processed" / "inmuebles_clean_v1.csv"


@pytest.fixture(scope="module")
def df_real():
    if not DATASET.exists():
        pytest.skip("dataset del pipeline no disponible")
    return pd.read_csv(DATASET)


# ─── el gate PASA con datos buenos ──────────────────────────────────────────

def test_data_gate_pasa_con_dataset_real(df_real):
    r = validate_training_dataset(df_real)
    assert r.ok, r.summary()
    assert len(r.errors) == 0


# ─── el gate DETECTA basura (lo importante: que bloquee de verdad) ───────────

def test_detecta_dataset_truncado(df_real):
    r = validate_training_dataset(df_real.head(500))
    assert not r.ok
    assert any(c.name == "min_filas" for c in r.errors)


def test_detecta_precios_invalidos(df_real):
    d = df_real.copy()
    d.loc[d.index[:1500], "precio_usd"] = 0
    r = validate_training_dataset(d)
    assert not r.ok
    assert any(c.name == "target_valido" for c in r.errors)


def test_detecta_geo_fuera_de_lima(df_real):
    d = df_real.copy()
    d.loc[d.index[:1000], ["latitud", "longitud"]] = 0.0
    r = validate_training_dataset(d)
    assert not r.ok
    assert any(c.name == "geo_en_lima" for c in r.errors)


def test_detecta_schema_roto(df_real):
    r = validate_training_dataset(df_real.drop(columns=["precio_usd"]))
    assert not r.ok
    assert any(c.name == "schema" for c in r.errors)


# ─── validacion de datos scrapeados ─────────────────────────────────────────

def test_scraped_vacio_falla():
    r = validate_scraped(pd.DataFrame(), "nexo")
    assert not r.ok


def test_scraped_con_precios_validos_pasa():
    df = pd.DataFrame({"precio_usd": [500, 800, 1200, 0]})
    r = validate_scraped(df, "adondevivir")
    assert r.ok   # 75% validos >= 50%


# ─── contrato del reporte ───────────────────────────────────────────────────

def test_report_warnings_no_bloquean():
    r = DataQualityReport()
    r.add("algo", False, "warning de prueba", severity="WARNING")
    assert r.ok                       # warnings no bloquean
    assert len(r.warnings) == 1
