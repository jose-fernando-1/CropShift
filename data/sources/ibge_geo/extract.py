"""Downloads the Pernambuco municipal mesh and names from the public IBGE APIs (no key, no login).

    python -m data extract ibge-geo

Writes data/raw/ibge_geo/{mesh.geojson,names.json,manifest.json} and
data/processed/geo/municipalities.json (records with polygon, centroid and POWER cell).
"""

import json
import logging

from data._common.http import get_with_retry, make_client
from data._common.manifest import write_manifest
from data._common.paths import processed_dir, raw_dir
from data.sources.ibge_geo.parse import STATE_CODE, build_municipalities

logger = logging.getLogger("data.ibge_geo")

MESH_URL = f"https://servicodados.ibge.gov.br/api/v3/malhas/estados/{STATE_CODE}"
MESH_PARAMS = {"formato": "application/vnd.geo+json", "qualidade": "minima", "intrarregiao": "municipio"}
NAMES_URL = f"https://servicodados.ibge.gov.br/api/v1/localidades/estados/{STATE_CODE}/municipios"


def run() -> None:
    raw = raw_dir("ibge_geo")
    with make_client() as client:
        mesh_response = get_with_retry(client, MESH_URL, params=MESH_PARAMS)
        names_response = get_with_retry(client, NAMES_URL)
    for response in (mesh_response, names_response):
        response.raise_for_status()
    mesh, names = mesh_response.json(), names_response.json()

    mesh_file, names_file = raw / "mesh.geojson", raw / "names.json"
    mesh_file.write_text(json.dumps(mesh), encoding="utf-8")
    names_file.write_text(json.dumps(names, ensure_ascii=False), encoding="utf-8")
    write_manifest(
        raw,
        source="ibge_geo",
        url=MESH_URL,
        params={"mesh": MESH_PARAMS, "names_url": NAMES_URL},
        files=[mesh_file, names_file],
        licence="IBGE open data (terms page not confirmed, see README)",
    )

    records = build_municipalities(mesh, names)
    output = processed_dir("geo") / "municipalities.json"
    output.write_text(json.dumps(records, ensure_ascii=False), encoding="utf-8")
    cells = {r["power_cell"]["id"] for r in records}
    logger.info("ibge_geo: %d municipalities across %d POWER cells -> %s", len(records), len(cells), output)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run()
