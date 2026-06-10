"""Predicción de precio de referencia, lectura y guardado de análisis."""
import logging
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from geo_index import OutOfBoundsError
import ml  # ml.MODEL_R2 / MODEL_MAE_USD / MODEL_MAE_PCT son LAZY via __getattr__
from ml import counterfactual_full, explain_fair_value, predict_fair_value
from models import Analysis, AnalysisFactor, Property, Report, User
from routers.dashboard import _time_ago
from schemas import (Counterfactual, CounterfactualIn, CounterfactualOut,
                     DetailedNarrativeOut, ExplainGroup, ExplainOut,
                     Factor, NarrativeOut, PoiHighlight, PredictIn, PredictOut,
                     PredictionInterval, PredictVentaIn, PredictVentaOut,
                     RecentItem, SaveOut, SimulateOut)
from venta_service import (MAE_PCT as VENTA_MAE_PCT, MODEL_R2 as VENTA_R2,
                           ZONE_BAND_PCT as VENTA_ZONE_BAND, venta_service)

router = APIRouter(prefix="/api", tags=["fairvalue"])

# Cobertura REAL del intervalo intercuartil P25-P75, medida en el test set
# (quantile_coverage.json). El teórico es 50%, pero XGBoost quantile sin
# calibración conformal cubre ~43%. Se lee del artefacto para no hardcodear un
# número que pueda divergir del modelo. Cacheado a nivel de módulo.
_QUANTILE_COVERAGE_PCT: Optional[float] = None


def _quantile_coverage_pct() -> float:
    """% real de comparables que caen en el rango P25-P75 (~43%). Honesto:
    NO prometemos 50%. Default conservador 43% si el artefacto no está."""
    global _QUANTILE_COVERAGE_PCT
    if _QUANTILE_COVERAGE_PCT is None:
        import json
        from pathlib import Path
        p = (Path(__file__).resolve().parent.parent
             / "models" / "v2" / "quantile_coverage.json")
        cov = 0.4274
        if p.exists():
            try:
                cov = float(json.loads(p.read_text()).get("coverage_p25_p75", cov))
            except (ValueError, KeyError, OSError):
                pass
        _QUANTILE_COVERAGE_PCT = round(cov * 100)
    return _QUANTILE_COVERAGE_PCT


def _analysis_to_out(a: Analysis) -> PredictOut:
    """Reconstruye PredictOut desde un Analysis persistido (historial)."""
    fair = float(a.fair_value)
    delta = fair * (float(a.mae_pct) / 100)
    warnings = []
    if a.fallback_reason == "low_density":
        warnings.append("Pocos comparables en 1 km; se usó el promedio del distrito.")
    elif a.fallback_reason == "no_coverage":
        warnings.append("Sin comparables dentro de 5 km; estimación de baja confianza.")
    return PredictOut(
        analysis_id=a.id,
        fair_value=fair,
        announced_price=float(a.announced_price),
        diff=float(a.diff or 0),
        diff_pct=float(a.diff_pct or 0),
        zone=a.zone or "Justo",
        confidence=a.confidence,
        n_comparables=a.n_comparables,
        coverage_radius_km=float(a.coverage_radius_km or 0),
        model_r2=ml.MODEL_R2,           # lazy via ml.__getattr__
        model_mae=ml.MODEL_MAE_USD,     # lazy via ml.__getattr__
        mae_pct=float(a.mae_pct),
        min=round(fair - delta, 2),
        max=round(fair + delta, 2),
        factors=[Factor(label=f.label, score=f.score, positive=f.positive)
                 for f in a.factors],
        predicted_in_seconds=0.0,
        warnings=warnings,
        fallback_reason=a.fallback_reason,
        version=a.model_version,
        distrito=a.property.district,
    )


