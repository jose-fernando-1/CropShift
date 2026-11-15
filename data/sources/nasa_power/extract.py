"""Downloads NASA POWER daily series (1984-2024) for the climate cells of Pernambuco. Public API, no key.

    python -m data extract power --cells pilot     # the cell of Sao Bento do Una only
    python -m data extract power --cells all       # the 38 cells of the PE municipality centroids

Writes data/raw/nasa_power/<cell_id>.json (the API body, untouched) and manifest.json. Re-running skips cells whose
file matches the manifest checksum; use --force to refetch. The query point is always the CELL CENTRE, never a
user coordinate, so one series serves every municipality of the cell.
"""

import json
import logging
from datetime import date

from app.integrations.nasa_power import BASE_URL, PARAMETERS, fetch_daily_series
from data._common.http import make_client
from data._common.manifest import is_current, write_manifest
from data._common.paths import PROCESSED_DIR, raw_dir

logger = logging.getLogger("data.nasa_power")

START, END = date(1984, 1, 1), date(2024, 12, 31)
PILOT_CELL = "r163c230"  # -8.5 / -36.25: contains the pilot point -8.60 / -36.40


def cells_from_processed() -> dict[str, dict]:
    source = PROCESSED_DIR / "geo" / "municipalities.json"
    if not source.exists():
        raise SystemExit(f"{source} missing: run `python -m data extract ibge-geo` first.")
    return {r["power_cell"]["id"]: r["power_cell"] for r in json.loads(source.read_text(encoding="utf-8"))}


def run(scope: str = "pilot", force: bool = False) -> None:
    cells = cells_from_processed()
    if scope == "pilot":
        cells = {PILOT_CELL: cells[PILOT_CELL]}
    target = raw_dir("nasa_power")
    done: list = []
    with make_client(timeout_s=120.0) as client:
        for index, (cell_id, cell) in enumerate(sorted(cells.items()), start=1):
            name = f"{cell_id}.json"
            if not force and is_current(target, name):
                logger.info("[%d/%d] %s up to date, skipped", index, len(cells), cell_id)
            else:
                _, body = fetch_daily_series(cell["lat"], cell["lon"], START, END, client)
                (target / name).write_bytes(body)
                logger.info("[%d/%d] %s fetched (%.1f MB)", index, len(cells), cell_id, len(body) / 1e6)
                write_manifest_for(target, cells, scope)  # checkpoint: a crash keeps what was fetched
            done.append(target / name)
    write_manifest_for(target, cells, scope)


def write_manifest_for(target, cells: dict[str, dict], scope: str) -> None:
    files = [target / f"{cell_id}.json" for cell_id in sorted(cells) if (target / f"{cell_id}.json").exists()]
    existing = sorted(p for p in target.glob("r*.json") if p not in files)
    write_manifest(
        target,
        source="nasa_power",
        url=BASE_URL,
        params={"parameters": list(PARAMETERS), "community": "AG", "start": START.isoformat(), "end": END.isoformat()},
        files=files + existing,
        licence="NASA POWER data are public domain; cite POWER (power.larc.nasa.gov)",
        notes=f"scope={scope}; fill value -999 = missing; radiation (CERES) exists only from 1984",
    )
