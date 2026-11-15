"""IBGE mesh + names -> municipality records (pure; shared by the extractor and the tests)."""

from app.core.geo import fold_accents, polygon_centroid, power_cell, round_to

STATE_CODE = 26  # Pernambuco
EXPECTED_MUNICIPALITIES = 185


def build_municipalities(mesh: dict, names: list[dict]) -> list[dict]:
    """`mesh`: IBGE GeoJSON FeatureCollection (properties.codarea). `names`: localidades [{id, nome}].

    Returns records sorted by name (pt-BR order is approximated by accent-folded name) with the polygon,
    the centroid and the POWER cell of that centroid.
    """
    name_by_code = {str(item["id"]): item["nome"] for item in names}
    features = mesh["features"]
    if len(features) != EXPECTED_MUNICIPALITIES or len(name_by_code) != EXPECTED_MUNICIPALITIES:
        raise ValueError(
            f"expected {EXPECTED_MUNICIPALITIES} municipalities, got mesh={len(features)} names={len(name_by_code)}"
        )
    records = []
    for feature in features:
        code = feature["properties"]["codarea"]
        if code not in name_by_code:
            raise ValueError(f"no name for municipality {code}")
        lon, lat = polygon_centroid(feature["geometry"])
        records.append(
            {
                "code": code,
                "name": name_by_code[code],
                "search": fold_accents(name_by_code[code]),
                "centroid": {"lat": round_to(lat, 5), "lon": round_to(lon, 5)},
                "power_cell": power_cell(lat, lon),
                "geometry": feature["geometry"],
            }
        )
    return sorted(records, key=lambda r: (r["search"], r["code"]))
