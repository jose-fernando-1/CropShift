"""The 36-dekad (decêndio) calendar. Pure functions, no I/O.

Dekad 1 = Jan 1-10 (an assumption of the contract and the ZARC reading, still to confirm in the ZARC
ordinances). Each month has three dekads: days 1-10, 11-20 and 21-end (8 to 11 days; February has 8 or 9).
The representative planting date of a dekad is its FIRST day: `planting_date`.
"""

import calendar
from datetime import date, timedelta

DEKADS_PER_YEAR = 36
FIRST_DEKAD_STARTS_ON_JAN_1 = True  # the single place the assumption lives


def dekad_of(day: date) -> int:
    """1-based dekad of a calendar day."""
    part = min((day.day - 1) // 10, 2)
    return (day.month - 1) * 3 + part + 1


def planting_date(year: int, dekad: int) -> date:
    """First day of `dekad` in `year`: the representative planting date used by the simulation."""
    _check(dekad)
    month, part = divmod(dekad - 1, 3)
    return date(year, month + 1, 1 + 10 * part)


def dekad_end(year: int, dekad: int) -> date:
    _check(dekad)
    month, part = divmod(dekad - 1, 3)
    last = calendar.monthrange(year, month + 1)[1]
    return date(year, month + 1, 10 * (part + 1) if part < 2 else last)


def dekad_length_days(year: int, dekad: int) -> int:
    return (dekad_end(year, dekad) - planting_date(year, dekad)).days + 1


def shift_dekad(dekad: int, steps: int) -> int:
    """Move `steps` dekads forward (negative = back), wrapping past the end of the year: 36 + 1 -> 1."""
    _check(dekad)
    return (dekad - 1 + steps) % DEKADS_PER_YEAR + 1


def season_end(year: int, dekad: int, cycle_days: int) -> date:
    """Last day of a season planted on the dekad's first day (may fall in the next calendar year)."""
    return planting_date(year, dekad) + timedelta(days=cycle_days - 1)


def _check(dekad: int) -> None:
    if not 1 <= dekad <= DEKADS_PER_YEAR:
        raise ValueError(f"dekad must be 1..36, got {dekad}")
