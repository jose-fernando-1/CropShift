"""NASA POWER daily API client (public, no key). Fetches one point's series; never decides anything.

Docs: https://power.larc.nasa.gov/docs/services/api/temporal/daily/
Fill value -999 means "missing" and becomes None here; units are POWER's (see PARAMETERS).
"""

from dataclasses import dataclass
from datetime import date

import httpx

from app.integrations.http import ExternalServiceError, get_with_retry, make_client

BASE_URL = "https://power.larc.nasa.gov/api/temporal/daily/point"
FILL_VALUE = -999.0

# POWER parameter -> (ClimateDaily column, unit). Radiation exists only from 1984.
PARAMETERS: dict[str, tuple[str, str]] = {
    "T2M": ("t2m", "°C"),
    "T2M_MAX": ("t2m_max", "°C"),
    "T2M_MIN": ("t2m_min", "°C"),
    "RH2M": ("rh2m", "%"),
    "WS2M": ("ws2m", "m/s"),
    "PS": ("ps", "kPa"),
    "ALLSKY_SFC_SW_DWN": ("allsky_sfc_sw_dwn", "MJ/m²/day"),
    "PRECTOTCORR": ("prectotcorr", "mm/day"),
}


class PowerUnavailableError(ExternalServiceError):
    """POWER did not return a usable series (network, 5xx after retries, or an unexpected body)."""


@dataclass(frozen=True)
class PowerSeries:
    lat: float
    lon: float
    elevation_m: float | None
    days: list[date]
    values: dict[str, list[float | None]]  # POWER parameter name -> one value per day (None = missing)


def parse_series(payload: dict) -> PowerSeries:
    """Turn a POWER JSON body into a PowerSeries; raises PowerUnavailableError on an unexpected shape."""
    try:
        lon, lat, *rest = payload["geometry"]["coordinates"]
        parameters = payload["properties"]["parameter"]
        keys = sorted(parameters[next(iter(PARAMETERS))])
        days = [date(int(k[:4]), int(k[4:6]), int(k[6:8])) for k in keys]
        values = {
            name: [None if (v := parameters[name][k]) == FILL_VALUE else float(v) for k in keys] for name in PARAMETERS
        }
    except (KeyError, ValueError, TypeError, StopIteration) as exc:
        raise PowerUnavailableError(f"unexpected POWER response shape ({type(exc).__name__})") from None
    return PowerSeries(lat=lat, lon=lon, elevation_m=rest[0] if rest else None, days=days, values=values)


def fetch_daily_series(
    lat: float, lon: float, start: date, end: date, client: httpx.Client | None = None
) -> tuple[PowerSeries, bytes]:
    """Download the daily AG-community series of a point: the parsed series and the raw body (for archiving)."""
    params = {
        "parameters": ",".join(PARAMETERS),
        "community": "AG",
        "longitude": lon,
        "latitude": lat,
        "start": start.strftime("%Y%m%d"),
        "end": end.strftime("%Y%m%d"),
        "format": "JSON",
    }
    owns_client = client is None
    client = client or make_client(timeout_s=120.0)
    try:
        response = get_with_retry(client, BASE_URL, params=params, retries=3, backoff_s=5.0)
    finally:
        if owns_client:
            client.close()
    if response.status_code != 200:
        raise PowerUnavailableError(f"POWER answered HTTP {response.status_code}", response.status_code)
    try:
        payload = response.json()
    except ValueError:
        raise PowerUnavailableError("POWER answered with a non-JSON body") from None
    return parse_series(payload), response.content
