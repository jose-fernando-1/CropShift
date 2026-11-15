"""`python -m data load-demo`: load the committed demo seed into the database (see demo_seed.py)."""

from data.etl.demo_seed import load


def run(force: bool = False) -> None:
    load(force)
