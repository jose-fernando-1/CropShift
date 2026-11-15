"""IBGE SIDRA API client for the Produção Agrícola Municipal (PAM, table 5457). Public, no key.

Docs: https://apisidra.ibge.gov.br/ . One request per product keeps each answer under SIDRA's 100,000-value limit.
Missing values come as '-', '..', '...' or 'X': they become None, never 0.
"""

import httpx

from app.integrations.http import ExternalServiceError, get_with_retry, make_client

BASE_URL = "https://apisidra.ibge.gov.br/values"
TABLE = 5457
VARIABLES = {112: "yield_kg_ha", 214: "production_t", 216: "harvested_area_ha"}  # SIDRA variable id -> field
# PAM product ids (classification 782) of the crops the crop sheet covers.
PRODUCTS = {
    "algodao_herb": 40099,
    "amendoim": 40101,
    "batata_doce": 40104,
    "feijao": 40112,
    "girassol": 40114,
    "mamona": 40118,
    "mandioca": 40119,
    "milho": 40122,
    "sorgo": 40125,
}


class SidraUnavailableError(ExternalServiceError):
    """SIDRA did not answer or answered something unexpected."""


def _number(raw: str) -> float | None:
    try:
        return float(raw)
    except ValueError:
        return None


def fetch_product(
    product_id: int, state: int, years: str, client: httpx.Client | None = None
) -> tuple[list[dict], bytes]:
    """All municipalities of a state, all years, 3 variables, for one product.

    `years` is a SIDRA period like "2005-2024". Returns one record per municipality-year with the three fields
    (None when SIDRA reports no value) and the raw body.
    """
    variables = ",".join(str(v) for v in VARIABLES)
    url = f"{BASE_URL}/t/{TABLE}/n6/in%20n3%20{state}/v/{variables}/p/{years}/c782/{product_id}"
    owns_client = client is None
    client = client or make_client(timeout_s=120.0)
    try:
        response = get_with_retry(client, url, params={"formato": "json"}, retries=3, backoff_s=5.0)
    finally:
        if owns_client:
            client.close()
    if response.status_code != 200:
        raise SidraUnavailableError(f"SIDRA answered HTTP {response.status_code}", response.status_code)
    try:
        rows = response.json()[1:]  # first element is the header
        merged: dict[tuple[str, int], dict] = {}
        for row in rows:
            key = (row["D1C"], int(row["D3C"]))
            record = merged.setdefault(
                key, {"municipality_code": row["D1C"], "year": int(row["D3C"]), **dict.fromkeys(VARIABLES.values())}
            )
            record[VARIABLES[int(row["D2C"])]] = _number(row["V"])
    except (KeyError, ValueError, TypeError, IndexError) as exc:
        raise SidraUnavailableError(f"unexpected SIDRA response shape ({type(exc).__name__})") from None
    return list(merged.values()), response.content
