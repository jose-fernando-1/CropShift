"""FAO-56 Penman-Monteith reference evapotranspiration (daily). Pure numpy, vectorized, no I/O.

Equation numbers refer to FAO Irrigation and Drainage Paper 56 (Allen et al., 1998). Inputs use POWER's units:
temperatures in °C, wind at 2 m in m/s, shortwave radiation in MJ/m²/day, pressure in kPa. If a variable is
missing the corresponding day is NaN: the caller decides what to do (the simulation drops incomplete seasons).
"""

import numpy as np

SOLAR_CONSTANT = 0.0820  # MJ/m²/min
STEFAN_BOLTZMANN = 4.903e-9  # MJ/K⁴/m²/day
ALBEDO = 0.23  # reference grass


def saturation_vapour_pressure(temp_c):
    """e°(T), kPa (Eq. 11)."""
    return 0.6108 * np.exp(17.27 * temp_c / (temp_c + 237.3))


def slope_vapour_pressure_curve(temp_c):
    """Δ, kPa/°C (Eq. 13)."""
    return 4098.0 * saturation_vapour_pressure(temp_c) / (temp_c + 237.3) ** 2


def pressure_from_elevation(elevation_m):
    """Atmospheric pressure, kPa (Eq. 7); only for when no measured pressure exists."""
    return 101.3 * ((293.0 - 0.0065 * elevation_m) / 293.0) ** 5.26


def extraterrestrial_radiation(lat_rad: float, day_of_year):
    """Ra, MJ/m²/day (Eq. 21 with 23-25)."""
    doy = np.asarray(day_of_year, dtype=float)
    dr = 1.0 + 0.033 * np.cos(2.0 * np.pi * doy / 365.0)
    declination = 0.409 * np.sin(2.0 * np.pi * doy / 365.0 - 1.39)
    sunset_angle = np.arccos(np.clip(-np.tan(lat_rad) * np.tan(declination), -1.0, 1.0))
    return (
        (24.0 * 60.0 / np.pi)
        * SOLAR_CONSTANT
        * dr
        * (
            sunset_angle * np.sin(lat_rad) * np.sin(declination)
            + np.cos(lat_rad) * np.cos(declination) * np.sin(sunset_angle)
        )
    )


def actual_vapour_pressure_from_rh_mean(t_max, t_min, rh_mean):
    """ea, kPa, from mean relative humidity (Eq. 19): the only humidity POWER's RH2M gives us."""
    return (rh_mean / 100.0) * (saturation_vapour_pressure(t_max) + saturation_vapour_pressure(t_min)) / 2.0


def net_radiation(rs, ra, t_max, t_min, ea, elevation_m: float):
    """Rn, MJ/m²/day (Eq. 38-40, 37, 39): net shortwave minus net longwave, G = 0 on a daily step."""
    rns = (1.0 - ALBEDO) * rs
    rso = (0.75 + 2e-5 * elevation_m) * ra
    relative_shortwave = np.clip(rs / rso, 0.3, 1.0)  # Rs/Rso is limited to 1.0 (FAO-56, below Eq. 39)
    rnl = (
        STEFAN_BOLTZMANN
        * ((t_max + 273.16) ** 4 + (t_min + 273.16) ** 4)
        / 2.0
        * (0.34 - 0.14 * np.sqrt(ea))
        * (1.35 * relative_shortwave - 0.35)
    )
    return rns - rnl


def et0_penman_monteith(
    t_mean, t_max, t_min, ea, u2, rs, pressure_kpa, lat_rad: float, day_of_year, elevation_m: float
):
    """Daily reference evapotranspiration ET0, mm/day (Eq. 6). All array inputs broadcast together."""
    es = (saturation_vapour_pressure(t_max) + saturation_vapour_pressure(t_min)) / 2.0  # Eq. 12
    ra = extraterrestrial_radiation(lat_rad, day_of_year)
    rn = net_radiation(rs, ra, t_max, t_min, ea, elevation_m)
    delta = slope_vapour_pressure_curve(t_mean)
    gamma = 0.000665 * pressure_kpa  # Eq. 8
    numerator = 0.408 * delta * rn + gamma * (900.0 / (t_mean + 273.0)) * u2 * (es - ea)
    et0 = numerator / (delta + gamma * (1.0 + 0.34 * u2))
    return np.maximum(et0, 0.0)
