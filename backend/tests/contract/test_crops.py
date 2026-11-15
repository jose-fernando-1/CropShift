"""GET /api/v1/crops and /crops/{id} follow the contract and the data the web mock serves."""

import json

import pytest

pytestmark = pytest.mark.db


@pytest.fixture(autouse=True)
def _db(database):
    return database


def test_crops_match_contract_schema(client, assert_contract):
    response = client.get("/api/v1/crops")
    assert response.status_code == 200
    body = response.json()
    assert_contract("crops", body)
    assert body["mock"] is False
    assert len(body["crops"]) == 11


def test_requirements_equal_contract_example(client, contract_dir):
    example = json.loads((contract_dir / "examples/crops.json").read_text(encoding="utf-8"))
    ours = {c["crop_id"]: c for c in client.get("/api/v1/crops").json()["crops"]}
    for expected in example["crops"]:
        mine = ours[expected["crop_id"]]
        for field in ("name", "scientific_name", "family", "legume", "cycle_days", "has_pam", "requirements"):
            assert mine[field] == expected[field], (expected["crop_id"], field)


def test_gate_is_not_run_until_validation_writes_it(client):
    gates = {c["crop_id"]: c["gate"] for c in client.get("/api/v1/crops").json()["crops"]}
    assert all(g["status"] in ("not_run", "passed", "failed") and g["metric"] == "spearman" for g in gates.values())


def test_portuguese_names_and_headers(client, assert_contract):
    response = client.get("/api/v1/crops", headers={"Accept-Language": "pt-BR,pt;q=0.9"})
    assert_contract("crops", response.json())
    assert response.headers["content-language"] == "pt-BR"
    names = {c["crop_id"]: c["name"] for c in response.json()["crops"]}
    assert names["cowpea"] == "Feijão-caupi" and names["castor"] == "Mamona"
    assert client.get("/api/v1/crops", headers={"Accept-Language": "fr"}).headers["content-language"] == "en"


def test_crop_detail_and_not_found(client, assert_contract):
    detail = client.get("/api/v1/crops/cowpea")
    assert detail.status_code == 200 and detail.json()["crop_id"] == "cowpea"
    missing = client.get("/api/v1/crops/not-a-crop")
    assert missing.status_code == 404
    assert_contract("api-error", missing.json())
    assert missing.json()["error"]["code"] == "not_found"
