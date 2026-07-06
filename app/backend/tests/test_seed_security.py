from pathlib import Path

from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import sessionmaker

from database import Base
from models import User
import seed as seed_module


def _session(tmp_path: Path):
    engine = create_engine(f"sqlite:///{tmp_path / 'seed.db'}", future=True)
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine, future=True)
    return Session()


def _dataset(tmp_path: Path) -> Path:
    path = tmp_path / "inmuebles_alquiler_clean.csv"
    path.write_text("distrito_oficial\nMiraflores\nMiraflores\nSan Isidro\n", encoding="utf-8")
    return path


def test_seed_no_crea_usuarios_demo_por_defecto(monkeypatch, tmp_path):
    monkeypatch.delenv("WASI_ENABLE_DEMO_SEED", raising=False)
    monkeypatch.setattr(seed_module, "DATASET", _dataset(tmp_path))
    db = _session(tmp_path)
    try:
        seed_module.seed_if_empty(db)
        total_users = db.scalar(select(func.count(User.id)))
        assert total_users == 0
    finally:
        db.close()


def test_seed_demo_explicito_no_imprime_password(monkeypatch, tmp_path, capsys):
    monkeypatch.setenv("WASI_ENABLE_DEMO_SEED", "1")
    monkeypatch.setattr(seed_module, "DATASET", _dataset(tmp_path))
    db = _session(tmp_path)
    try:
        seed_module.seed_if_empty(db)
        emails = {u.email for u in db.execute(select(User)).scalars()}
        assert seed_module.DEMO_EMAIL in emails
        assert seed_module.SELLER_EMAIL in emails
        assert seed_module.CATALOG_EMAIL in emails
    finally:
        db.close()

    out = capsys.readouterr().out
    assert "demo1234" not in out
