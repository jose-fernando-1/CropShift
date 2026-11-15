"""Downloads SoilGrids 2.0 properties (clay, sand, silt, pH, organic carbon, bulk density; 0-30 cm) at the
centroid of every Pernambuco municipality. Public API, no key, CC BY 4.0.

    python -m data extract soilgrids [--workers 4] [--limit N]

The public REST API is slow (1-80 s per call) and sometimes unavailable, so this runs offline and is resumable:
one raw file per municipality in data/raw/soilgrids/<code>.json, existing files are skipped, failures are logged
and left for the next run. A masked cell (urban, water) is stored as returned (null values), never filled in.
"""

import json
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed

from app.integrations.http import ExternalServiceError
from app.integrations.soilgrids import BASE_URL, DEPTHS, PROPERTIES, fetch_point
from data._common.http import make_client
from data._common.manifest import write_manifest
from data._common.paths import PROCESSED_DIR, raw_dir

logger = logging.getLogger("data.soilgrids")


def _municipalities() -> list[dict]:
    source = PROCESSED_DIR / "geo" / "municipalities.json"
    if not source.exists():
        raise SystemExit(f"{source} missing: run `python -m data extract ibge-geo` first.")
    return json.loads(source.read_text(encoding="utf-8"))


def run(workers: int = 4, limit: int | None = None) -> None:
    target = raw_dir("soilgrids")
    todo = [m for m in _municipalities() if not (target / f"{m['code']}.json").exists()]
    if limit:
        todo = todo[:limit]
    logger.info("soilgrids: %d municipalities to fetch (%d workers)", len(todo), workers)
    failed: list[str] = []
    with make_client(timeout_s=180.0) as client, ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {
            pool.submit(fetch_point, m["centroid"]["lat"], m["centroid"]["lon"], client): m["code"] for m in todo
        }
        for done, future in enumerate(as_completed(futures), start=1):
            code = futures[future]
            try:
                _, body = future.result()
            except ExternalServiceError as exc:
                failed.append(code)
                logger.warning("[%d/%d] %s failed: %s", done, len(todo), code, exc)
                continue
            (target / f"{code}.json").write_bytes(body)
            logger.info("[%d/%d] %s ok", done, len(todo), code)
    files = sorted(target.glob("[0-9]*.json"))
    write_manifest(
        target,
        source="soilgrids",
        url=BASE_URL,
        params={
            "properties": list(PROPERTIES),
            "depths": list(DEPTHS),
            "value": "mean",
            "point": "municipality centroid",
        },
        files=files,
        licence="CC BY 4.0 (ISRIC - World Soil Information); cite SoilGrids 2.0",
        notes=f"{len(files)} of 185 municipalities fetched; failed this run: {failed or 'none'}",
    )
    if failed:
        logger.warning("%d failed; re-run the same command to retry them", len(failed))
