"""P0: health and the error envelope follow the contract, and nothing echoes request values."""

import logging

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.core.exceptions import AppError
from app.main import app


class _Probe(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)
    soil_class: int | None = None


_probe = APIRouter()


@_probe.post("/__probe")
def probe(body: _Probe) -> dict:
    return {"ok": True}


@_probe.get("/__boom")
def boom() -> None:
    raise RuntimeError("secret internals")


@_probe.get("/__app_error")
def app_error() -> None:
    raise AppError("no_data", "no_data", 404)


app.include_router(_probe, prefix="/test")


def test_health_matches_contract(client, assert_contract):
    response = client.get("/health")
    assert response.status_code == 200
    assert_contract("health", response.json())
    assert response.json()["mock"] is False


def test_api_info(client):
    response = client.get("/api/v1/")
    assert response.status_code == 200
    assert response.json()["version"] == "v1"


def test_unknown_route_uses_error_envelope(client, assert_contract):
    response = client.get("/api/v1/nope")
    assert response.status_code == 404
    assert_contract("api-error", response.json())
    assert response.json()["error"]["code"] == "not_found"


def test_method_not_allowed_uses_error_envelope(client, assert_contract):
    response = client.delete("/health")
    assert response.status_code == 405
    assert_contract("api-error", response.json())


def test_app_error_uses_error_envelope(client, assert_contract):
    response = client.get("/test/__app_error")
    assert response.status_code == 404
    assert_contract("api-error", response.json())
    assert response.json()["error"]["code"] == "no_data"


def test_unhandled_error_is_generic_500(client, assert_contract):
    response = client.get("/test/__boom")
    assert response.status_code == 500
    assert_contract("api-error", response.json())
    assert "secret" not in response.text


def test_validation_error_is_envelope_and_never_echoes_input(client, assert_contract):
    response = client.post("/test/__probe", json={"lat": "-8.123456", "lon": -36.4, "soil_class": "9.87654"})
    assert response.status_code == 422
    assert_contract("api-error", response.json())
    assert response.json()["error"]["code"] == "invalid_request"
    assert "8.123456" not in response.text and "9.87654" not in response.text


def test_out_of_range_coordinates_use_invalid_coordinates(client, assert_contract):
    response = client.post("/test/__probe", json={"lat": 123.456, "lon": -36.4})
    assert response.status_code == 422
    assert_contract("api-error", response.json())
    assert response.json()["error"]["code"] == "invalid_coordinates"
    assert "123.456" not in response.text


def test_malformed_json_does_not_echo_body(client, assert_contract):
    response = client.post("/test/__probe", content='{"lat": -8.5551, ', headers={"content-type": "application/json"})
    assert response.status_code == 422
    assert_contract("api-error", response.json())
    assert "8.5551" not in response.text


def test_request_id_is_returned_and_sanitised(client):
    assert len(client.get("/health").headers["x-request-id"]) == 16
    assert client.get("/health", headers={"X-Request-ID": "abc-123"}).headers["x-request-id"] == "abc-123"
    assert client.get("/health", headers={"X-Request-ID": "bad id\t!"}).headers["x-request-id"] != "bad id\t!"


def test_logs_have_no_query_string_or_body(client, caplog):
    with caplog.at_level(logging.INFO):
        client.post("/test/__probe?lat=-8.4242", json={"lat": -8.5551, "lon": -36.4})
    # Only the app's own records: the test client's httpx logger prints the URL it was given.
    app_logs = "\n".join(r.getMessage() for r in caplog.records if r.name.startswith("app"))
    assert "-8.4242" not in app_logs and "-8.5551" not in app_logs
    assert "/test/__probe" in app_logs
