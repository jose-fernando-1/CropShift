"""Parses the team's FAO-56 + EcoCrop crop sheet into the catalog shape (pure functions, no I/O side effects).

The rules mirror `web/scripts/build-mock-fixtures.ts` (`buildRequirements`), so the backend and the web mock
serve identical `requirements` for the same sheet; `backend/tests/data/test_catalog_parity.py` proves it.
"""

import csv
from pathlib import Path

SOURCE_DIR = Path(__file__).resolve().parent
FICHA_CSV = SOURCE_DIR / "ficha_exigencias_culturas_FAO56_EcoCrop.csv"
META_CSV = SOURCE_DIR / "crops_meta.csv"

# Documented assumptions (stored in crop_parameter_sources with kind="assumption"; revisited by the sensitivity runs).
KC_INI_DEFAULT = 0.35  # FAO-56 derives Kc ini from wetting frequency; the proposal uses 0.3-0.4 as typical.
ROOT_DEPTH_AT_PLANTING_M = 0.15  # FAO-56 gives only the maximum depth; roots grow linearly to it over stages 1-2.
STAGE_NAMES = ("initial", "development", "mid_season", "late_season")


def parse_range(raw: str, column: str) -> dict[str, float] | None:
    """'0.6-1.0' -> {min: 0.6, max: 1.0}; '1.05' -> {min: 1.05, max: 1.05}; '' or '-' -> None. Order-insensitive."""
    value = raw.strip()
    if value in ("", "-"):
        return None
    cells = [c.strip() for c in value.split("-")]
    if len(cells) > 2 or any(c == "" for c in cells):
        raise ValueError(f"{column}: cannot parse {raw!r}")
    try:
        numbers = [float(c) for c in cells]
    except ValueError:
        raise ValueError(f"{column}: cannot parse {raw!r}") from None
    return {"min": min(numbers), "max": max(numbers)}


def _required_range(raw: str, column: str) -> dict[str, float]:
    parsed = parse_range(raw, column)
    if parsed is None:
        raise ValueError(f"{column}: missing value")
    return parsed


def _single(raw: str, column: str) -> float | None:
    parsed = parse_range(raw, column)
    if parsed and parsed["min"] != parsed["max"]:
        raise ValueError(f"{column}: expected one value, got {raw!r}")
    return parsed["min"] if parsed else None


def parse_requirements(row: dict[str, str]) -> dict:
    """One sheet row -> contract-shaped `requirements` (raw FAO-56 and EcoCrop values, as published)."""
    stages = row["fao56_fases_ini_dev_mid_late_total_dias"].split("/")
    if len(stages) != 5 or not all(s.strip().isdigit() for s in stages):
        raise ValueError(f"{row['cultura']}: bad stage lengths")
    initial, development, mid_season, late_season, total = (int(s) for s in stages)
    depletion = _single(row["fracao_depleção_p"], "fracao_depleção_p")
    if depletion is None:
        raise ValueError(f"{row['cultura']}: missing depletion fraction")
    return {
        "fao56": {
            "stage_days": {
                "initial": initial,
                "development": development,
                "mid_season": mid_season,
                "late_season": late_season,
                # Kept raw: the sheet's total can differ from the stage sum (cowpea 100 vs 110).
                "total": total,
            },
            "kc": {
                "initial": _single(row["kc_ini"], "kc_ini"),
                "mid": _required_range(row["kc_mid"], "kc_mid"),
                "end": _required_range(row["kc_end"], "kc_end"),
            },
            "max_height_m": _required_range(row["altura_max_m"], "altura_max_m"),
            "max_root_depth_m": _required_range(row["raiz_max_m"], "raiz_max_m"),
            "depletion_fraction": depletion,
            "salinity_threshold_ece_ds_m": parse_range(row["salinidade_ECe_limiar_dSm"], "salinidade_ECe_limiar_dSm"),
        },
        "ecocrop": {
            "species": row["eco_especie"],
            "temperature_optimal_c": _required_range(row["eco_T_otima"], "eco_T_otima"),
            "temperature_absolute_c": _required_range(row["eco_T_abs"], "eco_T_abs"),
            "rainfall_optimal_mm": _required_range(row["eco_chuva_otima_mm"], "eco_chuva_otima_mm"),
            "rainfall_absolute_mm": _required_range(row["eco_chuva_abs_mm"], "eco_chuva_abs_mm"),
            "ph_optimal": _required_range(row["eco_pH_otimo"], "eco_pH_otimo"),
            "cycle_days": _required_range(row["eco_ciclo_dias"], "eco_ciclo_dias"),
            "tolerances": [t.strip() for t in row["eco_tolerancia"].replace("|", ";").split(";") if t.strip()],
        },
    }


def _midpoint(r: dict[str, float]) -> float:
    return round((r["min"] + r["max"]) / 2, 4)


