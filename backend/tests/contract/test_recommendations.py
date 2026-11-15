"""POST /api/v1/recommendations and GET /{id}: contract, determinism, privacy and the no-mock guard."""

import json
import logging

import pytest

pytestmark = pytest.mark.db

PILOT_POINT = {"lat": -8.60, "lon": -36.40}  # Sao Bento do Una (2613008)


@pytest.fixture(autouse=True)
def _db(database):
    from sqlalchemy import text

    with database.connect() as connection:
        if connection.execute(text("SELECT count(*) FROM planting_window_results")).scalar_one() == 0:
            pytest.skip("no precomputed windows: run `python -m data etl precompute-windows`")
    return database


def post(client, body, **headers):
    return client.post("/api/v1/recommendations", json=body, headers=headers)


def test_contract_request_examples_produce_valid_responses(client, assert_contract, contract_dir):
    for name in ("recommendation-request.point.json", "recommendation-request.municipality.json"):
        body = json.loads((contract_dir / "examples" / name).read_text(encoding="utf-8"))
        assert_contract("recommendation-request", body)
        response = post(client, body)
        assert response.status_code == 200, (name, response.text[:200])
        assert_contract("recommendation", response.json())


def test_pilot_recommendation_is_real_and_complete(client, assert_contract):
    body = post(client, PILOT_POINT).json()
    assert_contract("recommendation", body)
    assert body["mock"] is False
    assert body["location"]["municipality_code"] == "2613008" and body["location"]["near_centroid"] is True
    assert body["location"]["soil_source"] == "default" and body["location"]["regime"] == "rainfed"
    ranked = [c["crop_id"] for c in body["crops"]]
    assert [c["rank"] for c in body["crops"]] == list(range(1, len(ranked) + 1))
    assert len(ranked) >= 3 and {"peanut", "sorghum"} <= set(ranked)
    excluded = {e["crop_id"]: e["reason_code"] for e in body["excluded"]}
    assert excluded["castor"] == "gate_failed"  # the prototype's known failure: the engine does not reproduce ZARC
    assert set(excluded) & set(ranked) == set()
    for crop in body["crops"]:
        assert len(crop["p_success"]) == 36 and crop["flags"] == {"engine_reliable": True, "ml_applied": False}
        assert all(d["lo"] <= d["p"] <= d["hi"] for d in crop["p_success"])


def test_no_mock_markers_anywhere(client):
    text = json.dumps(post(client, PILOT_POINT).json())
    assert "mock-synthetic" not in text and '"mock": true' not in text


def test_same_input_same_result(client):
    first, second = post(client, PILOT_POINT).json(), post(client, PILOT_POINT).json()
    for body in (first, second):
        body.pop("generated_at")
    assert first == second


def test_municipality_mode_and_user_options(client):
    body = post(client, {"municipality_code": "2613008", "soil_class": 3, "regime": "rainfed"}).json()
    assert body["location"]["input_mode"] == "municipality" and body["location"]["soil_source"] == "user"
    assert body["location"]["soil_class"] == 3 and body["location"]["near_centroid"] is True


def test_get_by_id_matches_post(client):
    created = post(client, PILOT_POINT).json()
    fetched = client.get(f"/api/v1/recommendations/{created['analysis_id']}").json()
    for body in (created, fetched):
        body.pop("generated_at")
    assert created == fetched


def test_irrigated_regime_excludes_every_crop_with_a_reason(client, assert_contract):
    body = post(client, {**PILOT_POINT, "regime": "irrigated"}).json()
    assert_contract("recommendation", body)
    assert body["crops"] == [] and len(body["excluded"]) == 11
    assert {e["reason_code"] for e in body["excluded"]} == {"no_data_for_regime"}


def test_portuguese(client, assert_contract):
    response = post(client, PILOT_POINT, **{"Accept-Language": "pt-BR"})
    body = response.json()
    assert_contract("recommendation", body)
    assert response.headers["content-language"] == "pt-BR"
    assert any(c["name"] == "Amendoim" for c in body["crops"])
    assert body["disclaimers"][0]["text"].startswith("O clima vem")


@pytest.mark.parametrize(
    ("payload", "code"),
    [
        ({"lat": -12.54, "lon": -55.71}, "out_of_coverage"),  # Sorriso-MT
        ({"municipality_code": "5300108"}, "out_of_coverage"),  # Brasilia
        ({"lat": 95, "lon": -36.4}, "invalid_coordinates"),
        ({"lat": -8.6, "lon": -36.4, "municipality_code": "2613008"}, "invalid_request"),  # never both
        ({"lat": -8.6}, "invalid_request"),
        ({"municipality_code": "261300"}, "invalid_request"),
        ({"lat": -8.6, "lon": -36.4, "soil_class": 4}, "invalid_request"),
        ({"lat": -8.6, "lon": -36.4, "regime": "flooded"}, "invalid_request"),
        ({"lat": -8.6, "lon": -36.4, "extra": 1}, "invalid_request"),
    ],
)
def test_invalid_requests_use_the_error_envelope(client, assert_contract, payload, code):
    response = post(client, payload)
    assert response.status_code == 422
    assert_contract("api-error", response.json())
    assert response.json()["error"]["code"] == code


def test_unknown_id_is_not_found(client, assert_contract):
    response = client.get("/api/v1/recommendations/csa_mvp-1_9999999.2.d.r.d.p.1")
    assert response.status_code == 404
    assert_contract("api-error", response.json())
    assert client.get("/api/v1/recommendations/not-an-id").status_code == 404


def test_coordinates_never_reach_the_response_or_the_logs(client, caplog):
    secret = {"lat": -8.612345, "lon": -36.487654}
    with caplog.at_level(logging.DEBUG):
        response = post(client, secret)
    assert response.status_code == 200
    app_logs = "\n".join(r.getMessage() for r in caplog.records if r.name.startswith("app"))
    for needle in ("8.612345", "36.487654"):
        assert needle not in response.text and needle not in app_logs
