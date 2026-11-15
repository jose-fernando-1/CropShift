"""Glue between stored data and the pure engines: builds engine inputs from the database for one cell."""

from datetime import date

import numpy as np

from app.engines.crop_cycle import Stage, build_cycle
from app.engines.simulation import ClimateSeries
from app.models.catalog import Crop
from app.models.geo import ClimateCell
from app.repositories.climate import ClimateRepository

FIRST_SEASON, LAST_SEASON = 1984, 2023  # 40 planting seasons; POWER is stored through 2024 for cycles crossing the year


def load_climate(climate: ClimateRepository, cell: ClimateCell) -> ClimateSeries:
    rows = climate.load_series(cell.id, date(1984, 1, 1), date(2024, 12, 31))
    if not rows:
        raise LookupError(f"no climate data stored for cell {cell.id}")

    def column(name: str) -> np.ndarray:
        return np.array([np.nan if getattr(r, name) is None else getattr(r, name) for r in rows], dtype=float)

    return ClimateSeries(
        first_day=rows[0].day,
        lat=cell.lat,
        elevation_m=cell.elevation_m or 0.0,
        t2m=column("t2m"),
        t2m_max=column("t2m_max"),
        t2m_min=column("t2m_min"),
        rh2m=column("rh2m"),
        ws2m=column("ws2m"),
        ps=column("ps"),
        allsky=column("allsky_sfc_sw_dwn"),
        rain=column("prectotcorr"),
    )


def cycle_for(crop: Crop):
    stages = [
        Stage(
            position=s.position,
            duration_days=s.duration_days,
            kc_start=s.kc_start,
            kc_end=s.kc_end,
            root_depth_start_m=s.root_depth_start_m,
            root_depth_end_m=s.root_depth_end_m,
            depletion_fraction=s.depletion_fraction,
        )
        for s in crop.stages
    ]
    return build_cycle(stages)
