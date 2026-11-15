/** Pure geometry helpers shared by the generator scripts and the mock API. */

/** NASA POWER daily grid (MERRA-2): 0.5° latitude x 0.625° longitude. */
export const POWER_LAT_STEP = 0.5;
export const POWER_LON_STEP = 0.625;

export function powerCell(lat: number, lon: number) {
  const row = Math.round((lat + 90) / POWER_LAT_STEP);
  const col = Math.round((lon + 180) / POWER_LON_STEP);
  return {
    id: `r${row}c${col}`,
    lat: round(-90 + row * POWER_LAT_STEP, 4),
    lon: round(-180 + col * POWER_LON_STEP, 4),
  };
}

export function round(value: number, digits: number) {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

/** Lowercase, accent-free form used for search. */
export function foldAccents(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

type Ring = number[][];

/** Area-weighted centroid of a (Multi)Polygon's outer rings, [lon, lat]. */
export function polygonCentroid(geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon): [number, number] {
  const polygons: Ring[][] = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (const polygon of polygons) {
    const ring = polygon[0];
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [x0, y0] = ring[j];
      const [x1, y1] = ring[i];
      const cross = x0 * y1 - x1 * y0;
      area += cross;
      cx += (x0 + x1) * cross;
      cy += (y0 + y1) * cross;
    }
  }
  if (area === 0) {
    const [x, y] = polygons[0][0][0];
    return [x, y];
  }
  return [cx / (3 * area), cy / (3 * area)];
}
