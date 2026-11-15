"""Recommendation use case: puts stored data, pure engines and text together into the contract's payload.

Flow: resolve the place, apply defaults, then per crop read the precomputed 36-dekad curve (rainfed), attach the ZARC
window and PAM yields, check the quality gate AT THIS PLACE (does the engine's curve agree with ZARC here?), rank
deterministically and explain. Nothing is simulated or fetched per request.
"""

import re
import statistics
from dataclasses import dataclass
from datetime import UTC, datetime

from app.core.config import settings
from app.core.exceptions import AppError
from app.core.i18n import Locale
from app.engines.calibration import CalibrationInput, Calibrator, IdentityCalibrator
from app.engines.confidence import assess_confidence
from app.engines.dekads import DEKADS_PER_YEAR, shift_dekad
from app.engines.suitability import assess_suitability
from app.engines.water_balance import SOIL_THETA_AW
from app.engines.windows import GOOD_WINDOW_P, best_windows, ranking_score, spearman
from app.models.catalog import Crop
from app.models.geo import Municipality
from app.models.reference import ZarcWindow
from app.repositories.climate import ClimateRepository
from app.repositories.crops import CropRepository
from app.repositories.geo import MunicipalityRepository
from app.repositories.reference import ReferenceRepository
from app.repositories.soil import SoilRepository
from app.repositories.windows import WindowRepository
from app.schemas.locations import Coordinates
from app.schemas.recommendations import (
    Confidence,
    DatasetVersion,
    DekadProbability,
    Disclaimer,
    ExcludedCrop,
    Flags,
    Location,
    MunicipalityRequest,
    Pam,
    PlantingWindow,
    PointRequest,
    RankedCrop,
    Recommendation,
    RecommendationRequest,
    Source,
    Zarc,
)
from app.services import recommendation_text as text
from app.services.location_service import LocationService, municipality_cell
from app.services.simulation_service import LAST_SEASON

GATE_THRESHOLD = 0.7
DEFAULT_SOIL_CLASS = 2
ANALYSIS_ID_PATTERN = re.compile(
    r"^csa_(?P<method>[A-Za-z0-9.~-]+)_(?P<code>\d{7})\.(?P<soil>[123])\.(?P<ss>[ud])\.(?P<regime>[ri])\.(?P<rs>[ud])\.(?P<mode>[pm])\.(?P<near>[01])$"
)

POWER_SOURCE = Source(
    id="nasa-power",
    name="NASA POWER daily (1984–2024)",
    url="https://power.larc.nasa.gov/docs/services/api/temporal/daily/",
    version="daily, 0.5° × 0.625°",
)
FAO56_SOURCE = Source(
    id="fao56",
    name="FAO-56 crop coefficients and stage lengths",
    url="https://www.fao.org/4/x0490e/x0490e00.htm",
    version=None,
)
SOILGRIDS_SOURCE = Source(
    id="soilgrids", name="ISRIC SoilGrids 2.0 (CC BY 4.0)", url="https://isric.org/explore/soilgrids", version="2.0"
)


@dataclass(frozen=True)
class AnalysisParams:
    """Everything that determines an analysis. Encoded in the (decodable) analysis id: no coordinates inside."""

    code: str
    soil: int
    soil_source: str  # "user" | "default"
    regime: str  # "rainfed" | "irrigated"
    regime_source: str
    input_mode: str  # "point" | "municipality"
    near_centroid: bool


def encode_analysis_id(p: AnalysisParams) -> str:
    return (
        f"csa_{settings.method_version}_{p.code}.{p.soil}.{p.soil_source[0]}.{p.regime[0]}."
        f"{p.regime_source[0]}.{p.input_mode[0]}.{int(p.near_centroid)}"
    )


def decode_analysis_id(analysis_id: str) -> AnalysisParams | None:
    m = ANALYSIS_ID_PATTERN.match(analysis_id)
    if not m or m["method"] != settings.method_version:
        return None
    return AnalysisParams(
        code=m["code"],
        soil=int(m["soil"]),
        soil_source="user" if m["ss"] == "u" else "default",
        regime="rainfed" if m["regime"] == "r" else "irrigated",
        regime_source="user" if m["rs"] == "u" else "default",
        input_mode="point" if m["mode"] == "p" else "municipality",
        near_centroid=m["near"] == "1",
    )


def _zarc_to_contract(window: ZarcWindow | None) -> Zarc | None:
    if window is None:
        return None
    return Zarc(
        values=list(window.values),  # type: ignore[arg-type]
        cycle_code=window.cycle_code,
        soil_code=window.soil_code,
        ordinance=window.ordinance,
        season=window.season,
    )


