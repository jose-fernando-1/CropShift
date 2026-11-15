"""Downloads IBGE PAM (Produção Agrícola Municipal, SIDRA table 5457) for Pernambuco, 2005-2024. Public, no key.

    python -m data extract ibge-pam

One request per product (nine crops). Writes data/raw/ibge_pam/<product>.json (API body) + manifest.json and
data/processed/pam/pam_pe.csv (cod_mun, ano, cultura, area_colhida_ha, producao_t, rendimento_kg_ha; only
municipality-years with a positive yield). PAM is a MUNICIPAL statistic that pools rainfed and irrigated areas and,
for beans, all bean types: it is context, not field-level yield.
"""

import csv
import logging

from app.integrations.sidra import BASE_URL, PRODUCTS, TABLE, fetch_product
from data._common.http import make_client
from data._common.manifest import write_manifest
from data._common.paths import processed_dir, raw_dir

logger = logging.getLogger("data.ibge_pam")

STATE = 26  # Pernambuco
YEARS = "2005-2024"


def run() -> None:
    raw = raw_dir("ibge_pam")
    records: list[tuple[str, dict]] = []
    files = []
    with make_client(timeout_s=120.0) as client:
        for label, product_id in PRODUCTS.items():
            rows, body = fetch_product(product_id, STATE, YEARS, client)
            file = raw / f"{label}.json"
            file.write_bytes(body)
            files.append(file)
            kept = [r for r in rows if r["yield_kg_ha"] and r["yield_kg_ha"] > 0]
            records.extend((label, r) for r in kept)
            logger.info("%s: %d municipality-years with yield (of %d rows)", label, len(kept), len(rows))
    write_manifest(
        raw,
        source="ibge_pam",
        url=f"{BASE_URL}/t/{TABLE}",
        params={"state": STATE, "years": YEARS, "products": PRODUCTS},
        files=files,
        licence="IBGE open data (terms of use not confirmed, see README)",
    )
    output = processed_dir("pam") / "pam_pe.csv"
    with output.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["cod_mun", "ano", "cultura", "area_colhida_ha", "producao_t", "rendimento_kg_ha"])
        for label, r in sorted(records, key=lambda x: (x[1]["municipality_code"], x[0], x[1]["year"])):
            writer.writerow(
                [r["municipality_code"], r["year"], label, r["harvested_area_ha"], r["production_t"], r["yield_kg_ha"]]
            )
    logger.info("pam: %d rows -> %s", len(records), output)
