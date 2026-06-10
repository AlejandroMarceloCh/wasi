"""Baja POIs limpios de OpenStreetMap (Overpass) SOLO para el display de Entorno.

Estos archivos NO entran al modelo. El modelo sigue usando data/external/*.json
(congelado para evitar desajuste train/serve). Estos van a data/external/display/
y los consume display_pois.py para mostrar conteos reales (sin el cap de 60 del
geo_index) y separar supermercados de tiendas de conveniencia.

OSM ya distingue por su propio tag:
  - shop=supermarket   -> supermercados reales (Plaza Vea, Tottus, Metro, Wong...)
  - shop=convenience   -> tiendas de conveniencia (Tambo, Mass, Oxxo, Listo...)

Uso:  ./venv/bin/python scripts/fetch_display_pois.py
"""
from __future__ import annotations

import json
import time
from pathlib import Path

import requests

OUT_DIR = Path(__file__).resolve().parent.parent / "data" / "external" / "display"
OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# bbox Lima Metropolitana (south, west, north, east) — igual que geo_index.
BBOX = "-12.5,-77.2,-11.7,-76.7"

# categoria -> filtro Overpass (sobre nodes, ways y relations)
CATEGORIES = {
    "supermercados": '["shop"="supermarket"]',
    "conveniencia":  '["shop"="convenience"]',
    "colegios":      '["amenity"="school"]',
    "hospitales":    '["amenity"="hospital"]',
    "parqueos":      '["amenity"="parking"]',
}

HEADERS = {"User-Agent": "WasiDataProduct/1.0 (proyecto academico UTEC)"}


def fetch(cat: str, filtro: str) -> dict:
    query = (
        f"[out:json][timeout:90];"
        f"(nwr{filtro}({BBOX}););"
        f"out center;"
    )
    for intento in range(1, 4):
        try:
            r = requests.post(OVERPASS_URL, data={"data": query}, headers=HEADERS, timeout=120)
            if r.status_code == 200:
                return r.json()
            print(f"  [{cat}] HTTP {r.status_code} (intento {intento}) — reintento en 20s")
        except requests.RequestException as e:
            print(f"  [{cat}] error de red (intento {intento}): {e}")
        time.sleep(20)
    raise RuntimeError(f"Overpass falló para {cat} tras 3 intentos")


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for cat, filtro in CATEGORIES.items():
        print(f"[overpass] bajando {cat} {filtro} ...")
        data = fetch(cat, filtro)
        n = len(data.get("elements", []))
        out = OUT_DIR / f"{cat}.json"
        out.write_text(json.dumps(data, ensure_ascii=False))
        print(f"  -> {n} POIs guardados en {out.relative_to(OUT_DIR.parent.parent.parent)}")
        time.sleep(3)  # cortesía con el servidor público de Overpass
    print("listo.")


if __name__ == "__main__":
    main()
