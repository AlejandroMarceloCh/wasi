"""FASE 1b — Scraper de avisos de VENTA de departamentos en Lima desde Babilonia.pe.

Babilonia renderiza solo 20 items server-side por URL (JSON-LD tipo ItemList).
Sin paginación numérica. Para maximizar cobertura se combinan filtros de
precio y dormitorios como dimensiones ortogonales.

Estrategia de filtros:
- 14 rangos de precio (USD) × 5 opciones de dormitorios = hasta 70 combinaciones
- Cada combinación devuelve hasta 20 items únicos
- Total esperado: ~800-1200 listings sin necesidad de Playwright

Sin anti-bot (curl directo = 200). Rate-limiting cortés (~0.4-0.6s/request).

Uso:
    ./venv/bin/python ventas_model/scrape_babilonia.py
    # resume automático: IDs ya vistos se cargan del CSV existente

Salida: ventas_model/data/raw_babilonia.csv
"""
import csv
import json
import re
import sys
import time
import urllib.request
from pathlib import Path

OUT = Path(__file__).resolve().parent / "data" / "raw_babilonia.csv"
BASE = "https://babilonia.pe/inmuebles/departamentos-en-venta"
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0 Safari/537.36")

PAUSA = float(sys.argv[1]) if len(sys.argv) > 1 else 0.5

# Rangos de precio (USD) — mínimo:máximo
PRICE_RANGES = [
    (0,      40000),
    (40000,  70000),
    (70000,  100000),
    (100000, 130000),
    (130000, 160000),
    (160000, 200000),
    (200000, 250000),
    (250000, 300000),
    (300000, 400000),
    (400000, 500000),
    (500000, 700000),
    (700000, 1000000),
    (1000000, 2000000),
]

# Filtros de dormitorios
DORM_FILTERS = [None, "1-dormitorio", "2-dormitorios", "3-dormitorios", "4-dormitorios"]

BBOX = {"lat_min": -12.50, "lat_max": -11.60, "lng_min": -77.25, "lng_max": -76.60}

JSONLD_RE = re.compile(
    r'<script[^>]+type="application/ld\+json"[^>]*>(.*?)</script>',
    re.DOTALL,
)

PEN_PER_USD = 3.75


def build_url(price_min, price_max, dorm_filter=None):
    price_str = f"{price_min}:{price_max}-usd"
    if dorm_filter:
        return f"{BASE}/{dorm_filter}/{price_str}"
    return f"{BASE}/{price_str}"


def fetch_items(url):
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": UA,
            "Accept-Language": "es-PE,es;q=0.9",
            "Accept": "text/html,application/xhtml+xml",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            html = r.read().decode("utf-8", errors="replace")
    except Exception as e:
        raise RuntimeError(str(e))

    for m in JSONLD_RE.finditer(html):
        try:
            data = json.loads(m.group(1).strip())
        except json.JSONDecodeError:
            continue
        if data.get("@type") == "ItemList":
            return data.get("itemListElement", [])
    return []


def _num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _precio_usd(offers):
    p = _num(offers.get("price"))
    cur = (offers.get("priceCurrency") or "").upper()
    if p and p > 0:
        if cur in ("PEN", "S/", "SOL", "SOLES"):
            return round(p / PEN_PER_USD, 2)
        return p

    specs = offers.get("priceSpecification") or []
    if isinstance(specs, dict):
        specs = [specs]
    usd_p, pen_p = None, None
    for spec in specs:
        sp = _num(spec.get("price"))
        sc = (spec.get("priceCurrency") or "").upper()
        if not sp or sp <= 0:
            continue
        if sc in ("USD", "US$", "U$S"):
            usd_p = sp
        elif sc in ("PEN", "S/", "SOL", "SOLES"):
            pen_p = sp
    if usd_p:
        return usd_p
    if pen_p:
        return round(pen_p / PEN_PER_USD, 2)
    return None


