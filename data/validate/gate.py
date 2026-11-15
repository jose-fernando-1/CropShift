"""Quality gate: does the water-balance engine reproduce the official ZARC window for a crop?

    python -m data validate gate

For every crop with ZARC rows: for every municipality and texture soil class, take the engine's 36 success
frequencies (of the municipality's climate cell, with that soil class's available water) and the ZARC "recommended"
indicator (value > 0), and compute their Spearman rank correlation. The crop's gate value is the MEDIAN over all
municipality x soil pairs; it passes at >= 0.7 (the contract's threshold).

This measures agreement with the ZARC method, not agronomic truth: ZARC is itself derived from a water balance.
Crops without ZARC rows keep `not_run`. The result is written to the crops table (gate_* columns).
"""

import logging
import statistics

from sqlalchemy import select

from app.core.config import settings
from app.core.database import SessionLocal
from app.engines.windows import spearman
from app.models.catalog import Crop
from app.models.geo import Municipality
from app.models.reference import ZarcWindow
from app.models.results import PlantingWindowResult

logger = logging.getLogger("data.validate.gate")

THRESHOLD = 0.7

NOTE = {
    "passed": "Simulated success frequency reproduces the ZARC window (median Spearman {value:.2f} over {n} "
    "municipality x soil pairs; ZARC concordance is not independent validation).",
    "failed": "The engine does not reproduce the ZARC window (median Spearman {value:.2f} over {n} "
    "municipality x soil pairs, threshold {threshold}).",
    "not_run": "No ZARC rows for this crop in Pernambuco; the engine cannot be checked against the official window.",
}


def run() -> dict[str, dict]:
    summary: dict[str, dict] = {}
    with SessionLocal() as session:
        cells = {code: cell for code, cell in session.execute(select(Municipality.code, Municipality.power_cell_id))}
        curves: dict[tuple[str, str, int], list[float]] = {}
        for row in session.execute(
            select(
                PlantingWindowResult.cell_id,
                PlantingWindowResult.crop_id,
                PlantingWindowResult.soil_class,
                PlantingWindowResult.p,
            )
            .where(PlantingWindowResult.method_version == settings.method_version)
            .order_by(
                PlantingWindowResult.cell_id,
                PlantingWindowResult.crop_id,
                PlantingWindowResult.soil_class,
                PlantingWindowResult.dekad,
            )
        ):
            curves.setdefault((row.cell_id, row.crop_id, row.soil_class), []).append(row.p)

        values: dict[str, list[float]] = {}
        for window in session.scalars(select(ZarcWindow)):
            curve = curves.get((cells[window.municipality_code], window.crop_id, window.soil_code))
            if curve is None or len(curve) != 36:
                continue
            rho = spearman(curve, [1.0 if v > 0 else 0.0 for v in window.values])
            if rho is not None:
                values.setdefault(window.crop_id, []).append(rho)

        for crop in session.scalars(select(Crop).where(Crop.active.is_(True))):
            rhos = values.get(crop.id)
            if not rhos:
                crop.gate_status, crop.gate_value, crop.gate_note = "not_run", None, NOTE["not_run"]
            else:
                median = round(statistics.median(rhos), 3)
                crop.gate_status = "passed" if median >= THRESHOLD else "failed"
                crop.gate_value = median
                crop.gate_note = NOTE[crop.gate_status].format(value=median, n=len(rhos), threshold=THRESHOLD)
            crop.gate_threshold = THRESHOLD
            summary[crop.id] = {"status": crop.gate_status, "value": crop.gate_value, "pairs": len(rhos or [])}
            logger.info(
                "%-13s %-8s median Spearman %s over %d pairs",
                crop.id,
                crop.gate_status,
                crop.gate_value,
                len(rhos or []),
            )
        session.commit()
    return summary
