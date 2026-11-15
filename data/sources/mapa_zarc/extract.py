"""Ingests a MAPA ZARC "Tábua de Risco" safra CSV (Pernambuco rows) and derives the per-crop windows.

    python -m data extract zarc [--file path/to/zarc_tabua_risco_safra2025_2026_PE.csv]

The open-data portal resets connections from non-browser clients, so the CSV is downloaded by hand in a browser
(see README.md) into data/raw/mapa_zarc/. Writes data/processed/zarc/zarc_windows.csv (one row per municipality,
crop and texture soil class, values as a 36-character digit string: 0, 2, 3, 4 for 0, 20, 30, 40).
"""

import csv
import logging
import shutil
from pathlib import Path

from data._common.manifest import write_manifest
from data._common.paths import processed_dir, raw_dir
from data.sources.fao_ecocrop.parse import load_meta
from data.sources.mapa_zarc.parse import build_windows, read_rows

logger = logging.getLogger("data.mapa_zarc")

PORTAL = "https://dados.agricultura.gov.br/dataset/tabua-de-risco-zoneamento-agricola-de-risco-climatico"
DIGIT = {0: "0", 20: "2", 30: "3", 40: "4"}


def run(file: Path | None = None) -> None:
    raw = raw_dir("mapa_zarc")
    if file is not None:
        shutil.copy(file, raw / file.name)
    candidates = sorted(raw.glob("*.csv"))
    if not candidates:
        raise SystemExit(f"no ZARC CSV in {raw}: download it in a browser first (data/sources/mapa_zarc/README.md).")
    source = candidates[-1]
    crop_by_zarc_name = {m["zarc_name"]: m["crop_id"] for m in load_meta() if m["zarc_name"]}
    windows = build_windows(read_rows(source), crop_by_zarc_name)
    output = processed_dir("zarc") / "zarc_windows.csv"
    with output.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(
            ["municipality_code", "crop_id", "soil_code", "cycle_code", "ordinance", "season", "climate", "values"]
        )
        for w in windows:
            writer.writerow(
                [w["municipality_code"], w["crop_id"], w["soil_code"], w["cycle_code"], w["ordinance"], w["season"],
                 w["climate"], "".join(DIGIT[v] for v in w["values"])]
            )  # fmt: skip
    write_manifest(
        raw,
        source="mapa_zarc",
        url=PORTAL,
        params={"file": source.name},
        files=[source],
        licence="CC BY (MAPA open data)",
        notes="manual browser download; values 0/20/30/40 meaning and dekad 1 = Jan 1-10 are unconfirmed assumptions",
    )
    crops = sorted({w["crop_id"] for w in windows})
    logger.info("zarc: %d windows for %d crops %s -> %s", len(windows), len(crops), crops, output)
