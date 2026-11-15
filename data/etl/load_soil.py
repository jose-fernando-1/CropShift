"""Loads downloaded SoilGrids profiles into `soil_profiles` and sets each municipality's default soil class.

python -m data etl load-soil
"""

import json
import logging
from datetime import datetime

from app.core.database import SessionLocal
from app.integrations.soilgrids import BASE_URL, parse_profiles
from app.repositories.climate import ClimateRepository
from app.repositories.soil import SoilRepository
from data._common.paths import RAW_DIR

logger = logging.getLogger("data.etl.load_soil")


def run() -> dict[str, int]:
    raw = RAW_DIR / "soilgrids"
    files = sorted(raw.glob("[0-9]*.json"))
    if not files:
        raise SystemExit("no files in data/raw/soilgrids: run `python -m data extract soilgrids` first.")
    manifest = json.loads((raw / "manifest.json").read_text(encoding="utf-8"))
    retrieved_at = datetime.fromisoformat(manifest["retrieved_at"])
    counts = {"class_1": 0, "class_2": 0, "class_3": 0, "masked": 0}
    with SessionLocal() as session:
        soil = SoilRepository(session)
        for file in files:
            profiles = parse_profiles(json.loads(file.read_text(encoding="utf-8")))
            soil_class = soil.replace_profiles(file.stem, profiles, retrieved_at)
            counts["masked" if soil_class is None else f"class_{soil_class}"] += 1
        ClimateRepository(session).upsert_dataset_version(
            "SoilGrids 2.0",
            "2.0",
            url=BASE_URL,
            licence="CC BY 4.0",
            retrieved_at=retrieved_at,
            notes=f"{len(files)} municipality centroids, 0-30 cm; default class by clay content",
        )
        session.commit()
    logger.info("soil: %d municipalities loaded %s", len(files), counts)
    return counts
