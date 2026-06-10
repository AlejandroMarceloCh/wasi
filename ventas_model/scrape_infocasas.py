"""FASE 1 — Scraper de avisos de VENTA de departamentos en Lima desde InfoCasas.

Lee el JSON embebido (__NEXT_DATA__ -> fetchResult.searchFast.data[]) de cada
pagina de listado. Sin anti-bot (verificado 2026-06-06). Rate-limiting cortes.

Uso:  ./venv/bin/python ventas_model/scrape_infocasas.py [n_paginas]
Salida: ventas_model/data/raw_infocasas.csv
"""
import csv
import json
import re
import sys
import time
import urllib.request
from pathlib import Path

OUT = Path(__file__).resolve().parent / "data" / "raw_infocasas.csv"
BASE = "https://www.infocasas.com.pe/venta/departamentos/lima"
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0 Safari/537.36")
N_PAGINAS    = int(sys.argv[1])   if len(sys.argv) > 1 else 150
PAUSA        = float(sys.argv[2]) if len(sys.argv) > 2 else 0.5
START_PAGE   = int(sys.argv[3])   if len(sys.argv) > 3 else 1
CHECKPOINT   = 25

# Distritos de Lima Metropolitana para resolver el distrito desde el address.
DISTRITOS = [
    "Miraflores", "San Isidro", "Santiago de Surco", "Surco", "Barranco", "San Borja",
    "Jesús María", "Jesus Maria", "Magdalena del Mar", "Magdalena", "La Molina",
    "San Miguel", "Pueblo Libre", "Surquillo", "Lince", "Chorrillos", "San Martín de Porres",
    "La Victoria", "Cercado de Lima", "Lima", "Breña", "Brena", "Rímac", "Rimac", "Ate",
    "San Luis", "La Perla", "Callao", "Bellavista", "Los Olivos", "Comas", "Independencia",
    "San Juan de Lurigancho", "San Juan de Miraflores", "Villa El Salvador", "Villa María del Triunfo",
    "El Agustino", "Santa Anita", "Carabayllo", "Puente Piedra", "Cieneguilla", "Pachacamac",
    "Lurín", "Lurin", "Chaclacayo", "Lurigancho",
]


def fetch_page(n):
    url = BASE if n == 1 else f"{BASE}/pagina{n}"
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    html = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "ignore")
    m = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.S)
    if not m:
        return None
    data = json.loads(m.group(1))
    return data["props"]["pageProps"]["fetchResult"]["searchFast"]


def parse_coords(loc):
    """'POINT (-77.04 -12.08)' -> (lat, lng). El WKT es (lng lat)."""
    if not loc:
        return None, None
    pt = loc.get("location_point") if isinstance(loc, dict) else None
    if not pt:
        return None, None
    m = re.search(r"POINT\s*\(\s*(-?\d+\.?\d*)\s+(-?\d+\.?\d*)\s*\)", pt)
    if not m:
        return None, None
    lng, lat = float(m.group(1)), float(m.group(2))
    return lat, lng


def resolve_distrito(address):
    if not address:
        return ""
    low = address.lower()
    for d in DISTRITOS:
        if d.lower() in low:
            return d
    # fallback: penúltimo componente ("..., Distrito, Perú")
    parts = [p.strip() for p in address.split(",")]
    return parts[-2] if len(parts) >= 2 else ""


def tech_dict(ts):
    return {t.get("field"): t.get("value") for t in (ts or []) if isinstance(t, dict)}


def to_int(v, default=0):
    try:
        return int(float(str(v).strip()))
    except (ValueError, TypeError):
        return default


