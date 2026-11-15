"""ISRIC SoilGrids 2.0 REST client (public, no key, CC BY 4.0). Returns soil attributes; never decides anything.

The public API is slow and sometimes down (one call can take 1-80 s), so the app never calls it per request:
`data/` extracts it offline for the municipality centroids and the API reads the database.
"""

from dataclasses import dataclass

import httpx

from app.integrations.http import ExternalServiceError, get_with_retry, make_client

BASE_URL = "https://rest.isric.org/soilgrids/v2.0/properties/query"
PROPERTIES = ("clay", "sand", "silt", "phh2o", "soc", "bdod")
DEPTHS = ("0-5cm", "5-15cm", "15-30cm")
DEPTH_THICKNESS_CM = {"0-5cm": 5, "5-15cm": 10, "15-30cm": 15}

# SoilGrids "mapped" integer -> physical unit we store.
SCALE = {
    "clay": 1.0,  # g/kg
    "sand": 1.0,  # g/kg
    "silt": 1.0,  # g/kg
    "phh2o": 0.1,  # pH*10 -> pH
    "soc": 0.1,  # dg/kg -> g/kg
    "bdod": 0.01,  # cg/cm3 -> g/cm3
}
COLUMN = {
    "clay": "clay_g_kg",
    "sand": "sand_g_kg",
    "silt": "silt_g_kg",
    "phh2o": "ph",
    "soc": "soc_g_kg",
    "bdod": "bulk_density_g_cm3",
}


class SoilGridsUnavailableError(ExternalServiceError):
    """SoilGrids did not return a usable answer (network, 5xx after retries, rate limit, odd body)."""


@dataclass(frozen=True)
class SoilProfileValues:
    depth: str
    clay_g_kg: float | None
    sand_g_kg: float | None
    silt_g_kg: float | None
    ph: float | None
    soc_g_kg: float | None
    bulk_density_g_cm3: float | None


def parse_profiles(payload: dict) -> list[SoilProfileValues]:
    """One record per depth. A null `mean` (masked cell: urban, water) stays None, never 0."""
    try:
        layers = {layer["name"]: layer["depths"] for layer in payload["properties"]["layers"]}
        records = []
        for depth in DEPTHS:
            values: dict[str, float | None] = {}
            for prop in PROPERTIES:
                entry = next(d for d in layers[prop] if d["label"] == depth)
                mean = entry["values"].get("mean")
                values[COLUMN[prop]] = None if mean is None else round(mean * SCALE[prop], 4)
            records.append(SoilProfileValues(depth=depth, **values))
    except (KeyError, StopIteration, TypeError) as exc:
        raise SoilGridsUnavailableError(f"unexpected SoilGrids response shape ({type(exc).__name__})") from None
    return records


def fetch_point(lat: float, lon: float, client: httpx.Client | None = None) -> tuple[dict, bytes]:
    """Query all properties and depths at a point. Returns the parsed JSON and the raw body (for archiving)."""
    params: list[tuple[str, str | float]] = [("lon", lon), ("lat", lat), ("value", "mean")]
    params += [("property", p) for p in PROPERTIES] + [("depth", d) for d in DEPTHS]
    owns_client = client is None
    client = client or make_client(timeout_s=180.0)
    try:
        response = get_with_retry(client, BASE_URL, params=params, retries=3, backoff_s=10.0)
    finally:
        if owns_client:
            client.close()
    if response.status_code != 200:
        raise SoilGridsUnavailableError(f"SoilGrids answered HTTP {response.status_code}", response.status_code)
    try:
        return response.json(), response.content
    except ValueError:
        raise SoilGridsUnavailableError("SoilGrids answered with a non-JSON body") from None


def default_soil_class(profiles: list[SoilProfileValues]) -> int | None:
    """ZARC texture class from the thickness-weighted clay content of 0-30 cm: <15% -> 1, 15-35% -> 2, >35% -> 3.

    Returns None when clay is missing at any depth (masked cell), so the caller can say the class is a fallback.
    """
    total = weighted = 0.0
    for profile in profiles:
        if profile.clay_g_kg is None:
            return None
        weight = DEPTH_THICKNESS_CM[profile.depth]
        total += weight
        weighted += weight * profile.clay_g_kg
    clay_percent = weighted / total / 10
    return 1 if clay_percent < 15 else 2 if clay_percent <= 35 else 3
