"""Filesystem layout of data/. `raw/` and `processed/` are git-ignored; `demo/` is committed."""

from pathlib import Path

DATA_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = DATA_DIR.parent
BACKEND_DIR = REPO_ROOT / "backend"

RAW_DIR = DATA_DIR / "raw"
PROCESSED_DIR = DATA_DIR / "processed"
DEMO_DIR = DATA_DIR / "demo"
SOURCES_DIR = DATA_DIR / "sources"


def raw_dir(source: str) -> Path:
    """`data/raw/<source>/`, created on demand."""
    path = RAW_DIR / source
    path.mkdir(parents=True, exist_ok=True)
    return path


def processed_dir(name: str) -> Path:
    """`data/processed/<name>/`, created on demand."""
    path = PROCESSED_DIR / name
    path.mkdir(parents=True, exist_ok=True)
    return path
