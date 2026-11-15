"""ZARC risk-table rows -> one window per (municipality, crop, texture soil class). Pure functions.

Selection rules (identical to `web/scripts/build-mock-fixtures.ts`, so live and mock show the same ZARC):
- rainfed rows only ("Sequeiro"); texture soil classes 1-3 only (the AD classes 11-16 have no mapping from 1-3);
- when a municipality, crop and soil have several rows: cycle "21" first, then the lowest cycle, then the general
  climate ("Não se aplica") over a regional variant.
Values 0, 20, 30 and 40 are kept as published. Their meaning as risk percent is NOT confirmed in the ZARC
dictionary, and dekad 1 = Jan 1-10 is an assumption.
"""

import csv
from pathlib import Path

PREFERRED_CYCLE = "21"
TEXTURE_SOILS = {"1", "2", "3"}
GENERAL_CLIMATE = "Não se aplica"
VALID_VALUES = {0, 20, 30, 40}


def _rank(entry: dict) -> tuple[int, int, int]:
    return (
        0 if entry["cycle_code"] == PREFERRED_CYCLE else 1,
        int(entry["cycle_code"]),
        0 if entry["climate"] == GENERAL_CLIMATE else 1,
    )


def build_windows(rows: list[dict[str, str]], crop_by_zarc_name: dict[str, str]) -> list[dict]:
    """`rows`: csv.DictReader rows of a ZARC safra file. Returns the selected windows, sorted for stable output."""
    seasons: set[str] = set()
    chosen: dict[tuple[str, str, str], dict] = {}
    for row in rows:
        crop_id = crop_by_zarc_name.get(row["Nome_cultura"])
        if not crop_id or row["Nome_Outros_Manejos"] != "Sequeiro" or row["Cod_Solo"] not in TEXTURE_SOILS:
            continue
        seasons.add(f"{row['SafraIni']}/{row['SafraFin']}")
        values = [int(row[f"dec{i}"]) for i in range(1, 37)]
        if not set(values) <= VALID_VALUES:
            raise ValueError(f"unexpected ZARC value in {row['geocodigo']} {row['Nome_cultura']}")
        entry = {
            "municipality_code": row["geocodigo"],
            "crop_id": crop_id,
            "soil_code": int(row["Cod_Solo"]),
            "cycle_code": row["Cod_Ciclo"],
            "ordinance": row["Portaria"],
            "climate": row["Nome_Clima"],
            "values": values,
        }
        key = (row["geocodigo"], crop_id, row["Cod_Solo"])
        if key not in chosen or _rank(entry) < _rank(chosen[key]):
            chosen[key] = entry
    if len(seasons) != 1:
        raise ValueError(f"expected one ZARC season, got {sorted(seasons)}")
    season = seasons.pop().replace("/", "/")
    return [
        {**entry, "season": season}
        for _, entry in sorted(chosen.items(), key=lambda kv: (kv[0][0], kv[0][1], kv[0][2]))
    ]


def read_rows(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle, delimiter=";"))
