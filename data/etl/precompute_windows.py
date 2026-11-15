"""Simulates every climate cell x crop x soil class (rainfed) and stores `planting_window_results`.

    python -m data etl precompute-windows [--cell r163c230] [--crop cowpea]

Engines are the backend's pure functions; this script only feeds them from the database and stores the output.
Idempotent: a re-run replaces the rows of the same method version. Irrigated analyses are not simulated (the
water-balance success rule is vacuous with irrigation, so every crop is excluded with `no_data_for_regime`).
"""

import logging

from sqlalchemy import select

from app.core.config import settings
from app.core.database import SessionLocal
from app.engines.simulation import daily_et0, simulate_windows
from app.engines.water_balance import SOIL_THETA_AW, BalanceAssumptions
from app.models.geo import ClimateCell
from app.repositories.climate import ClimateRepository
from app.repositories.crops import CropRepository
from app.repositories.windows import WindowRepository
from app.services.simulation_service import FIRST_SEASON, LAST_SEASON, cycle_for, load_climate

logger = logging.getLogger("data.etl.precompute_windows")


def run(cell_id: str | None = None, crop_id: str | None = None) -> int:
    rows = 0
    with SessionLocal() as session:
        climate_repo, window_repo = ClimateRepository(session), WindowRepository(session)
        crops = [c for c in CropRepository(session).list_active() if crop_id in (None, c.id)]
        cells = [c for c in session.scalars(select(ClimateCell).order_by(ClimateCell.id)) if cell_id in (None, c.id)]
        stored = set(climate_repo.cells_with_data())
        for cell in cells:
            if cell.id not in stored:
                logger.warning("%s has no climate data, skipped", cell.id)
                continue
            series = load_climate(climate_repo, cell)
            et0 = daily_et0(series)
            for crop in crops:
                requirements = crop.requirements
                cycle = cycle_for(crop)
                for soil_class, theta_aw in SOIL_THETA_AW.items():
                    results = simulate_windows(
                        series,
                        cycle,
                        FIRST_SEASON,
                        LAST_SEASON,
                        BalanceAssumptions(theta_aw=theta_aw),
                        temp_abs_min_c=requirements.temp_abs_min_c,
                        temp_abs_max_c=requirements.temp_abs_max_c,
                        et0=et0,
                    )
                    window_repo.replace(
                        cell.id, crop.id, soil_class, settings.method_version, (FIRST_SEASON, LAST_SEASON), results
                    )
                    rows += len(results)
            session.commit()
            logger.info("%s: %d crops x 3 soils simulated", cell.id, len(crops))
    logger.info("windows: %d rows stored (method %s)", rows, settings.method_version)
    return rows
