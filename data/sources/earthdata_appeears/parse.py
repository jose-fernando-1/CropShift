"""Parsers for NASA AppEEARS point-sample CSVs (SMAP, MODIS, SRTM/NASADEM) with their fill values and units.

AppEEARS writes one row per date with the product layers as columns named `<PRODUCT>_<layer>`; quality flags are
decoded into extra columns that this parser ignores. Fill values become None.
"""

import csv
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path


@dataclass(frozen=True)
class Layer:
    product: str  # AppEEARS product id
    column_suffix: str  # the value column ends with this
    unit: str
    fill_values: tuple[float, ...]
    note: str = ""


LAYERS: dict[str, Layer] = {
    "smap_l4_rootzone": Layer(
        "SPL4SMGP.008", "Geophysical_Data_sm_rootzone", "m3/m3", (-9999.0,), "3-hourly, model + assimilation"
    ),
    "smap_l4_surface": Layer("SPL4SMGP.008", "Geophysical_Data_sm_surface", "m3/m3", (-9999.0,)),
    "smap_l3_am": Layer(
        "SPL3SMP_E.006", "Soil_Moisture_Retrieval_Data_AM_soil_moisture", "m3/m3", (-9999.0,), "observed, many gaps"
    ),
    "mod13_ndvi": Layer(
        "MOD13Q1.061", "250m_16_days_NDVI", "index", (-3000.0,), "16-day composite, scale already applied"
    ),
    "mod16_et": Layer(
        "MOD16A2GF.061",
        "ET_500m",
        "kg/m2/8 days",
        (32761.0, 32762.0, 32763.0, 32764.0, 32765.0, 32766.0, 32767.0),
        "x0.1 already applied by AppEEARS",
    ),
    "mod15_lai": Layer("MOD15A2H.061", "Lai_500m", "m2/m2", (255.0, 249.0, 250.0, 253.0, 254.0), ""),
    "mod15_fpar": Layer("MOD15A2H.061", "Fpar_500m", "fraction", (255.0, 249.0, 250.0, 253.0, 254.0)),
    "mod17_gpp": Layer("MOD17A2HGF.061", "Gpp_500m", "kgC/m2", (32767.0, 32766.0, 32765.0), "8-day"),
    "nasadem_height": Layer("NASADEM_NC.001", "NASADEM_HGT", "m", (-32768.0,)),
    "srtm_height": Layer("SRTMGL1_NC.003", "SRTMGL1_DEM", "m", (-32768.0,)),
}


def _parse_date(raw: str) -> date:
    return datetime.fromisoformat(raw.replace(" UTC", "")).date()


def read_layer(path: Path, layer_key: str) -> list[tuple[date, float | None]]:
    """(date, value) per row for one layer; several rows can share a date (SMAP L4 is 3-hourly)."""
    layer = LAYERS[layer_key]
    with path.open(encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        column = next((c for c in reader.fieldnames or [] if c.endswith(layer.column_suffix)), None)
        if column is None:
            raise ValueError(f"{path.name}: no column ending with {layer.column_suffix!r}")
        rows = []
        for row in reader:
            raw = row[column]
            value = None if raw in ("", None) else float(raw)
            rows.append((_parse_date(row["Date"]), None if value in layer.fill_values else value))
    return rows
