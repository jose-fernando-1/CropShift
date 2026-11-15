"""Documented inputs of a future calibration model. Names are stable; units are physical.

Per (municipality or climate cell, crop, soil class, dekad). Simulation indicators come from the engines, observation
indicators from the offline satellite pipeline (data/sources/earthdata_*), static ones from the catalog and SoilGrids.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Feature:
    name: str
    unit: str
    source: str
    note: str = ""


FEATURES: tuple[Feature, ...] = (
    Feature("sim_p", "fraction", "engine", "simulated success frequency of the dekad"),
    Feature("eta_etc_p10", "fraction", "engine", "10th percentile of seasonal ETa/ETc"),
    Feature("eta_etc_p50", "fraction", "engine"),
    Feature("eta_etc_p90", "fraction", "engine"),
    Feature("deficit_mid_p50_mm", "mm", "engine", "median water deficit in the flowering stage"),
    Feature("heat_days_p50", "days", "engine", "days with Tmax above the crop's absolute maximum"),
    Feature("cold_days_p50", "days", "engine", "days with Tmin below the crop's absolute minimum"),
    Feature("cycle_days", "days", "catalog"),
    Feature("legume", "bool", "catalog", "family Fabaceae: approximate nitrogen-fixing signal"),
    Feature("clay_g_kg", "g/kg", "SoilGrids", "0-30 cm weighted"),
    Feature("elevation_m", "m", "POWER grid"),
    Feature("rain_annual_mm", "mm", "POWER", "mean annual precipitation of the cell"),
    Feature("smap_rootzone_m3m3", "m3/m3", "SMAP L4 (observation)", "initial-condition / check, satellite pipeline"),
    Feature("mod16_et_mm_day", "mm/day", "MODIS MOD16A2GF (observation)", "check of simulated ETa"),
    Feature("ndvi", "index", "MODIS MOD13Q1 (observation)", "observed season check"),
    Feature(
        "imerg_vs_power_rain_ratio",
        "ratio",
        "IMERG vs POWER",
        "rain-source disagreement (about 0.63 in 2024 at the pilot)",
    ),
)
FEATURE_NAMES = tuple(f.name for f in FEATURES)

# Training targets (not implemented): ZARC recommended/not per dekad and risk class; PAM relative yield per municipality-year.
# Leakage warnings: ZARC is itself derived from a water balance (agreement is not independent validation) and PAM is a
# municipal statistic that pools rainfed and irrigated areas: hold out whole municipalities when evaluating.