def parse_item(it):
    entity = it.get("mainEntity") or {}
    if entity.get("@type") != "Apartment":
        return None

    offers = it.get("offers") or {}
    precio = _precio_usd(offers)
    if not precio:
        return None

    fs = entity.get("floorSize") or {}
    m2 = _num(fs.get("value")) or _num(fs.get("minValue"))
    if not m2:
        return None

    geo = entity.get("geo") or {}
    lat = _num(geo.get("latitude"))
    lng = _num(geo.get("longitude"))
    if not lat or not lng:
        return None
    if not (BBOX["lat_min"] <= lat <= BBOX["lat_max"] and
            BBOX["lng_min"] <= lng <= BBOX["lng_max"]):
        return None

    def _dorms(d):
        if not d:
            return None
        return _num(d.get("value")) or _num(d.get("minValue"))

    dorms = _dorms(entity.get("numberOfBedrooms"))
    banos = _dorms(entity.get("numberOfFullBathrooms"))

    addr = entity.get("address") or {}
    distrito = (addr.get("addressLocality") or "").strip()

    url = it.get("url") or ""
    lid = url.rstrip("/").rsplit("-", 1)[-1] if url else None

    pm2 = precio / m2
    if not (400 <= pm2 <= 8000):
        return None

    return {
        "id": lid,
        "price_usd": round(precio, 2),
        "m2": m2,
        "dormitorios": dorms,
        "banos": banos,
        "cocheras": None,
        "antiguedad_anios": None,
        "lat": lat,
        "lng": lng,
        "distrito": distrito,
        "property_type": "Departamento",
        "url": url,
        "fuente": "babilonia",
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
    seen, rows = set(), []
    if OUT.exists():
        with open(OUT, newline="", encoding="utf-8") as f:
            for r in csv.DictReader(f):
                lid = r.get("id")
                if lid and lid not in seen:
                    seen.add(lid)
                    rows.append(r)
        print(f"[resume] {len(rows)} avisos previos cargados", flush=True)
    return seen, rows


def main():
    seen, rows = _cargar_existentes()

    # construir todas las combinaciones de filtros
    combos = []
    for dorm in DORM_FILTERS:
        for pmin, pmax in PRICE_RANGES:
            combos.append((dorm, pmin, pmax))

    print(f"[babilonia] {len(combos)} combinaciones a scrapecar", flush=True)
    fallos = 0
    checkpoint = 10

    for i, (dorm, pmin, pmax) in enumerate(combos):
        url = build_url(pmin, pmax, dorm)
        try:
            items = fetch_items(url)
            fallos = 0
        except Exception as e:
            fallos += 1
            label = f"{dorm or 'todos'} ${pmin}-{pmax}"
            print(f"  [{i+1}/{len(combos)}] ERROR {label}: {str(e)[:50]} (fallo {fallos})", flush=True)
            if fallos >= 5:
                print("  5 fallos seguidos -> guardo y corto", flush=True)
                break
            time.sleep(PAUSA * 3)
            continue

        nuevos = 0
        for it in items:
            r = parse_item(it)
            if r is None:
                continue
            lid = r["id"]
            if lid in seen:
                continue
            seen.add(lid)
            rows.append(r)
            nuevos += 1

        label = f"{dorm or 'todos':15s} ${pmin//1000}k-{pmax//1000}k"
        if nuevos > 0 or (i + 1) % 10 == 0:
            print(f"  [{i+1}/{len(combos)}] {label}: +{nuevos} nuevos (total {len(rows)})", flush=True)

        if (i + 1) % checkpoint == 0:
            guardar(rows)
            print(f"  [checkpoint] {len(rows)} guardados", flush=True)

        time.sleep(PAUSA)

    guardar(rows)
    print(f"\n[babilonia] {len(rows)} avisos validos -> {OUT}", flush=True)
    from collections import Counter
    c = Counter(r["distrito"] for r in rows)
    print("[babilonia] top distritos:", dict(c.most_common(10)))


if __name__ == "__main__":
    main()
