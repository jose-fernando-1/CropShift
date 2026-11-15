from datetime import date

import pytest

from app.engines.dekads import dekad_end, dekad_length_days, dekad_of, planting_date, season_end, shift_dekad


def test_calendar_anchors():
    assert planting_date(2023, 1) == date(2023, 1, 1)
    assert planting_date(2023, 36) == date(2023, 12, 21)
    assert dekad_end(2023, 36) == date(2023, 12, 31)
    assert planting_date(2023, 14) == date(2023, 5, 11)  # ZARC cowpea window example: dekad 14 starts 11 May


def test_february_has_8_or_9_days_in_its_last_dekad():
    assert dekad_length_days(2023, 6) == 8
    assert dekad_length_days(2024, 6) == 9
    assert dekad_end(2024, 6) == date(2024, 2, 29)


def test_dekad_lengths_sum_to_the_year():
    for year in (2023, 2024):
        assert sum(dekad_length_days(year, d) for d in range(1, 37)) == (366 if year == 2024 else 365)


def test_every_day_belongs_to_the_dekad_that_contains_it():
    day = date(2024, 1, 1)
    while day.year == 2024:
        d = dekad_of(day)
        assert planting_date(2024, d) <= day <= dekad_end(2024, d)
        day = date.fromordinal(day.toordinal() + 1)


def test_wrap_around_and_season_crossing_the_year_end():
    assert shift_dekad(36, 1) == 1 and shift_dekad(1, -1) == 36 and shift_dekad(34, 5) == 3
    assert season_end(2023, 36, 110) == date(2024, 4, 8)


def test_out_of_range_dekad_is_rejected():
    for bad in (0, 37, -1):
        with pytest.raises(ValueError, match=r"1\.\.36"):
            planting_date(2023, bad)