@router.post("/fairvalue/predict", response_model=PredictOut)
def predict(
    payload: PredictIn,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    # Inferencia. El pin fuera del bbox de Lima → 400.
    try:
        res = predict_fair_value(payload.model_dump())
    except OutOfBoundsError:
        raise HTTPException(
            status_code=400,
            detail="Por ahora solo cubrimos Lima Metropolitana. Mueve el pin a un punto dentro de Lima e intenta de nuevo.",
        )

    # Persistir el inmueble analizado.
    prop = Property(
        district=res["distrito"],
        lat=payload.lat, lng=payload.lng,
        area_m2=payload.area,
        dormitorios=payload.dormitorios, banos=payload.banos,
        cocheras=payload.cocheras, antiguedad_anios=payload.antiguedad_anios,
        es_estudio=payload.es_estudio,
        amenities=",".join(payload.amenities),
    )
    db.add(prop)
    db.flush()

    # Persistir el análisis (la zona/diff las calcula ml.py, no la BD).
    analysis = Analysis(
        user_id=current.id, property_id=prop.id,
        announced_price=res["announced_price"],
        fair_value=res["fair_value"],
        diff=res["diff"], diff_pct=res["diff_pct"], zone=res["zone"],
        mae_pct=res["mae_pct"], confidence=res["confidence"],
        n_comparables=res["n_comparables"],
        coverage_radius_km=res["coverage_radius_km"],
        fallback_reason=res["fallback_reason"],
        model_version=res["version"],
    )
    db.add(analysis)
    db.flush()

    for idx, f in enumerate(res["factors"]):
        db.add(AnalysisFactor(
            analysis_id=analysis.id, label=f["label"],
            score=f["score"], positive=f["positive"], order_idx=idx))

    # Marca de última actividad del usuario.
    current.last_activity_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(analysis)

    out = _analysis_to_out(analysis)
    out.predicted_in_seconds = res["predicted_in_seconds"]
    out.warnings = res["warnings"]
    # Contrafactuales (Sprint 2.2): no se persisten en BD — son derivables del
    # form + modelo, no histórico. Se calculan en cada predict.
    out.counterfactuals = [Counterfactual(**cf) for cf in res.get("counterfactuals", [])]
    # Intervalo P25/P50/P75 (Sprint 3.1, solo v2). Si no hay quantile cargado,
    # queda None y el frontend cae al precio único.
    pi = res.get("prediction_interval")
    out.prediction_interval = PredictionInterval(**pi) if pi else None
    return out


@router.post("/fairvalue/simulate", response_model=SimulateOut)
def simulate(
    payload: PredictIn,
    current: User = Depends(get_current_user),
):
    """Simulador what-if: corre el modelo con las características que el usuario
    ajusta en vivo (sliders) y devuelve solo la predicción. A diferencia de
    /predict NO persiste Property/Analysis: un slider dispara muchas llamadas y
    no son análisis del historial."""
    try:
        res = predict_fair_value(payload.model_dump())
    except OutOfBoundsError:
        raise HTTPException(
            status_code=400,
            detail="Por ahora solo cubrimos Lima Metropolitana. Mueve el pin a un punto dentro de Lima e intenta de nuevo.",
        )
    pi = res.get("prediction_interval") or {}
    return SimulateOut(
        fair_value=res["fair_value"], zone=res["zone"],
        diff=res["diff"], diff_pct=res["diff_pct"],
        p25=pi.get("p25"), p50=pi.get("p50"), p75=pi.get("p75"),
    )


@router.post("/fairvalue/predict-venta", response_model=PredictVentaOut)
def predict_venta(
    payload: PredictVentaIn,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Precio de VENTA de referencia. Modelo independiente (ventas_model),
    mismo patron que alquiler: precio justo + veredicto (±8%) + banda ±MAPE.
    NO persiste analisis (v1). 503 si el modelo de venta no esta cargado."""
    if not venta_service.is_loaded():
        raise HTTPException(
            status_code=503,
            detail="El estimador de venta no esta disponible en este momento.")
    try:
        res = venta_service.predict(payload.model_dump())
    except OutOfBoundsError:
        raise HTTPException(
            status_code=400,
            detail="Por ahora solo cubrimos Lima Metropolitana. Mueve el pin a un punto dentro de Lima e intenta de nuevo.")

    fair = res["fair_value"]
    announced = float(payload.precio)
    diff = announced - fair
    diff_pct = (diff / fair * 100) if fair else 0.0
    if diff_pct < -VENTA_ZONE_BAND:
        zone = "Ganga"
    elif diff_pct > VENTA_ZONE_BAND:
        zone = "Inflado"
    else:
        zone = "Justo"
    delta = fair * VENTA_MAE_PCT / 100.0

    # db es la misma sesión que cargó a `current` (get_db se cachea por
    # request); el commit persiste la marca de actividad.
    current.last_activity_at = datetime.now(timezone.utc)
    db.commit()
    return PredictVentaOut(
        fair_value=fair, announced_price=announced,
        diff=round(diff, 2), diff_pct=round(diff_pct, 2), zone=zone,
        n_comparables=res["n_comparables"],
        coverage_radius_km=res["coverage_radius_km"],
        model_r2=VENTA_R2, mae_pct=VENTA_MAE_PCT,
        min=round(fair - delta, 2), max=round(fair + delta, 2),
        warnings=([] if not res.get("fallback_reason")
                  else ["Pocos comparables cerca; estimacion de venta de baja confianza."]),
        fallback_reason=res.get("fallback_reason"),
        distrito=res["distrito"], version="venta-v1",
    )


@router.post("/fairvalue/counterfactual", response_model=CounterfactualOut)
def counterfactual(
    payload: CounterfactualIn,
    current: User = Depends(get_current_user),   # mismo gate que /predict
):
    """Palancas accionables: re-sirve el modelo congelado variando una feature
    a la vez (numéricas plausibles + toggle de amenities). No persiste nada —
    es derivable del form + modelo, no histórico."""
    try:
        return counterfactual_full(payload.model_dump())
    except OutOfBoundsError:
        raise HTTPException(
            status_code=400,
            detail="Por ahora solo cubrimos Lima Metropolitana. Mueve el pin a un punto dentro de Lima e intenta de nuevo.",
        )


@router.get("/analyses", response_model=List[RecentItem])
def list_analyses(
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    """Lista TODOS los análisis del usuario (ordenados por fecha desc).
    Se usa en el modal de 'Análisis recientes' del dashboard, donde el
    frontend filtra por zona y pagina cliente-side."""
    rows = db.execute(
        select(Analysis, Property)
        .join(Property, Property.id == Analysis.property_id)
        .where(Analysis.user_id == current.id)
        .order_by(Analysis.created_at.desc())
    ).all()
    return [
        RecentItem(
            id=a.id,
            address=f"Inmueble en {p.district}",
            district=p.district,
            time=_time_ago(a.created_at),
            diff_pct=float(a.diff_pct or 0),
            fair_value=float(a.fair_value or 0),
            zone=a.zone or "Justo",
            kind="analysis",
        )
        for a, p in rows
    ]


@router.get("/analyses/{analysis_id}", response_model=PredictOut)
def get_analysis(
    analysis_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    a = db.get(Analysis, analysis_id)
    if not a or a.user_id != current.id:
        raise HTTPException(status_code=404, detail="Análisis no encontrado")
    return _analysis_to_out(a)


@router.get("/fairvalue/explain/{analysis_id}", response_model=ExplainOut)
def explain(
    analysis_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    """Explicación SHAP de un análisis (TreeSHAP nativo de XGBoost, solo v2).

    Reconstruye el form desde el Property persistido y devuelve la atribución
    real del modelo por grupo de features. Reemplaza los `factors` decorativos.
    """
    a = db.get(Analysis, analysis_id)
    if not a or a.user_id != current.id:
        raise HTTPException(status_code=404, detail="Análisis no encontrado")
    p = a.property
    form = {
        "lat": float(p.lat),
        "lng": float(p.lng),
        "area": float(p.area_m2),
        "dormitorios": int(p.dormitorios or 0),
        "banos": int(p.banos or 0),
        "cocheras": int(p.cocheras or 0),
        "antiguedad_anios": int(p.antiguedad_anios or 0),
        "es_estudio": bool(p.es_estudio),
        "amenities": [c for c in (p.amenities or "").split(",") if c],
    }
    try:
        res = explain_fair_value(form)
    except RuntimeError as e:
        # v1 activo o modelo sin soporte SHAP → 503 (el front cae al estado previo).
        raise HTTPException(status_code=503, detail=str(e))
    return ExplainOut(
        base_price=res["base_price"],
        predicted_price=res["predicted_price"],
        distrito=res["distrito"],
        groups=[ExplainGroup(**g) for g in res["groups"]],
    )


# ── helpers de narrativa LLM ────────────────────────────────────────────────
_POI_KIND_LABEL = {
    "supermercados": "Supermercado", "malls": "Centro comercial",
    "universidades": "Universidad", "parques": "Parque",
    "farmacias": "Farmacia", "bancos": "Banco",
    "estaciones": "Estación de Metro",
    "colegios_top": "Colegio top", "clinicas_premium": "Clínica",
    "restaurantes_premium": "Restaurante",
}
_POI_TIER_LABEL = {"premium": "gama alta", "mass": "gama masiva",
                   "cadena": "cadena", "indep": "independiente"}
# 2 POIs en super/bancos para mostrar el contraste de tier; 1 en el resto.
_POI_PER_CAT = {"supermercados": 2, "bancos": 2}


def _form_from_property(p) -> dict:
    """Reconstruye el form de predicción desde un Property persistido."""
    return {
        "lat": float(p.lat), "lng": float(p.lng),
        "area": float(p.area_m2),
        "dormitorios": int(p.dormitorios or 0),
        "banos": int(p.banos or 0),
        "cocheras": int(p.cocheras or 0),
        "antiguedad_anios": int(p.antiguedad_anios or 0),
        "es_estudio": bool(p.es_estudio),
        "amenities": [c for c in (p.amenities or "").split(",") if c],
    }


def _poi_highlights(lat: float, lng: float) -> List[PoiHighlight]:
    """POIs nombrados cercanos, curados para narrativa y display. Falla suave."""
    try:
        from osm_lookup import get_osm
        raw = get_osm().nearest_named(lat, lng, per_cat=2, max_m=1200.0)
    except Exception:
        return []
    out: List[PoiHighlight] = []
    for cat, items in raw.items():
        n = _POI_PER_CAT.get(cat, 1)
        for it in items[:n]:
            out.append(PoiHighlight(
                kind=_POI_KIND_LABEL.get(cat, cat),
                name=it["name"],
                dist_m=int(it["dist_m"]),
                tier=_POI_TIER_LABEL.get(it["tier"]) if it["tier"] else None,
            ))
    out.sort(key=lambda h: h.dist_m)
    return out


def _groq_chat(api_key: str, prompt: str, max_tokens: int, temperature: float) -> str:
    """Llamada única a Groq/Llama. Lanza HTTPException(502) si falla."""
    try:
        from groq import Groq
        client = Groq(api_key=api_key)
        resp = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=max_tokens,
            temperature=temperature,
        )
        content = (resp.choices[0].message.content or "").strip()
    except Exception as e:
        # Detail genérico al cliente: el mensaje crudo del SDK puede filtrar
        # hints de la API key o paths internos. El detalle queda en el log.
        logging.getLogger("wasi.groq").warning("Groq fallo: %s", e)
        raise HTTPException(status_code=502,
                            detail="El servicio de narrativa no está disponible en este momento.")
    if not content:
        raise HTTPException(status_code=502, detail="Respuesta vacía del modelo")
    return content


@router.get("/fairvalue/narrative/{analysis_id}", response_model=NarrativeOut)
def narrative(
    analysis_id: int,
    mode: str = "buyer",
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    """Resumen LLM (2-3 oraciones) sobre los SHAP groups + veredicto. Inline.

    mode='buyer' (Ana, inquilina): juzga el aviso. mode='seller' (Roberto,
    propietario): cómo posicionar su precio y qué hace valioso su inmueble."""
    from database import settings
    # 404 antes que 503: no revelar config (GROQ) antes de validar pertenencia.
    a = db.get(Analysis, analysis_id)
    if not a or a.user_id != current.id:
        raise HTTPException(status_code=404, detail="Análisis no encontrado")
    if not settings.groq_api_key:
        raise HTTPException(status_code=503, detail="GROQ_API_KEY no configurado")

    is_seller = mode == "seller"
    form = _form_from_property(a.property)
    try:
        res = explain_fair_value(form)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))

    groups = res["groups"]
    distrito = res["distrito"]
    predicted_price = res["predicted_price"]
    fair_value = float(a.fair_value)   # número persistido = el que ve el usuario en la tarjeta

    top = [g for g in sorted(groups, key=lambda g: abs(g["pct_effect"]), reverse=True)
           if abs(g["pct_effect"]) >= 0.5][:3]
    factors_text = "\n".join(
        f"- {g['label']}: {'sube' if g['positive'] else 'baja'} el precio {abs(g['pct_effect']):.1f}%"
        for g in top
    ) or "- (el inmueble está cerca del promedio de su distrito)"
    announced = float(a.announced_price) if a.announced_price is not None else None

    if is_seller:
        # Posicionamiento: el precio que el propietario piensa pedir vs la referencia.
        ctx_line = ""
        if announced:
            ctx_line = (f"El propietario piensa pedir ${announced:.0f}/mes; la referencia "
                        f"del modelo es ${fair_value:.0f}/mes.\n")
        prompt = (
            f"Eres un asesor de pricing inmobiliario para Lima, Perú, y le hablas al PROPIETARIO.\n\n"
            f"Inmueble en {distrito}. Precio de referencia sugerido para publicar: ${fair_value:.0f}/mes.\n"
            f"{ctx_line}\n"
            f"Factores del modelo (SHAP, efectos multiplicativos, no sumar):\n{factors_text}\n\n"
            f"Escribe 2 o 3 oraciones en español neutro (usa 'tú', nunca 'vos'/'tenés'/'podés') "
            f"dirigidas al propietario: por qué este es un buen precio de referencia para publicar "
            f"y qué hace valioso su inmueble. Menciona los 2 factores más relevantes. "
            f"No uses markdown ni asteriscos. Sé directo, sin adjetivos exagerados ni emojis."
        )
    else:
        zone = a.zone or None
        verdict_line = ""
        if announced and zone:
            verdict_line = (f"El aviso pide ${announced:.0f}/mes; la referencia del modelo es "
                            f"${fair_value:.0f}/mes (veredicto: {zone}).\n")
        prompt = (
            f"Eres un asistente de valuación inmobiliaria para Lima, Perú.\n\n"
            f"Inmueble en {distrito}. Precio de referencia del modelo: ${fair_value:.0f}/mes.\n"
            f"{verdict_line}\n"
            f"Factores del modelo (SHAP, efectos multiplicativos, no sumar):\n{factors_text}\n\n"
            f"Escribe 2 o 3 oraciones en español neutro (usa 'tú', nunca 'vos'/'tenés'/'podés') "
            f"explicando por qué este es el precio de referencia. Menciona los 2 factores más "
            f"relevantes. No uses markdown ni asteriscos. Sé directo, sin adjetivos exagerados ni emojis."
        )
    text = _groq_chat(settings.groq_api_key, prompt, max_tokens=170, temperature=0.3)

    return NarrativeOut(
        narrative=text,
        distrito=distrito,
        predicted_price=predicted_price,
        groups=[ExplainGroup(**g) for g in groups],
    )


@router.get("/fairvalue/narrative/{analysis_id}/detailed", response_model=DetailedNarrativeOut)
def narrative_detailed(
    analysis_id: int,
    mode: str = "buyer",
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    """Informe extenso (modal 'Análisis completo'): TODO el espectro disponible —
    SHAP completo + veredicto + confianza + entorno nombrado (gama alta vs masiva).

    mode='buyer' audita el aviso (Ana). mode='seller' asesora al propietario
    (Roberto): cómo posicionar el precio y maximizar el valor del inmueble."""
    from database import settings
    # 404 antes que 503: no revelar config (GROQ) antes de validar pertenencia.
    a = db.get(Analysis, analysis_id)
    if not a or a.user_id != current.id:
        raise HTTPException(status_code=404, detail="Análisis no encontrado")
    if not settings.groq_api_key:
        raise HTTPException(status_code=503, detail="GROQ_API_KEY no configurado")

    is_seller = mode == "seller"

    p = a.property
    form = _form_from_property(p)
    try:
        res = explain_fair_value(form)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))

    groups = res["groups"]
    distrito = res["distrito"]
    base_price = res["base_price"]

    # Métricas del análisis ya persistido (no se recalculan).
    fair_value = float(a.fair_value)
    announced = float(a.announced_price) if a.announced_price is not None else None
    zone = a.zone or None
    diff_pct = float(a.diff_pct) if a.diff_pct is not None else None
    confidence = a.confidence or None
    n_comp = int(a.n_comparables or 0)
    mae_pct = float(a.mae_pct) if a.mae_pct is not None else float(ml.MODEL_MAE_PCT)
    delta = fair_value * (mae_pct / 100.0)
    price_min, price_max = round(fair_value - delta), round(fair_value + delta)

    pois = _poi_highlights(float(p.lat), float(p.lng))

    # ── espectro para el prompt ──────────────────────────────────────────
    sube = sorted([g for g in groups if g["positive"] and abs(g["pct_effect"]) >= 0.5],
                  key=lambda g: abs(g["pct_effect"]), reverse=True)
    baja = sorted([g for g in groups if not g["positive"] and abs(g["pct_effect"]) >= 0.5],
                  key=lambda g: abs(g["pct_effect"]), reverse=True)

    def _g_line(g):
        return f"- {g['label']} ({g['description']}): {'+' if g['positive'] else '-'}{abs(g['pct_effect']):.1f}%"

    sube_txt = "\n".join(_g_line(g) for g in sube) or "- (ninguno relevante)"
    baja_txt = "\n".join(_g_line(g) for g in baja) or "- (ninguno relevante)"
    poi_txt = "\n".join(
        f"- {h.kind}: {h.name} a {h.dist_m} m" + (f" ({h.tier})" if h.tier else "")
        for h in pois
    ) or "- (sin POIs nombrados en el radio cercano)"

    amen = ", ".join(form["amenities"]) or "ninguno declarado"
    # El sentido del signo se resuelve en Python (no se deja que el LLM lo infiera
    # de un % firmado). Para vendedor el marco es POSICIONAMIENTO, no veredicto.
    if is_seller:
        if announced is not None:
            if announced < price_min:
                pos = ("CONSERVADOR: por debajo del rango de referencia. Rentarás rápido "
                       "pero estás dejando margen sobre la mesa.")
            elif announced > price_max:
                pos = ("AGRESIVO: por encima del rango de referencia. Más margen por mes, "
                       "pero puede tardar más en colocarse.")
            else:
                pos = "COMPETITIVO: dentro del rango de referencia, alineado al mercado."
            verdict_txt = (f"El propietario piensa pedir ${announced:.0f}/mes. "
                           f"Posicionamiento frente al rango sugerido: {pos}")
        else:
            verdict_txt = ("El propietario aún no fijó un precio; usa la referencia y el rango "
                           "como punto de partida.")
    elif announced and zone and diff_pct is not None:
        sentido = ("más barato que" if diff_pct < 0
                   else "más caro que" if diff_pct > 0 else "igual a")
        verdict_txt = (f"Precio del aviso: ${announced:.0f}/mes, es decir {abs(diff_pct):.1f}% "
                       f"{sentido} la referencia (veredicto del sistema: {zone}).")
    else:
        verdict_txt = "El usuario no ingresó un precio de aviso para comparar."

    common_data = (
        "DATOS DEL INMUEBLE\n"
        f"- Distrito: {distrito}\n"
        f"- Área: {form['area']:.0f} m2; {form['dormitorios']} dormitorios, "
        f"{form['banos']} baños, {form['cocheras']} cocheras\n"
        f"- Antigüedad: {form['antiguedad_anios']} años\n"
        f"- Amenities declarados: {amen}\n\n"
        "VALUACIÓN DEL MODELO (XGBoost v2)\n"
        f"- Precio base del modelo: ${base_price:.0f}/mes. Aplicando los factores de abajo de forma "
        f"multiplicativa sobre ese base se llega al precio de referencia de ${fair_value:.0f}/mes.\n"
        f"- Margen de error del modelo: +/- {mae_pct:.1f}% (MAPE por validación espacial sin leakage), "
        f"es decir una banda de referencia de ${price_min:.0f} a ${price_max:.0f}/mes. "
        f"Es la banda de error típico, no un intervalo que garantice cubrir la mitad de los avisos: "
        f"el rango intercuartil P25-P75 del modelo cubre alrededor del {_quantile_coverage_pct():.0f}% "
        f"de los comparables (medido en validación, no el 50% teórico).\n"
        f"- {verdict_txt}\n"
        f"- Confianza: {confidence or 'no informada'} ({n_comp} avisos comparables cercanos)\n\n"
        "QUÉ SUBE EL PRECIO (TreeSHAP, efectos MULTIPLICATIVOS, NO sumar entre sí):\n"
        f"{sube_txt}\n\n"
        "QUÉ LO MODERA:\n"
        f"{baja_txt}\n\n"
        "ENTORNO INMEDIATO (POIs reales georreferenciados; la gama es contexto del barrio, "
        "NO un peso del modelo):\n"
        f"{poi_txt}\n\n"
    )
    entorno_rule = (
        "**El entorno** (describe el perfil de barrio que sugieren los POIs cercanos. La gama de un "
        "supermercado —premium como Wong/Vivanda frente a masivo como Plaza Vea/Metro— es señal del "
        "poder adquisitivo de la zona; un banco grande indica zona comercial. NO afirmes cuánto pondera "
        "el modelo a un POI puntual: el modelo solo ve la cantidad y la distancia de servicios por "
        "categoría, resumidas arriba en 'Servicios cercanos'. Solo nombra POIs que aparezcan en "
        "ENTORNO INMEDIATO.)\n"
    )
    common_rules = (
        "REGLAS: No inventes datos ni marcas que no estén arriba. No atribuyas un porcentaje a un POI "
        "individual; el único efecto cuantificado del entorno es el grupo 'Servicios cercanos'. "
        "Los porcentajes son multiplicativos: nunca los sumes."
    )

    if is_seller:
        prompt = (
            "Eres un asesor de pricing inmobiliario para Lima, Perú. Redactas un informe breve "
            "para el PROPIETARIO que va a publicar su inmueble en alquiler. Háblale en segunda persona.\n\n"
            + common_data +
            "INSTRUCCIONES:\n"
            "Escribe un análisis en español neutro (usa 'tú', nunca 'vos'/'tenés'/'podés'). "
            "Tono profesional y directo, sin adjetivos exagerados ni emojis. "
            "Estructura el texto EXACTAMENTE en estas secciones, cada título en negrita markdown en su propia línea:\n"
            "**Precio sugerido** (2 oraciones: a cuánto conviene publicar según la referencia y su rango)\n"
            "**Cómo posicionarte** (interpreta el posicionamiento de arriba: si es conservador, competitivo "
            "o agresivo, y el trade-off entre margen por mes y rapidez de colocación. Si no fijó precio, "
            "recomienda partir del rango)\n"
            "**Qué hace valioso tu inmueble** (los 2-3 factores que más elevan el precio, citando su %)\n"
            "**Dónde podrías mejorar** (factores que lo moderan: qué se podría mejorar para pedir más; "
            "si no hay, dilo en una línea)\n"
            + entorno_rule +
            "**Confianza** (qué tan sólida es la estimación según los comparables y el margen de error; "
            "sé honesto si la confianza es Media o Baja)\n"
            + common_rules
        )
    else:
        prompt = (
            "Eres un analista de valuación inmobiliaria para Lima, Perú. Redactas un informe "
            "de auditoría breve pero riguroso para una persona que evalúa un alquiler.\n\n"
            + common_data +
            "INSTRUCCIONES:\n"
            "Escribe un análisis en español neutro (usa 'tú', nunca 'vos'/'tenés'/'podés'). "
            "Tono profesional y directo, sin adjetivos exagerados ni emojis. "
            "Estructura el texto EXACTAMENTE en estas secciones, cada título en negrita markdown en su propia línea:\n"
            "**Veredicto** (2 oraciones: si el precio del aviso es razonable frente a la referencia y por qué; "
            "respeta el sentido indicado arriba: más barato = oportunidad, más caro = negociable)\n"
            "**Qué sube el precio** (los 2-3 factores que más lo elevan, citando su % del modelo)\n"
            "**Qué lo modera** (factores que lo bajan; si no hay, dilo en una línea)\n"
            + entorno_rule +
            "**Confianza** (qué tan sólida es la estimación según los comparables y el margen de error; "
            "sé honesto si la confianza es Media o Baja)\n"
            + common_rules
        )
    text = _groq_chat(settings.groq_api_key, prompt, max_tokens=750, temperature=0.35)

    return DetailedNarrativeOut(
        narrative=text, distrito=distrito, fair_value=fair_value,
        announced_price=announced, zone=zone, diff_pct=diff_pct,
        confidence=confidence, n_comparables=n_comp, mae_pct=mae_pct,
        price_min=float(price_min), price_max=float(price_max),
        groups=[ExplainGroup(**g) for g in groups],
        poi_highlights=pois,
    )


@router.get("/fairvalue/poi-importance")
def poi_importance():
    """Importancia de POIs agrupada por categoría (sin auth — dato estático).

    Solo disponible en modelo v2. Devuelve lista ordenada de mayor a menor.
    """
    from model_service import model_service
    data = model_service.poi_importance()
    if not data:
        raise HTTPException(status_code=503, detail="Modelo v1 activo — sin datos POI")
    return {"data": data}


@router.post("/analyses/{analysis_id}/save", response_model=SaveOut)
def save_analysis(
    analysis_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    a = db.get(Analysis, analysis_id)
    if not a or a.user_id != current.id:
        raise HTTPException(status_code=404, detail="Análisis no encontrado")
    existing = db.execute(
        select(Report).where(Report.analysis_id == analysis_id)
    ).scalar_one_or_none()
    if existing:
        return SaveOut(report_id=existing.id)
    rep = Report(user_id=current.id, analysis_id=analysis_id)
    db.add(rep)
    db.commit()
    db.refresh(rep)
    return SaveOut(report_id=rep.id)
