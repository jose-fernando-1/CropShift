"""Extracts satellite point samples through NASA AppEEARS (needs an Earthdata Login account; see docs/api-keys.md).

    python -m data extract appeears --point pilot [--start 01-01-2024 --end 12-31-2024]

Writes the bundle CSVs to data/raw/earthdata_appeears/<name>/. The queue is slow (minutes to hours), which is why this
is an offline step: the API never calls Earthdata. Credentials come from EARTHDATA_USERNAME / EARTHDATA_PASSWORD
(data/.env or the environment) and are never printed.
"""

import logging

from pydantic import SecretStr

from app.integrations.appeears import AppeearsClient, PointRequest
from data._common.env import secret
from data._common.manifest import write_manifest
from data._common.paths import raw_dir

logger = logging.getLogger("data.appeears")

PILOT = {"name": "pilot_sao_bento_do_una", "latitude": -8.60, "longitude": -36.40}
LAYERS = [
    ("SPL4SMGP.008", "Geophysical_Data_sm_rootzone"),
    ("SPL4SMGP.008", "Geophysical_Data_sm_surface"),
    ("MOD13Q1.061", "_250m_16_days_NDVI"),
    ("MOD16A2GF.061", "ET_500m"),
    ("MOD15A2H.061", "Lai_500m"),
    ("MOD17A2HGF.061", "Gpp_500m"),
    ("NASADEM_NC.001", "NASADEM_HGT"),
]


def run(start: str = "01-01-2024", end: str = "12-31-2024") -> None:
    username, password = secret("EARTHDATA_USERNAME"), secret("EARTHDATA_PASSWORD")
    if not (username and password):
        raise SystemExit(
            "EARTHDATA_USERNAME / EARTHDATA_PASSWORD are not set: see docs/api-keys.md (run `make doctor`)."
        )
    client = AppeearsClient(username, SecretStr(password))
    request = PointRequest(PILOT["name"], PILOT["latitude"], PILOT["longitude"], start, end, LAYERS)
    task_id = client.submit_point(request)
    logger.info("AppEEARS task submitted; waiting for the queue (can take a long time)")
    client.wait(task_id)
    target = raw_dir("earthdata_appeears") / PILOT["name"]
    target.mkdir(parents=True, exist_ok=True)
    files = []
    for name, content in client.download_csvs(task_id).items():
        path = target / name
        path.write_bytes(content)
        files.append(path)
    write_manifest(
        target,
        source="earthdata_appeears",
        url="https://appeears.earthdatacloud.nasa.gov/api/",
        params={"point": PILOT, "dates": [start, end], "layers": LAYERS},
        files=files,
        licence="NASA Earthdata (open); cite each product's DOI (see docs/data-sources.md)",
    )
    logger.info("appeears: %d files -> %s", len(files), target)
