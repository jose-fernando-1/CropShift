"""Loads the downloaded NASA POWER series (data/raw/nasa_power/*.json) into `climate_daily`. Idempotent per cell.

python -m data etl load-climate
"""

import json
import logging
from datetime import datetime

from app.core.database import SessionLocal
from app.integrations.nasa_power import BASE_URL, parse_series
from app.repositories.climate import ClimateRepository
from data._common.paths import RAW_DIR

logger = logging.getLogger("data.etl.load_climate")


def run() -> int:
    raw = RAW_DIR / "nasa_power"
    files = sorted(raw.glob("r*.json"))
    if not files:
        raise SystemExit("no files in data/raw/nasa_power: run `python -m data extract power` first.")
    manifest = json.loads((raw / "manifest.json").read_text(encoding="utf-8"))
    total = 0
    with SessionLocal() as session:
        repository = ClimateRepository(session)
        for file in files:
            series = parse_series(json.loads(file.read_text(encoding="utf-8")))
            rows = repository.replace_series(file.stem, series)
            total += rows
            logger.info("%s: %d days, elevation %s m", file.stem, rows, series.elevation_m)
        first, last = series.days[0].year, series.days[-1].year
        repository.upsert_dataset_version(
            "NASA POWER daily",
            f"{first}-{last}",
            url=BASE_URL,
            licence="NASA POWER (public)",
            retrieved_at=datetime.fromisoformat(manifest["retrieved_at"]),
            notes=f"{len(files)} cells, AG community, retrieved {manifest['retrieved_at']}",
        )
        session.commit()
    return total
