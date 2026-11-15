from datetime import date

from sqlalchemy import delete, extract, func, select
from sqlalchemy.orm import Session

from app.integrations.nasa_power import PARAMETERS, PowerSeries
from app.models.climate import ClimateDaily, DatasetVersion
from app.models.geo import ClimateCell

COLUMNS = [column for column, _ in PARAMETERS.values()]  # ClimateDaily column per POWER parameter, in order


class ClimateRepository:
    def __init__(self, db: Session):
        self.db = db

    def replace_series(self, cell_id: str, series: PowerSeries) -> int:
        """Replace one cell's daily rows (bulk COPY). Bit i of `quality` is set when COLUMNS[i] is missing that day."""
        self.db.execute(delete(ClimateDaily).where(ClimateDaily.cell_id == cell_id))
        names = list(PARAMETERS)
        copy_sql = f"COPY climate_daily (cell_id, day, {', '.join(COLUMNS)}, quality) FROM STDIN"
        driver_cursor = self.db.connection().connection.cursor()
        with driver_cursor.copy(copy_sql) as copy:
            for i, day in enumerate(series.days):
                row = [series.values[name][i] for name in names]
                quality = sum(1 << bit for bit, value in enumerate(row) if value is None)
                copy.write_row([cell_id, day, *row, quality])
        cell = self.db.get(ClimateCell, cell_id)
        if cell is not None and series.elevation_m is not None:
            cell.elevation_m = series.elevation_m
        return len(series.days)

    def load_series(self, cell_id: str, start: date, end: date) -> list[ClimateDaily]:
        stmt = (
            select(ClimateDaily)
            .where(ClimateDaily.cell_id == cell_id, ClimateDaily.day.between(start, end))
            .order_by(ClimateDaily.day)
        )
        return list(self.db.scalars(stmt))

    def cells_with_data(self) -> list[str]:
        return list(self.db.scalars(select(ClimateDaily.cell_id).distinct().order_by(ClimateDaily.cell_id)))

    def coverage(self, cell_id: str) -> dict:
        row = self.db.execute(
            select(
                func.min(ClimateDaily.day),
                func.max(ClimateDaily.day),
                func.count(),
                func.count().filter(ClimateDaily.quality > 0),
            ).where(ClimateDaily.cell_id == cell_id)
        ).one()
        return {"first_day": row[0], "last_day": row[1], "days": row[2], "days_with_gaps": row[3]}

    def upsert_dataset_version(self, name: str, version: str, **fields) -> None:
        existing = self.db.scalars(
            select(DatasetVersion).where(DatasetVersion.name == name, DatasetVersion.version == version)
        ).first()
        if existing is None:
            self.db.add(DatasetVersion(name=name, version=version, **fields))
        else:
            for key, value in fields.items():
                setattr(existing, key, value)

    def climate_summary(self, cell_id: str, last_full_year: int) -> tuple[float | None, float | None]:
        """(mean annual rain mm over complete years up to `last_full_year`, mean air temperature °C) of a cell."""
        years = (
            select(extract("year", ClimateDaily.day).label("y"), func.sum(ClimateDaily.prectotcorr).label("rain"))
            .where(ClimateDaily.cell_id == cell_id, ClimateDaily.day < date(last_full_year + 1, 1, 1))
            .group_by("y")
            .subquery()
        )
        rain = self.db.execute(select(func.avg(years.c.rain))).scalar()
        temp = self.db.execute(select(func.avg(ClimateDaily.t2m)).where(ClimateDaily.cell_id == cell_id)).scalar()
        return (None if rain is None else float(rain), None if temp is None else float(temp))

    def dataset_versions(self) -> list[DatasetVersion]:
        return list(self.db.scalars(select(DatasetVersion).order_by(DatasetVersion.name)))
