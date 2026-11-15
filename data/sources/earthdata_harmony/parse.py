"""Parsers for NASA GES DISC time-series CSVs (Giovanni/Harmony point series, e.g. GPM IMERG Final daily)."""

import csv
from datetime import date
from pathlib import Path


def read_giovanni_series(path: Path) -> tuple[dict[str, str], dict[date, float | None]]:
    """(metadata, {day: value}). The file has `key,value` header lines, a blank line, then `Timestamp (UTC),Data`.

    The undefined marker declared in the header (`undef`, e.g. -9999.9) becomes None, never 0.
    """
    metadata: dict[str, str] = {}
    series: dict[date, float | None] = {}
    in_data = False
    with path.open(encoding="utf-8", newline="") as handle:
        for row in csv.reader(handle):
            if not row:
                continue
            if row[0].startswith("Timestamp"):
                in_data = True
                continue
            if not in_data:
                metadata[row[0]] = row[1] if len(row) > 1 else ""
                continue
            undefined = float(metadata.get("undef", "nan"))
            value = float(row[1])
            series[date.fromisoformat(row[0][:10])] = None if value == undefined else value
    return metadata, series
