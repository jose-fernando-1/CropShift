"""Builds `data/processed/catalog/crops.json` from the crop sheet. Offline, deterministic.

python -m data.sources.fao_ecocrop.build_catalog
"""

import json
import logging

from data._common.manifest import write_manifest
from data._common.paths import processed_dir
from data.sources.fao_ecocrop.parse import FICHA_CSV, build_catalog

logger = logging.getLogger("data.fao_ecocrop")


def run() -> None:
    catalog = build_catalog()
    target = processed_dir("catalog")
    output = target / "crops.json"
    output.write_text(json.dumps(catalog, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    write_manifest(
        target,
        source="fao_ecocrop",
        url="https://www.fao.org/4/x0490e/x0490e00.htm | https://ecocrop.apps.fao.org | https://github.com/OpenCLIM/ecocrop",
        params={"input": FICHA_CSV.name},
        files=[output],
        licence="FAO-56 values transcribed from the bulletin; EcoCrop data licence unconfirmed (see README)",
    )
    logger.info("catalog: %d crops -> %s", len(catalog), output)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run()