def growth_stages(requirements: dict) -> list[dict]:
    """The four FAO-56 stages with Kc and root depth at each end (the water balance's input).

    Kc: flat at Kc ini, linear to Kc mid across development, flat, then linear to Kc end. Ranges use their midpoint.
    Roots: ROOT_DEPTH_AT_PLANTING_M at planting, linear to the lower bound of the published maximum by the end of
    development, constant afterwards. Both choices are assumptions recorded in crop_parameter_sources.
    """
    fao = requirements["fao56"]
    days = fao["stage_days"]
    kc_ini = fao["kc"]["initial"] if fao["kc"]["initial"] is not None else KC_INI_DEFAULT
    kc_mid = _midpoint(fao["kc"]["mid"])
    kc_end = _midpoint(fao["kc"]["end"])
    root_max = max(fao["max_root_depth_m"]["min"], ROOT_DEPTH_AT_PLANTING_M)
    p = fao["depletion_fraction"]
    plan = [
        ("initial", days["initial"], kc_ini, kc_ini, ROOT_DEPTH_AT_PLANTING_M, ROOT_DEPTH_AT_PLANTING_M),
        ("development", days["development"], kc_ini, kc_mid, ROOT_DEPTH_AT_PLANTING_M, root_max),
        ("mid_season", days["mid_season"], kc_mid, kc_mid, root_max, root_max),
        ("late_season", days["late_season"], kc_mid, kc_end, root_max, root_max),
    ]
    return [
        {
            "position": i,
            "stage": name,
            "duration_days": duration,
            "kc_start": kc_start,
            "kc_end": kc_stop,
            "root_depth_start_m": root_start,
            "root_depth_end_m": root_stop,
            "depletion_fraction": p,
        }
        for i, (name, duration, kc_start, kc_stop, root_start, root_stop) in enumerate(plan, start=1)
    ]


def parameter_sources(requirements: dict) -> list[dict]:
    """Provenance rows for one crop; assumptions are listed explicitly, never hidden in code."""
    kc_ini_given = requirements["fao56"]["kc"]["initial"] is not None
    rows = [
        (
            "fao56_stage_days",
            "FAO Irrigation and Drainage Paper 56, Table 11",
            "published",
            "Reference values for specific regions and dates; not calibrated to Northeast Brazil.",
        ),
        (
            "fao56_kc",
            "FAO Irrigation and Drainage Paper 56, Table 12",
            "published",
            "Single crop coefficients; Kc ini depends on wetting frequency and is blank in the sheet when so.",
        ),
        ("fao56_root_depletion", "FAO Irrigation and Drainage Paper 56, Table 22", "published", None),
        ("fao56_salinity", "FAO Irrigation and Drainage Paper 56, Table 23", "published", "Not listed for every crop."),
        (
            "ecocrop",
            "FAO EcoCrop database (via the OpenCLIM/ecocrop CSV copy)",
            "published",
            "Licence of the FAO data not confirmed; see data/sources/fao_ecocrop/README.md.",
        ),
        (
            "kc_curve_shape",
            "Cropshift: midpoint of published Kc ranges, linear transitions",
            "assumption",
            "Sensitivity of the ranking to this choice is part of the validation scenarios.",
        ),
        (
            "root_depth_curve",
            f"Cropshift: {ROOT_DEPTH_AT_PLANTING_M} m at planting, linear to the lower published maximum",
            "assumption",
            "FAO-56 gives the maximum depth only.",
        ),
    ]
    if not kc_ini_given:
        rows.append(
            (
                "kc_ini",
                f"Cropshift: default Kc ini {KC_INI_DEFAULT}",
                "assumption",
                "Proposal: typical 0.3-0.4, dependent on local wetting; not a universal constant.",
            )
        )
    return [{"parameter": a, "source": b, "kind": c, "quality_note": d} for a, b, c, d in rows]


def load_rows() -> dict[str, dict[str, str]]:
    with FICHA_CSV.open(encoding="utf-8", newline="") as handle:
        return {row["cultura"]: row for row in csv.DictReader(handle)}


def load_meta() -> list[dict[str, str]]:
    with META_CSV.open(encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def build_catalog() -> list[dict]:
    """The full catalog: one entry per crop in crops_meta.csv, in file order."""
    sheet = load_rows()
    catalog = []
    for meta in load_meta():
        row = sheet.get(meta["ficha_row"])
        if row is None:
            raise ValueError(f"crop sheet has no row {meta['ficha_row']!r} for {meta['crop_id']}")
        requirements = parse_requirements(row)
        cycle = requirements["fao56"]["stage_days"]["total"]
        catalog.append(
            {
                "crop_id": meta["crop_id"],
                "name_en": meta["name_en"],
                "name_pt": meta["name_pt"],
                "scientific_name": requirements["ecocrop"]["species"],
                "family": meta["family"],
                "legume": row["eco_familia_leguminosa"].strip().lower() in ("sim", "yes", "true"),
                "cycle_days": cycle,
                "pam_crop": meta["pam_crop"] or None,
                "zarc_name": meta["zarc_name"] or None,
                "requirements": requirements,
                "stages": growth_stages(requirements),
                "sources": parameter_sources(requirements),
            }
        )
    return catalog
