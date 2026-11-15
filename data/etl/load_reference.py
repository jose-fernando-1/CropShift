"""Loads reference tables into the database through the backend repositories. Every step is idempotent.

python -m data etl load-reference
"""

import csv
import json
import logging
from datetime import UTC, datetime

from app.core.database import SessionLocal
from app.repositories.climate import ClimateRepository
from app.repositories.crops import CropRepository
from app.repositories.geo import MunicipalityRepository
from app.repositories.reference import ReferenceRepository
from data._common.paths import PROCESSED_DIR, RAW_DIR

logger = logging.getLogger("data.etl.load_reference")


def load_catalog() -> int:
    source = PROCESSED_DIR / "catalog" / "crops.json"
    if not source.exists():
        raise SystemExit(f"{source} missing: run `python -m data extract catalog` first.")
    entries = json.loads(source.read_text(encoding="utf-8"))
    with SessionLocal() as session:
        repository = CropRepository(session)
        for entry in entries:
            repository.upsert_catalog_entry(entry)
        session.commit()
    logger.info("catalog: %d crops loaded", len(entries))
    return len(entries)


def load_municipalities() -> int:
    source = PROCESSED_DIR / "geo" / "municipalities.json"
    if not source.exists():
        raise SystemExit(f"{source} missing: run `python -m data extract ibge-geo` first.")
    records = json.loads(source.read_text(encoding="utf-8"))
    with SessionLocal() as session:
        repository = MunicipalityRepository(session)
        cells = {r["power_cell"]["id"]: r["power_cell"] for r in records}  # cells first: municipalities reference them
        for cell in cells.values():
            repository.upsert_cell(cell["id"], cell["lat"], cell["lon"])
        session.flush()
        for record in records:
            repository.upsert_municipality(record)
        session.commit()
    logger.info("municipalities: %d loaded", len(records))
    return len(records)


ZARC_DIGIT = {"0": 0, "2": 20, "3": 30, "4": 40}


def load_zarc() -> int:
    source = PROCESSED_DIR / "zarc" / "zarc_windows.csv"
    if not source.exists():
        raise SystemExit(f"{source} missing: run `python -m data extract zarc` first.")
    with source.open(encoding="utf-8", newline="") as handle:
        windows = [
            {
                "municipality_code": r["municipality_code"],
                "crop_id": r["crop_id"],
                "soil_code": int(r["soil_code"]),
                "cycle_code": r["cycle_code"],
                "ordinance": r["ordinance"],
                "season": r["season"],
                "climate": r["climate"],
                "values": [ZARC_DIGIT[c] for c in r["values"]],
            }
            for r in csv.DictReader(handle)
        ]
    with SessionLocal() as session:
        ReferenceRepository(session).replace_zarc(windows)
        session.commit()
    logger.info("zarc: %d windows loaded", len(windows))
    return len(windows)


def load_pam() -> int:
    source = PROCESSED_DIR / "pam" / "pam_pe.csv"
    if not source.exists():
        raise SystemExit(f"{source} missing: run `python -m data extract ibge-pam` first.")

    def number(raw: str) -> float | None:
        return float(raw) if raw else None

    with source.open(encoding="utf-8", newline="") as handle:
        rows = [
            {
                "municipality_code": r["cod_mun"],
                "pam_crop": r["cultura"],
                "year": int(r["ano"]),
                "yield_kg_ha": float(r["rendimento_kg_ha"]),
                "harvested_area_ha": number(r["area_colhida_ha"]),
                "production_t": number(r["producao_t"]),
            }
            for r in csv.DictReader(handle)
        ]
    with SessionLocal() as session:
        ReferenceRepository(session).replace_pam(rows)
        session.commit()
    logger.info("pam: %d municipality-years loaded", len(rows))
    return len(rows)


def _retrieved_at(directory) -> datetime:
    """When a source was really fetched: the manifest next to its raw files (now, if it has none)."""
    manifest = directory / "manifest.json"
    if manifest.exists():
        return datetime.fromisoformat(json.loads(manifest.read_text(encoding="utf-8"))["retrieved_at"])
    return datetime.now(UTC)


def record_dataset_versions() -> None:
    """One `dataset_versions` row per reference dataset, with its real retrieval time."""
    zarc_season = next(
        csv.DictReader((PROCESSED_DIR / "zarc" / "zarc_windows.csv").open(encoding="utf-8", newline=""))
    )["season"]
    entries = [
        ("MAPA ZARC", zarc_season, "https://dados.agricultura.gov.br/dataset/tabua-de-risco-zoneamento-agricola-de-risco-climatico",
         "CC BY", RAW_DIR / "mapa_zarc"),
        ("IBGE PAM", "2005-2024", "https://sidra.ibge.gov.br/tabela/5457", "IBGE open data", RAW_DIR / "ibge_pam"),
        ("IBGE municipal mesh v3", "qualidade=minima", "https://servicodados.ibge.gov.br/api/docs/malhas?versao=3",
         "IBGE open data", RAW_DIR / "ibge_geo"),
        ("FAO-56 / EcoCrop crop sheet", "v1", "https://www.fao.org/4/x0490e/x0490e00.htm",
         "FAO-56 transcribed; EcoCrop licence unconfirmed", PROCESSED_DIR / "catalog"),
    ]  # fmt: skip
    with SessionLocal() as session:
        repository = ClimateRepository(session)
        for name, version, url, licence, directory in entries:
            repository.upsert_dataset_version(
                name, version, url=url, licence=licence, retrieved_at=_retrieved_at(directory)
            )
        session.commit()
    logger.info("dataset versions recorded")


def run() -> None:
    load_catalog()
    load_municipalities()
    load_zarc()
    load_pam()
    record_dataset_versions()