def precio_usd(it, m2):
    """Precio de venta en USD, robusto a la escala inconsistente de InfoCasas.

    El campo price.amount viene a veces en unidades y a veces en centavos (y en
    soles o USD), sin un patron fiable. En vez de adivinar la escala, se prueban
    ambas (unidades y /100) y se elige la que produce un precio/m2 PROPIO DE VENTA
    ($400-6000/m2 y total $20k-2.5M). Esto ademas descarta el alquiler colado en
    la pagina de venta (su precio/m2 no cae en rango de venta en ninguna escala).
    Devuelve 0 si ninguna escala es plausible -> el aviso se descarta.
    """
    p = it.get("price") or {}
    cur = p.get("currency") or {}
    amount = p.get("amount") or 0
    rate = cur.get("rate") or 1
    if not amount or not m2:
        return 0
    is_usd = cur.get("name") == "U$S" or rate == 1
    base = float(amount) if is_usd else float(amount) / rate   # a USD, escala sin resolver
    validos = [c for c in (base, base / 100.0)
               if 400 <= c / m2 <= 6000 and 20_000 <= c <= 2_500_000]
    return round(max(validos), 2) if validos else 0            # si ambas, la mayor (venta)


def parse_listing(it):
    lat, lng = parse_coords(it.get("locations"))
    td = tech_dict(it.get("technicalSheet"))
    cy = to_int(td.get("constructionYear"), 0)
    antig = (2026 - cy) if 1900 < cy <= 2026 else 0
    m2 = to_int(it.get("m2"), 0)
    pu = precio_usd(it, m2)
    return {
        "id": it.get("id"),
        "title": (it.get("title") or "").strip(),
        "price_usd": pu,
        "precio_m2": round(pu / m2, 1) if m2 else 0,
        "m2": m2,
        "lat": lat, "lng": lng,
        "address": (it.get("address") or "").strip(),
        "distrito": resolve_distrito(it.get("address")),
        "dormitorios": to_int(td.get("bedrooms"), 0),
        "banos": to_int(td.get("bathrooms"), 0),
        "cocheras": to_int(td.get("garage"), 0),
        "antiguedad_anios": antig,
        "construction_state": td.get("construction_state_name") or "",
        "property_type": (it.get("property_type") or {}).get("name", ""),
        "url": it.get("link") or "",
    }


def guardar(rows):
    if not rows:
        return
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)


def _cargar_existentes():
    """Carga IDs y filas ya scrapeadas del CSV previo para no repetirlas."""
    seen, rows = set(), []
    if OUT.exists():
        with open(OUT, newline="", encoding="utf-8") as f:
            for r in csv.DictReader(f):
                lid = r.get("id")
                if lid and lid not in seen:
                    seen.add(lid)
                    rows.append(r)
        print(f"[resume] {len(rows)} avisos previos cargados desde {OUT.name}", flush=True)
    return seen, rows


def main():
    seen, rows = _cargar_existentes() if START_PAGE > 1 else (set(), [])
    fallos = 0
    for n in range(START_PAGE, N_PAGINAS + 1):
        try:
            sf = fetch_page(n)
            fallos = 0
        except Exception as e:
            fallos += 1
            print(f"  pag {n}: ERROR {str(e)[:60]} (fallo {fallos})", flush=True)
            if fallos >= 5:
                print("  5 fallos seguidos (posible anti-bot) -> guardo y corto", flush=True)
                break
            time.sleep(PAUSA * 3)
            continue
        if not sf or not sf.get("data"):
            print(f"  pag {n}: sin data, fin", flush=True)
            break
        nuevos = 0
        for it in sf["data"]:
            lid = it.get("id")
            if lid in seen:
                continue
            seen.add(lid)
            r = parse_listing(it)
            if r["price_usd"] and r["m2"] and r["lat"] and r["lng"]:
                rows.append(r)
                nuevos += 1
        if n % CHECKPOINT == 0:
            guardar(rows)
            print(f"  pag {n}/{N_PAGINAS}: +{nuevos} (total {len(rows)}) [checkpoint guardado]", flush=True)
        elif n % 10 == 0 or n == 1:
            print(f"  pag {n}/{N_PAGINAS}: +{nuevos} (total {len(rows)})", flush=True)
        time.sleep(PAUSA)

    guardar(rows)
    print(f"\n[scrape] {len(rows)} avisos validos -> {OUT}", flush=True)
    # distribucion por distrito
    from collections import Counter
    c = Counter(r["distrito"] for r in rows)
    print("[scrape] top distritos:", dict(c.most_common(10)))


if __name__ == "__main__":
    main()
