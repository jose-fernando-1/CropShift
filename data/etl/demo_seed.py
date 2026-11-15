"""Demo seed: export the derived tables to data/demo/*.csv.gz and load them back, with no network or credentials.

    python -m data etl build-demo     # after the full pipeline (extract + etl + validate gate)
    python -m data load-demo          # on a fresh database: loads exactly what build-demo wrote

The seed holds DERIVED tables only (catalog, municipalities with geometry, ZARC, PAM, soil, precomputed window
results, dataset versions). Raw POWER series (~80 MB) are not part of it: re-extract them to re-run the simulation.
Order matters (foreign keys): TABLES lists parents first.
"""

import gzip
import json
import logging
from datetime import UTC, datetime

from app.core.database import engine
from data._common.manifest import sha256_of
from data._common.paths import DEMO_DIR

logger = logging.getLogger("data.etl.demo_seed")

# (table, order by). Parents first. Sequences of serial ids are reset after loading.
TABLES = [
    ("crops", "id"),
    ("crop_requirements", "crop_id"),
    ("crop_growth_stages", "id"),
    ("crop_parameter_sources", "id"),
    ("climate_cells", "id"),
    ("municipalities", "code"),
    ("zarc_windows", "id"),
    ("pam_yields", "id"),
    ("soil_profiles", "id"),
    ("planting_window_results", "cell_id, crop_id, soil_class, dekad, method_version"),
    ("dataset_versions", "id"),
]
SERIAL_TABLES = [
    "crop_growth_stages",
    "crop_parameter_sources",
    "zarc_windows",
    "pam_yields",
    "soil_profiles",
    "dataset_versions",
]


def build() -> None:
    DEMO_DIR.mkdir(parents=True, exist_ok=True)
    files, counts = [], {}
    raw = engine.raw_connection()
    try:
        with raw.cursor() as cursor:
            for table, order in TABLES:
                path = DEMO_DIR / f"{table}.csv.gz"
                query = f"COPY (SELECT * FROM {table} ORDER BY {order}) TO STDOUT WITH (FORMAT csv, HEADER true)"
                with (
                    path.open("wb") as handle,
                    gzip.GzipFile("", "wb", compresslevel=9, fileobj=handle, mtime=0) as out,
                    cursor.copy(query) as copy,
                ):  # mtime=0: the same data gives the same bytes
                    for chunk in copy:
                        out.write(bytes(chunk))
                cursor.execute(f"SELECT count(*) FROM {table}")
                counts[table] = cursor.fetchone()[0]
                files.append(path)
    finally:
        raw.close()
    manifest = {
        "built_at": datetime.now(UTC).isoformat(timespec="seconds"),
        "note": "Derived tables of the Cropshift pipeline. See data/README.md. Loaded by `python -m data load-demo`.",
        "tables": [
            {
                "name": f.name.removesuffix(".csv.gz"),
                "rows": counts[f.name.removesuffix(".csv.gz")],
                "sha256": sha256_of(f),
                "bytes": f.stat().st_size,
            }
            for f in files
        ],
    }
    (DEMO_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    logger.info("demo seed built: %s", {t: counts[t] for t, _ in TABLES})


def load(force: bool = False) -> None:
    manifest_path = DEMO_DIR / "manifest.json"
    if not manifest_path.exists():
        raise SystemExit(
            "data/demo has no seed yet. Build it with `python -m data etl build-demo` (see data/README.md)."
        )
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    for entry in manifest["tables"]:
        if sha256_of(DEMO_DIR / f"{entry['name']}.csv.gz") != entry["sha256"]:
            raise SystemExit(f"data/demo/{entry['name']}.csv.gz does not match its manifest checksum")
    raw = engine.raw_connection()
    try:
        with raw.cursor() as cursor:
            cursor.execute("SELECT count(*) FROM crops")
            if cursor.fetchone()[0] and not force:
                raise SystemExit(
                    "The database already holds data; load-demo would REPLACE the seeded tables. Re-run with --force."
                )
            cursor.execute("TRUNCATE " + ", ".join(t for t, _ in TABLES) + " RESTART IDENTITY CASCADE")
            for table, _ in TABLES:
                with (
                    gzip.open(DEMO_DIR / f"{table}.csv.gz", "rb") as source,
                    cursor.copy(f"COPY {table} FROM STDIN WITH (FORMAT csv, HEADER true)") as copy,
                ):
                    while chunk := source.read(1 << 20):
                        copy.write(chunk)
            for table in SERIAL_TABLES:
                cursor.execute(
                    f"SELECT setval(pg_get_serial_sequence('{table}', 'id'), COALESCE(max(id), 1)) FROM {table}"
                )
        raw.commit()
    finally:
        raw.close()
    logger.info("demo seed loaded: %s", {e["name"]: e["rows"] for e in manifest["tables"]})
