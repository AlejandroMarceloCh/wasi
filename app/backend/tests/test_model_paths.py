import importlib.util
from pathlib import Path

from wasi.paths import MODELS_DIR, MODELS_V2_DIR, REPO_ROOT


def _import_from_path(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def test_model_paths_apuntan_a_raiz_del_repo():
    assert MODELS_DIR == REPO_ROOT / "models"
    assert MODELS_V2_DIR == REPO_ROOT / "models" / "v2"
    assert MODELS_V2_DIR.exists()
    assert (MODELS_V2_DIR / "modelo_final_v2.joblib").exists()


def test_scripts_criticos_importan_sin_rutas_muertas():
    root = REPO_ROOT
    modules = [
        ("pipeline_run_pipeline", root / "pipeline" / "run_pipeline.py"),
        ("pipeline_rollback", root / "pipeline" / "rollback.py"),
        (
            "generate_model_artefacts_v2",
            root / "app" / "backend" / "scripts" / "generate_model_artefacts_v2.py",
        ),
        (
            "generate_model_artefacts",
            root / "app" / "backend" / "scripts" / "generate_model_artefacts.py",
        ),
        (
            "validate_build_features",
            root / "app" / "backend" / "scripts" / "validate_build_features.py",
        ),
        (
            "validate_pipeline",
            root / "app" / "backend" / "scripts" / "validate_pipeline.py",
        ),
        ("seed_catalogo", root / "app" / "backend" / "scripts" / "seed_catalogo.py"),
        (
            "audit_calibracion_distritos",
            root / "app" / "backend" / "scripts" / "audit_calibracion_distritos.py",
        ),
        ("gate3_amenities", root / "app" / "backend" / "scripts" / "gate3_amenities.py"),
        (
            "gate6_seleccion_modelo",
            root / "app" / "backend" / "scripts" / "gate6_seleccion_modelo.py",
        ),
        (
            "train_item1_rescrape",
            root / "pipeline" / "scripts" / "train_item1_rescrape.py",
        ),
        (
            "train_quantile_v2",
            root / "pipeline" / "scripts" / "train_quantile_v2.py",
        ),
    ]
    for name, path in modules:
        module = _import_from_path(name, path)
        if hasattr(module, "MODELS"):
            assert module.MODELS in (MODELS_DIR, MODELS_V2_DIR)
        if hasattr(module, "MODELS_V2"):
            assert module.MODELS_V2 == MODELS_V2_DIR


def test_no_quedan_imports_o_rutas_obsoletas_en_scripts_ejecutables():
    roots = [
        REPO_ROOT / "app" / "backend" / "scripts",
        REPO_ROOT / "pipeline" / "run_pipeline.py",
        REPO_ROOT / "pipeline" / "rollback.py",
        REPO_ROOT / "pipeline" / "scripts",
    ]
    patterns = [
        "from ml import",
        "from model_service import",
        "from geo_index import",
        "from osm_lookup import",
        "from distrito_features import",
        "from ml_v2 import",
        'BACKEND / "models"',
        'APP / "models" / "v2"',
        'PROJECT / "app" / "backend" / "models" / "v2"',
        "app/backend/models/v2",
    ]
    offenders = []
    for root in roots:
        files = [root] if root.is_file() else sorted(root.glob("*.py"))
        for path in files:
            text = path.read_text(encoding="utf-8")
            for pattern in patterns:
                if pattern in text:
                    offenders.append(f"{path.relative_to(REPO_ROOT)}: {pattern}")
    assert offenders == []
