"""Pure geometry helpers: the NASA POWER grid cell of a point, polygon centroids, accent folding.

Ported 1:1 from `web/src/lib/domain/geo.ts` so a point resolves to the same cell id in the web mock and here
(`backend/tests/unit/test_geo.py` checks all 185 municipalities against the web fixture).
"""

import math
import unicodedata

# NASA POWER daily grid (MERRA-2): 0.5° latitude x 0.625° longitude.
POWER_LAT_STEP = 0.5
POWER_LON_STEP = 0.625


def js_round(value: float) -> int:
    """JavaScript's Math.round (half up), unlike Python's banker's rounding."""
    return math.floor(value + 0.5)


def round_to(value: float, digits: int) -> float:
    factor = 10**digits
    return js_round(value * factor) / factor


def power_cell(lat: float, lon: float) -> dict:
    row = js_round((lat + 90) / POWER_LAT_STEP)
    col = js_round((lon + 180) / POWER_LON_STEP)
    return {
        "id": f"r{row}c{col}",
        "lat": round_to(-90 + row * POWER_LAT_STEP, 4),
        "lon": round_to(-180 + col * POWER_LON_STEP, 4),
    }


def fold_accents(text: str) -> str:
    """Lowercase, accent-free form used for search."""
    return "".join(c for c in unicodedata.normalize("NFD", text) if not unicodedata.combining(c)).lower()


def polygon_centroid(geometry: dict) -> tuple[float, float]:
    """Area-weighted centroid of a (Multi)Polygon's outer rings, returned as (lon, lat)."""
    polygons = [geometry["coordinates"]] if geometry["type"] == "Polygon" else geometry["coordinates"]
    area = cx = cy = 0.0
    for polygon in polygons:
        ring = polygon[0]
        for i in range(len(ring)):
            x0, y0 = ring[i - 1]
            x1, y1 = ring[i]
            cross = x0 * y1 - x1 * y0
            area += cross
            cx += (x0 + x1) * cross
            cy += (y0 + y1) * cross
    if area == 0:
        x, y = polygons[0][0][0]  # degenerate polygon: first vertex, as the web does
        return x, y
    return cx / (3 * area), cy / (3 * area)
