"""Tests del entorno nombrado para la narrativa LLM.

Cubre osm_lookup.nearest_named (POIs por nombre + tier) y el helper
_poi_highlights del router. Deterministas: NO llaman a Groq ni a la red,
solo a los KD-trees ya cargados sobre los JSON de OSM del repo.
"""
from wasi.features.osm_lookup import get_osm

# San Isidro, zona financiera (Camino Real / Pardo y Aliaga): bancos de gama alta.
SAN_ISIDRO = (-12.0967, -77.0365)
# Miraflores (Parque Kennedy): farmacias de cadena y restaurantes premium.
MIRAFLORES = (-12.1216, -77.0294)


def test_nearest_named_devuelve_nombres_distancias_y_tier_valido():
    r = get_osm().nearest_named(*MIRAFLORES, per_cat=2, max_m=1200)
    assert r, "debe encontrar POIs nombrados en Miraflores"
    for items in r.values():
        for it in items:
            assert it["name"], "cada POI debe tener nombre no vacío"
            assert 0 <= it["dist_m"] <= 1200
            assert it["tier"] in (None, "premium", "mass", "cadena", "indep")


def test_nearest_named_clasifica_banco_premium_en_san_isidro():
    """La diferenciación de gama (lo que pidió el producto) debe verse en bancos."""
    r = get_osm().nearest_named(*SAN_ISIDRO, per_cat=3, max_m=1500)
    tiers = {b["tier"] for b in r.get("bancos", [])}
    assert "premium" in tiers, "San Isidro financiero debe tener un banco de gama alta"


def test_nearest_named_farmacias_marca_cadena():
    r = get_osm().nearest_named(*MIRAFLORES, per_cat=3, max_m=1200)
    farmacias = r.get("farmacias", [])
    assert farmacias, "debe haber farmacias cerca del Parque Kennedy"
    assert any(f["tier"] == "cadena" for f in farmacias)


def test_nearest_named_respeta_radio_maximo():
    r = get_osm().nearest_named(*MIRAFLORES, per_cat=5, max_m=300)
    for items in r.values():
        for it in items:
            assert it["dist_m"] <= 300


def test_poi_highlights_mapea_labels_traduce_tier_y_ordena():
    from routers.fairvalue import _poi_highlights
    hl = _poi_highlights(*SAN_ISIDRO)
    assert hl, "debe devolver highlights"
    # Ordenados por distancia ascendente.
    dists = [h.dist_m for h in hl]
    assert dists == sorted(dists)
    # Labels legibles, no las claves crudas de categoría.
    kinds = {h.kind for h in hl}
    assert "bancos" not in kinds and "supermercados" not in kinds
    assert "Banco" in kinds or "Supermercado" in kinds
    # Tier traducido a etiqueta en español (o None).
    for h in hl:
        assert h.tier in (None, "gama alta", "gama masiva", "cadena", "independiente")


def test_poi_highlights_falla_suave_fuera_de_cobertura():
    """Un punto en medio del océano no rompe: devuelve lista vacía."""
    from routers.fairvalue import _poi_highlights
    assert _poi_highlights(-40.0, -120.0) == []
