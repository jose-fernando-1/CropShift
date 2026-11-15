"""POST /api/v1/locations/resolve: PostGIS point-in-polygon against the real IBGE mesh."""

import pytest
from sqlalchemy import text

pytestmark = pytest.mark.db

PILOT = {"lat": -8.60, "lon": -36.40}  # Sao Bento do Una


@pytest.fixture(autouse=True)
def _db(database):
    return database  # municipalities come from the committed demo seed (conftest.database)


def resolve(client, body, **headers):
    return client.post("/api/v1/locations/resolve", json=body, headers=headers)


def test_pilot_point_matches_contract_example(client, assert_contract, contract_dir):
    import json

    response = resolve(client, PILOT)
    assert response.status_code == 200
    assert_contract("resolve-response", response.json())
    example = json.loads((contract_dir / "examples/resolve-response.covered.json").read_text(encoding="utf-8"))
    expected = example["municipality"]
    assert response.json()["municipality"] == expected
    assert response.json()["mock"] is False


@pytest.mark.parametrize(
    ("name", "lat", "lon", "covered"),
    [
        ("Recife (urban)", -8.05, -34.90, True),
        ("Petrolina", -9.39, -40.50, True),
        ("Sorriso-MT", -12.54, -55.71, False),
        ("open ocean", 0.0, -30.0, False),
    ],
)
def test_coverage(client, assert_contract, name, lat, lon, covered):
    body = resolve(client, {"lat": lat, "lon": lon}).json()
    assert_contract("resolve-response", body)
    assert (body["coverage"] == "covered") is covered, name
    assert (body["municipality"] is not None) is covered


def test_every_municipality_resolves_to_itself(client, database):
    """An interior point of each of the 185 polygons resolves to that municipality's code."""
    with database.connect() as connection:
        rows = connection.execute(
            text(
                "SELECT code, ST_Y(p), ST_X(p) "
                "FROM (SELECT code, ST_PointOnSurface(geom) AS p FROM municipalities) m ORDER BY code"
            )
        ).all()
    assert len(rows) == 185
    for code, lat, lon in rows:
        body = resolve(client, {"lat": lat, "lon": lon}).json()
        assert body["municipality"]["municipality_code"] == code


def test_near_centroid_flag(client, database):
    with database.connect() as connection:
        code, lat, lon, cell = connection.execute(
            text("SELECT code, centroid_lat, centroid_lon, power_cell_id FROM municipalities WHERE code = '2613008'")
        ).one()
    near = resolve(client, {"lat": lat, "lon": lon}).json()["municipality"]
    assert near["municipality_code"] == code and near["near_centroid"] is True and near["power_cell"]["id"] == cell


def test_invalid_coordinates_are_localized_and_not_echoed(client, assert_contract):
    response = resolve(client, {"lat": 123.456, "lon": -36.4}, **{"Accept-Language": "pt-BR"})
    assert response.status_code == 422
    assert_contract("api-error", response.json())
    assert response.json()["error"]["code"] == "invalid_coordinates"
    assert response.json()["error"]["message"].startswith("A latitude")
    assert "123.456" not in response.text
    assert response.headers["content-language"] == "pt-BR"


def test_missing_fields_are_invalid_request(client, assert_contract):
    response = client.post("/api/v1/locations/resolve", json={"lat": -8.6})
    assert response.status_code == 422
    assert_contract("api-error", response.json())
    assert response.json()["error"]["code"] == "invalid_request"