class RecommendationService:
    def __init__(
        self,
        crops: CropRepository,
        municipalities: MunicipalityRepository,
        windows: WindowRepository,
        reference: ReferenceRepository,
        climate: ClimateRepository,
        calibrator: Calibrator | None = None,
        soil: SoilRepository | None = None,
    ):
        self.crops = crops
        self.municipalities = municipalities
        self.windows = windows
        self.reference = reference
        self.climate = climate
        self.soil = soil or SoilRepository(climate.db)
        self.calibrator: Calibrator = calibrator or IdentityCalibrator()  # ML is scaffolded, not trained
        self.locations = LocationService(municipalities)

    # ---- entry points ----

    def recommend(self, request: RecommendationRequest, locale: Locale, now: datetime | None = None) -> Recommendation:
        params, municipality = self._params_from_request(request)
        return self._build(params, municipality, locale, now)

    def recommend_for_id(self, analysis_id: str, locale: Locale, now: datetime | None = None) -> Recommendation:
        params = decode_analysis_id(analysis_id)
        municipality = self.municipalities.get(params.code) if params else None
        if params is None or municipality is None:
            raise AppError("not_found", "unknown_id", 404)
        return self._build(params, municipality, locale, now)

    # ---- request -> parameters ----

    def _params_from_request(self, request: RecommendationRequest) -> tuple[AnalysisParams, Municipality]:
        if isinstance(request, MunicipalityRequest):
            municipality = self.municipalities.get(request.municipality_code)
            if municipality is None:
                raise AppError("out_of_coverage", "municipality_not_covered", 422)
            mode, near = "municipality", True
        else:
            assert isinstance(request, PointRequest)
            municipality, near = self.locations.locate(Coordinates(lat=request.lat, lon=request.lon))
            mode = "point"
        soil = request.soil_class or municipality.default_soil_class or DEFAULT_SOIL_CLASS
        params = AnalysisParams(
            code=municipality.code,
            soil=soil,
            soil_source="user" if request.soil_class else "default",
            regime=request.regime or "rainfed",
            regime_source="user" if request.regime else "default",
            input_mode=mode,
            near_centroid=near,
        )
        return params, municipality

    # ---- build ----

    def _build(
        self, p: AnalysisParams, municipality: Municipality, locale: Locale, now: datetime | None
    ) -> Recommendation:
        now = now or datetime.now(UTC)
        crops = self.crops.list_active()
        ranked: list[tuple[float, RankedCrop]] = []
        excluded: list[ExcludedCrop] = []
        any_curve = False
        place = self._place_summary(municipality)

        for crop in crops:
            rainfed = p.regime == "rainfed"
            zarc_row = self.reference.zarc_for(p.code, crop.id, p.soil) if rainfed else None
            zarc = _zarc_to_contract(zarc_row)
            pam = self._pam(p.code, crop)
            base_sources = (
                [POWER_SOURCE]
                + ([self._zarc_source(zarc)] if zarc else [])
                + ([self._pam_source()] if pam else [])
                + [FAO56_SOURCE]
            )

            if not rainfed:
                excluded.append(
                    self._excluded(
                        crop,
                        "no_data_for_regime",
                        text.EXCLUDED_NO_REGIME_DATA[locale],
                        zarc,
                        pam,
                        base_sources,
                        locale,
                    )
                )
                continue

            curve = self.windows.curve(municipality.power_cell_id, crop.id, p.soil, settings.method_version)
            if len(curve) != DEKADS_PER_YEAR:
                excluded.append(
                    self._excluded(
                        crop, "engine_not_run", text.EXCLUDED_NOT_RUN[locale], zarc, pam, base_sources, locale
                    )
                )
                continue
            any_curve = True
            calibrated = self.calibrator.calibrate(
                CalibrationInput(
                    crop_id=crop.id,
                    municipality_code=p.code,
                    soil_class=p.soil,
                    p=[r.p for r in curve],
                    lo=[r.lo for r in curve],
                    hi=[r.hi for r in curve],
                    features={},
                )
            )
            probs = [
                DekadProbability(p=a, lo=round(b, 3), hi=round(c, 3))
                for a, b, c in zip(calibrated.p, calibrated.lo, calibrated.hi, strict=True)
            ]
            values = list(calibrated.p)

            if zarc is None:
                excluded.append(
                    self._excluded(
                        crop, "engine_not_run", text.EXCLUDED_NOT_RUN[locale], zarc, pam, base_sources, locale
                    )
                )
                continue
            rho = spearman(values, [1.0 if v > 0 else 0.0 for v in zarc.values])
            if rho is None or rho < GATE_THRESHOLD:
                reason = text.excluded_gate_failed(rho, locale)
                excluded.append(self._excluded(crop, "gate_failed", reason, zarc, pam, base_sources, locale))
                continue

            windows = best_windows(values)
            confidence = assess_confidence(True, values, list(zarc.values), p.near_centroid)
            ranked.append(
                (
                    ranking_score(values),
                    RankedCrop(
                        crop_id=crop.id,
                        name=self._name(crop, locale),
                        rank=1,
                        eligible=True,
                        legume=crop.legume,
                        best_windows=[
                            PlantingWindow(start_dekad=w.start_dekad, end_dekad=w.end_dekad, mean_p=w.mean_p)
                            for w in windows
                        ],
                        p_success=probs,
                        zarc=zarc,
                        pam=pam,
                        flags=Flags(engine_reliable=True, ml_applied=calibrated.applied),
                        strengths=self._strengths(crop, windows, zarc, locale),
                        risks=self._risks(values, windows, zarc, pam, p, locale)
                        + self._suitability_risks(crop, place, locale),
                        missing_data=self._missing(crop, zarc, pam, p, municipality, locale)
                        + ([text.MISSING_SOIL_PH[locale]] if place[2] is None else []),
                        sources=[*base_sources, *self._engine_sources(p, municipality)],
                        confidence=Confidence(
                            level=confidence.level,
                            reasons=[text.confidence_reason(r, locale) for r in confidence.reasons],
                        ),
                    ),
                )
            )

        if p.regime == "rainfed" and not any_curve:
            raise AppError("no_data", "no_data", 404)

        ranked.sort(key=lambda item: (-item[0], item[1].crop_id))
        crops_out = [item[1].model_copy(update={"rank": i}) for i, item in enumerate(ranked, start=1)]
        return Recommendation(
            analysis_id=encode_analysis_id(p),
            contract_version=settings.contract_version,
            method_version=settings.method_version,
            dataset_versions=self._dataset_versions(),
            mock=False,
            generated_at=now.isoformat(timespec="milliseconds").replace("+00:00", "Z"),
            location=Location(
                municipality_code=municipality.code,
                municipality_name=municipality.name,
                power_cell=municipality_cell(municipality),
                soil_class=p.soil,  # type: ignore[arg-type]
                soil_source=p.soil_source,  # type: ignore[arg-type]
                regime=p.regime,  # type: ignore[arg-type]
                regime_source=p.regime_source,  # type: ignore[arg-type]
                input_mode=p.input_mode,  # type: ignore[arg-type]
                municipality_centroid=Coordinates(lat=municipality.centroid_lat, lon=municipality.centroid_lon),
                near_centroid=p.near_centroid,
            ),
            crops=crops_out,
            excluded=excluded,
            disclaimers=[Disclaimer(id=key, text=text.DISCLAIMERS[key][locale]) for key in text.DISCLAIMER_ORDER],
        )

    # ---- pieces ----

    def _place_summary(self, municipality: Municipality) -> tuple[float | None, float | None, float | None]:
        """(mean annual rain mm, mean temperature °C, topsoil pH) of the place, for the static suitability notes."""
        rain, temp = self.climate.climate_summary(municipality.power_cell_id, LAST_SEASON)
        return rain, temp, self.soil.topsoil_ph(municipality.code)

    @staticmethod
    def _suitability_risks(crop: Crop, place: tuple, locale: Locale) -> list[str]:
        """One note per factor the place cannot tolerate, from the EcoCrop ranges (not used for ranking)."""
        req = crop.requirements
        if req is None:
            return []
        rain, temp, ph = place
        result = assess_suitability(
            mean_annual_temp_c=temp,
            annual_rain_mm=rain,
            ph=ph,
            temp_optimal=(req.temp_opt_min_c, req.temp_opt_max_c),
            temp_absolute=(req.temp_abs_min_c, req.temp_abs_max_c),
            rain_optimal=(req.rain_opt_min_mm, req.rain_opt_max_mm),
            rain_absolute=(req.rain_abs_min_mm, req.rain_abs_max_mm),
            ph_optimal=(req.ph_opt_min, req.ph_opt_max),
        )
        return [
            text.risk_suitability(f.name, f.value, locale)
            for f in result.factors
            if f.status == "outside" and f.value is not None
        ]

    @staticmethod
    def _name(crop: Crop, locale: Locale) -> str:
        return crop.name_pt if locale == "pt-BR" else crop.name_en

    def _pam(self, code: str, crop: Crop) -> Pam | None:
        if not crop.pam_crop:
            return None
        series = self.reference.pam_series(code, crop.pam_crop)
        if not series:
            return None
        yields = [value for _, value in series]
        return Pam(
            crop_label=crop.pam_crop,
            years=[year for year, _ in series],
            yield_kg_ha=yields,
            municipality_median=statistics.median(yields),
            state_median=self.reference.pam_state_median(crop.pam_crop),
        )

    @staticmethod
    def _zarc_source(zarc: Zarc) -> Source:
        return Source(
            id="zarc",
            name=f"MAPA ZARC risk table, season {zarc.season}",
            url="https://dados.agricultura.gov.br/dataset/tabua-de-risco-zoneamento-agricola-de-risco-climatico",
            version=zarc.season,
        )

    @staticmethod
    def _pam_source() -> Source:
        return Source(
            id="ibge-pam",
            name="IBGE PAM yield, 2005–2024",
            url="https://sidra.ibge.gov.br/tabela/5457",
            version="2005-2024",
        )

    @staticmethod
    def _engine_sources(p: AnalysisParams, municipality: Municipality) -> list[Source]:
        engine = Source(
            id="cropshift-engine",
            name="Cropshift FAO-56 water-balance engine",
            url=None,
            version=settings.method_version,
        )
        if p.soil_source == "default" and municipality.default_soil_class is not None:
            return [SOILGRIDS_SOURCE, engine]
        return [engine]

    def _excluded(self, crop, reason_code, reason, zarc, pam, sources, locale) -> ExcludedCrop:
        return ExcludedCrop(
            crop_id=crop.id,
            name=self._name(crop, locale),
            eligible=False,
            reason_code=reason_code,
            reason=reason,
            zarc=zarc,
            pam=pam,
            sources=sources,
        )

    @staticmethod
    def _strengths(crop: Crop, windows, zarc: Zarc | None, locale: Locale) -> list[str]:
        out: list[str] = []
        best = windows[0] if windows else None
        if best and best.mean_p >= GOOD_WINDOW_P:
            out.append(
                text.strength_window(
                    text.window_label(best.start_dekad, best.end_dekad, locale), text.percent(best.mean_p), locale
                )
            )
        if zarc and best and zarc.values[best.start_dekad - 1] > 0 and zarc.values[best.end_dekad - 1] > 0:
            out.append(text.STRENGTH_INSIDE_ZARC[locale])
        if crop.legume:
            out.append(text.STRENGTH_LEGUME[locale])
        return out

    @staticmethod
    def _risks(
        values: list[float], windows, zarc: Zarc | None, pam: Pam | None, p: AnalysisParams, locale: Locale
    ) -> list[str]:
        out: list[str] = []
        good = sum(1 for v in values if v >= GOOD_WINDOW_P)
        if 0 < good <= 4:
            out.append(text.risk_narrow(good, locale))
        if good == 0:
            out.append(text.RISK_NONE[locale])
        if windows:
            after = shift_dekad(windows[0].end_dekad, 1)
            if values[after - 1] < 0.5:
                out.append(text.risk_late(text.dekad_label(after, locale), locale))
        if zarc:
            outside = sum(1 for v, z in zip(values, zarc.values, strict=True) if z == 0 and v >= GOOD_WINDOW_P)
            if outside > 0:
                out.append(text.risk_outside_zarc(outside, locale))
        if (
            pam
            and pam.municipality_median is not None
            and pam.state_median is not None
            and pam.municipality_median < pam.state_median
        ):
            out.append(
                text.risk_low_yield(
                    text.kg_per_ha(pam.municipality_median, locale), text.kg_per_ha(pam.state_median, locale), locale
                )
            )
        if p.soil == 1 and p.regime == "rainfed":
            out.append(text.RISK_SANDY[locale])
        return out

    @staticmethod
    def _missing(
        crop: Crop, zarc: Zarc | None, pam: Pam | None, p: AnalysisParams, municipality: Municipality, locale: Locale
    ) -> list[str]:
        out: list[str] = []
        if zarc is None:
            out.append(text.MISSING["common_bean" if crop.id == "common_bean" else "no_zarc"][locale])
        if pam is None:
            out.append(text.MISSING["no_pam" if crop.pam_crop else "not_surveyed"][locale])
        if p.soil_source == "default":
            key = "derived" if municipality.default_soil_class is not None else "fallback"
            out.append(text.SOIL_DEFAULT_NOTE[key][locale])
        out.append(text.soil_assumed(SOIL_THETA_AW[p.soil], locale))
        return out

    def _dataset_versions(self) -> list[DatasetVersion]:
        return [
            DatasetVersion(name=d.name, version=d.version, retrieved_at=d.retrieved_at.date().isoformat())
            for d in self.climate.dataset_versions()
        ]
