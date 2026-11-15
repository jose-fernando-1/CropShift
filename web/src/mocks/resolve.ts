import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import geojson from "../../public/geo/pe-municipalities.json";
import { powerCell } from "@/lib/domain/geo";
import { municipalityByCode, type MunicipalityRecord } from "./data";

type MunicipalityFeature = GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon, { code: string; name: string }>;
const features = (geojson as unknown as GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon, { code: string; name: string }>)
  .features as MunicipalityFeature[];

/** Pernambuco bounding box (incl. Fernando de Noronha) to skip polygon tests for far-away points. */
const BBOX = { minLat: -9.6, maxLat: -3.7, minLon: -41.5, maxLon: -32.3 };

export function findMunicipality(lat: number, lon: number): MunicipalityRecord | null {
  if (lat < BBOX.minLat || lat > BBOX.maxLat || lon < BBOX.minLon || lon > BBOX.maxLon) return null;
  const point: GeoJSON.Point = { type: "Point", coordinates: [lon, lat] };
  const hit = features.find((f) => booleanPointInPolygon(point, f));
  return hit ? (municipalityByCode.get(hit.properties.code) ?? null) : null;
}

/** True when the point falls in the same POWER cell as the municipality centroid. */
export function isNearCentroid(m: MunicipalityRecord, lat: number, lon: number) {
  return powerCell(lat, lon).id === m.power_cell.id;
}
