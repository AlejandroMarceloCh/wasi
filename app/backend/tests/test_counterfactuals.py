"""Tests del contrafactual ligero (Sprint 2.2).

Validan que `compute_counterfactuals` respeta los clamps del schema, descarta
las perturbaciones triviales (sin cambio tras clamp), ordena por |%| desc y
respeta la regla especial de baños cuando es_estudio=False.
"""


def _payload(**kw):
    d = dict(lat=-12.121, lng=-77.030, area=80, dormitorios=2, banos=2,
             es_estudio=False, cocheras=1, antiguedad_anios=10,
             amenities=["ascensor", "seguridad"], precio=1100)
    d.update(kw)
    return d


def test_counterfactuals_presentes_en_predict(client, auth_headers):
    """Happy path: predict devuelve lista no vacía de counterfactuals."""
    r = client.post("/api/fairvalue/predict", headers=auth_headers, json=_payload())
    assert r.status_code == 200
    d = r.json()
    assert isinstance(d["counterfactuals"], list)
    assert 1 <= len(d["counterfactuals"]) <= 5
    for cf in d["counterfactuals"]:
        for k in ("feature", "label", "delta", "new_value", "new_price", "pct_change"):
            assert k in cf
        assert cf["new_price"] > 0
        assert isinstance(cf["pct_change"], (int, float))


def test_counterfactuals_ordenados_por_pct_change_abs_desc(client, auth_headers):
    r = client.post("/api/fairvalue/predict", headers=auth_headers, json=_payload())
    d = r.json()
    cfs = d["counterfactuals"]
    if len(cfs) >= 2:
        magnitudes = [abs(cf["pct_change"]) for cf in cfs]
        assert magnitudes == sorted(magnitudes, reverse=True), \
            f"counterfactuals no están ordenados por |pct| desc: {magnitudes}"


def test_counterfactuals_clamps_banos_sin_estudio(client, auth_headers):
    """Si es_estudio=False, baños=1 no puede perturbarse a 0 (rango [1,20])."""
    r = client.post("/api/fairvalue/predict", headers=auth_headers,
                    json=_payload(banos=1, es_estudio=False))
    assert r.status_code == 200
    cfs = r.json()["counterfactuals"]
    # No debe haber un counterfactual con feature='banos' y delta=-1 que
    # resulte en new_value=0 (estaría fuera del schema)
    banos_neg = [c for c in cfs if c["feature"] == "banos" and c["delta"] < 0]
    for cf in banos_neg:
        assert cf["new_value"] >= 1, f"baños perturbado a {cf['new_value']} con es_estudio=False"


def test_counterfactuals_clamps_area_max(client, auth_headers):
    """area=995 + delta=10 = 1005 debe capearse a 1000 (schema max)."""
    r = client.post("/api/fairvalue/predict", headers=auth_headers, json=_payload(area=995))
    assert r.status_code == 200
    cfs = r.json()["counterfactuals"]
    area_pos = [c for c in cfs if c["feature"] == "area" and c["delta"] > 0]
    for cf in area_pos:
        assert cf["new_value"] <= 1000


def test_counterfactuals_top_5(client, auth_headers):
    """Máximo 5 contrafactuales (top por |pct_change|)."""
    r = client.post("/api/fairvalue/predict", headers=auth_headers, json=_payload())
    assert len(r.json()["counterfactuals"]) <= 5


def test_counterfactuals_pct_change_no_es_cero(client, auth_headers):
    """Si una perturbación queda igual al original tras clamp, no aparece.
    Como mínimo todos los counterfactuals devueltos tienen new_value != original."""
    payload = _payload(area=80, dormitorios=2, banos=2, cocheras=1, antiguedad_anios=10)
    r = client.post("/api/fairvalue/predict", headers=auth_headers, json=payload)
    cfs = r.json()["counterfactuals"]
    original = {
        "area": 80, "dormitorios": 2, "banos": 2, "cocheras": 1, "antiguedad_anios": 10,
    }
    for cf in cfs:
        f = cf["feature"]
        if f in original:
            assert cf["new_value"] != original[f], \
                f"counterfactual {f} con new_value igual al original ({cf['new_value']})"


def test_counterfactuals_dedupe_por_feature(client, auth_headers):
    """Cada feature aparece máximo UNA vez en el top-5 (no '+10 área' y '-10 área' juntos).
    Garantizado por la deduplicación: si ambos signos califican, se queda con el de mayor |%|.
    """
    r = client.post("/api/fairvalue/predict", headers=auth_headers, json=_payload())
    cfs = r.json()["counterfactuals"]
    features = [cf["feature"] for cf in cfs]
    assert len(features) == len(set(features)), \
        f"counterfactuals tienen feature duplicada: {features}"


def test_counterfactuals_label_gramatical(client, auth_headers):
    """Pluralización: 'años de antigüedads' nunca debe aparecer (Q1 fix)."""
    r = client.post("/api/fairvalue/predict", headers=auth_headers, json=_payload())
    cfs = r.json()["counterfactuals"]
    for cf in cfs:
        assert "antigüedads" not in cf["label"], \
            f"label agramatical detectado: {cf['label']!r}"
        assert "dormitorioss" not in cf["label"]
        assert "bañoss" not in cf["label"]
        assert "cocherass" not in cf["label"]


def test_counterfactual_signo_coherente_area(client, auth_headers):
    """+10 m² en un piso de Miraflores DEBE subir el precio (no bajarlo).
    Si el modelo tiene un quirk que invierte el signo, este test lo detecta."""
    r = client.post("/api/fairvalue/predict", headers=auth_headers,
                    json=_payload(area=60))  # área media para evitar clamps
    cfs = r.json()["counterfactuals"]
    area_pos = [c for c in cfs if c["feature"] == "area" and c["delta"] > 0]
    if area_pos:
        # Si está en el top-5, su pct_change debería ser > 0 (más área = más precio)
        # Tolerancia: aceptamos 0 (sin cambio significativo), pero no negativo > -1%.
        assert area_pos[0]["pct_change"] >= -1.0, \
            f"+10 m² bajó el precio {area_pos[0]['pct_change']}% — modelo invertido"
