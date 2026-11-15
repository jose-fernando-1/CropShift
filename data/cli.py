"""Entry point: `python -m data <command>` (from the repo root, with PYTHONPATH=backend:.)."""

import logging
from pathlib import Path

import click

from data._common.env import load_env


@click.group(context_settings={"help_option_names": ["-h", "--help"]})
@click.option("-v", "--verbose", is_flag=True, help="Debug logging.")
def main(verbose: bool) -> None:
    """Cropshift data tooling: extraction scripts, ETL, validation. See data/README.md."""
    logging.basicConfig(
        level=logging.DEBUG if verbose else logging.INFO, format="%(asctime)s | %(levelname)s | %(name)s | %(message)s"
    )
    logging.getLogger("httpx").setLevel(logging.WARNING)  # its INFO lines print full URLs
    load_env()


@main.command()
@click.option("--strict", is_flag=True, help="Exit non-zero if any check is not OK.")
def doctor(strict: bool) -> None:
    """Check every source, credential and the database; print the fix for each failure."""
    from data.doctor import OK, run_doctor

    results = run_doctor()
    width = max(len(r.name) for r in results)
    for r in results:
        click.echo(f"[{r.status:<7}] {r.name:<{width}}  {r.detail}")
        if r.hint:
            click.echo(f"{'':<10}{'':<{width}}  -> {r.hint}")
    if strict and any(r.status != OK for r in results):
        raise SystemExit(1)


@main.command("load-demo")
@click.option("--force", is_flag=True, help="Replace seeded tables even if the database already has data.")
def load_demo(force: bool) -> None:
    """Load the committed demo dataset (data/demo) into the database. No network, no credentials."""
    from data.etl.load_demo import run

    run(force)


@main.group()
def extract() -> None:
    """Extraction / derivation scripts, one per source (writes data/raw or data/processed)."""


@extract.command("catalog")
def extract_catalog() -> None:
    """Derive data/processed/catalog/crops.json from the FAO-56 + EcoCrop crop sheet (offline)."""
    from data.sources.fao_ecocrop.build_catalog import run

    run()


@extract.command("ibge-geo")
def extract_ibge_geo() -> None:
    """Download the PE municipal mesh and names from IBGE; derive centroids and POWER cells."""
    from data.sources.ibge_geo.extract import run

    run()


@extract.command("power")
@click.option("--cells", "scope", type=click.Choice(["pilot", "all"]), default="pilot", show_default=True)
@click.option("--force", is_flag=True, help="Refetch cells that are already downloaded.")
def extract_power(scope: str, force: bool) -> None:
    """Download NASA POWER daily series (1984-2024) per climate cell centre. Public, no key."""
    from data.sources.nasa_power.extract import run

    run(scope, force)


@extract.command("soilgrids")
@click.option("--workers", default=4, show_default=True, help="Parallel requests (the API is slow, not strict).")
@click.option("--limit", type=int, default=None, help="Fetch at most N municipalities (for trials).")
def extract_soilgrids(workers: int, limit: int | None) -> None:
    """Download SoilGrids soil properties at each municipality centroid. Resumable; public, no key."""
    from data.sources.soilgrids.extract import run

    run(workers, limit)


@extract.command("ibge-pam")
def extract_ibge_pam() -> None:
    """Download PAM yields for PE municipalities from IBGE SIDRA (table 5457), 2005-2024. Public, no key."""
    from data.sources.ibge_pam.extract import run

    run()


@extract.command("zarc")
@click.option("--file", "file", type=click.Path(exists=True, dir_okay=False, path_type=Path), default=None)
def extract_zarc(file: Path | None) -> None:
    """Ingest a ZARC safra CSV (manual browser download) and derive the per-crop windows."""
    from data.sources.mapa_zarc.extract import run

    run(file)


@extract.command("appeears")
@click.option("--start", default="01-01-2024", show_default=True, help="MM-DD-YYYY")
@click.option("--end", default="12-31-2024", show_default=True, help="MM-DD-YYYY")
def extract_appeears(start: str, end: str) -> None:
    """Extract SMAP/MODIS/NASADEM point samples at the pilot point via AppEEARS (needs Earthdata credentials)."""
    from data.sources.earthdata_appeears.extract import run

    run(start, end)


@main.group()
def etl() -> None:
    """Normalize, merge and load steps, in run order."""


@etl.command("load-reference")
def etl_load_reference() -> None:
    """Load reference tables (crop catalog, ...) into the database. Idempotent."""
    from data.etl.load_reference import run

    run()


@etl.command("load-climate")
def etl_load_climate() -> None:
    """Load downloaded POWER series into climate_daily. Idempotent per cell."""
    from data.etl.load_climate import run

    run()


@etl.command("load-soil")
def etl_load_soil() -> None:
    """Load downloaded SoilGrids profiles and derive each municipality's default soil class."""
    from data.etl.load_soil import run

    run()


@etl.command("precompute-windows")
@click.option("--cell", default=None, help="Only this climate cell, e.g. r163c230.")
@click.option("--crop", default=None, help="Only this crop id, e.g. cowpea.")
def etl_precompute_windows(cell: str | None, crop: str | None) -> None:
    """Simulate all cell x crop x soil combinations (rainfed) and store the 36-dekad results."""
    from data.etl.precompute_windows import run

    run(cell, crop)


@main.group()
def validate() -> None:
    """Validation of the engine against official references; writes the quality gate."""


@validate.command("gate")
def validate_gate() -> None:
    """Spearman agreement of the simulated windows with ZARC per crop; stores pass/fail on each crop."""
    from data.validate.gate import run

    run()


@etl.command("build-demo")
def etl_build_demo() -> None:
    """Export the derived tables to data/demo/*.csv.gz (the committed demo seed)."""
    from data.etl.demo_seed import build

    build()


@validate.command("report")
def validate_report() -> None:
    """Write docs/validation/report.md: pilot reproduction, gate, sensitivity, rain source and PAM check."""
    from data.validate.report import run

    run()
