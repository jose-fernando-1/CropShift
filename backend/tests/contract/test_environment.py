import pytest

pytestmark = pytest.mark.db


@pytest.fixture(autouse=True)
def _db(database):
    from sqlalchemy import text

    with database.connect() as connection:
        if connection.execute(text("SELECT count(*) FROM climate_daily")).scalar_one() == 0:
            pytest.skip(
                "climate_daily is not in the demo seed: run `python -m data extract power` + `etl load-climate`"
            )


def post(client, body):
    return client.post("/api/v1/environment", json=body)


def test_pilot_profile_matches_the_extracted_real_data(client):
    body = post(client, {"lat": -8.60, "lon": -36.40}).json()
    assert body["municipality_code"] == "2613008" and body["power_cell"]["id"] == "r163c230"
    assert body["elevation_m"] == pytest.approx(618.18) and body["climate"]["days"] == 14976
    assert body["climate"]["days_with_gaps"] == 0
    assert body["climate"]["mean_annual_rain_mm"] == pytest.approx(957, abs=15)  # 1984-2023
    assert body["default_soil_class"] == 2 and len(body["soil"]) == 3
    assert {s["id"] for s in body["sources"]} == {"nasa-power", "soilgrids"}


def test_municipality_mode_and_errors(client):
    assert post(client, {"municipality_code": "2613008"}).status_code == 200
    assert post(client, {"lat": -12.54, "lon": -55.71}).json()["error"]["code"] == "out_of_coverage"
    assert post(client, {"lat": -8.6}).json()["error"]["code"] == "invalid_request"
    assert post(client, {"lat": -8.6, "lon": -36.4, "municipality_code": "2613008"}).status_code == 422
