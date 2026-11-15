/**
 * Downloads the Pernambuco municipal mesh and names from the public IBGE APIs
 * and writes:
 *   public/geo/pe-municipalities.json  (map layer, properties: code, name)
 *   mock-data/municipalities.json         (code, name, search key, centroid, POWER cell)
 *
 * Usage: npm run gen:geo
 * Only public, anonymous requests; no user data is sent.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { foldAccents, polygonCentroid, powerCell, round } from "../src/lib/domain/geo";

const STATE_CODE = 26; // Pernambuco
const EXPECTED_MUNICIPALITIES = 185;
const MESH_URL = `https://servicodados.ibge.gov.br/api/v3/malhas/estados/${STATE_CODE}?formato=application/vnd.geo%2Bjson&qualidade=minima&intrarregiao=municipio`;
const NAMES_URL = `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${STATE_CODE}/municipios`;

const root = path.resolve(import.meta.dirname, "..");

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { "user-agent": "fieldshift-web-generator" } });
  if (!res.ok) throw new Error(`GET ${url} -> HTTP ${res.status}`);
  return (await res.json()) as T;
}

type MeshFeature = GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon, { codarea: string }>;

async function main() {
  const [mesh, names] = await Promise.all([
    getJson<GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon, { codarea: string }>>(MESH_URL),
    getJson<{ id: number; nome: string }[]>(NAMES_URL),
  ]);

  const nameByCode = new Map(names.map((m) => [String(m.id), m.nome]));
  if (mesh.features.length !== EXPECTED_MUNICIPALITIES || nameByCode.size !== EXPECTED_MUNICIPALITIES) {
    throw new Error(
      `expected ${EXPECTED_MUNICIPALITIES} municipalities, got mesh=${mesh.features.length} names=${nameByCode.size}`,
    );
  }

  const features = mesh.features.map((f: MeshFeature) => {
    const code = f.properties.codarea;
    const name = nameByCode.get(code);
    if (!name) throw new Error(`no name for municipality ${code}`);
    return { type: "Feature" as const, properties: { code, name }, geometry: f.geometry };
  });

  const municipalities = features
    .map((f) => {
      const [lon, lat] = polygonCentroid(f.geometry);
      return {
        code: f.properties.code,
        name: f.properties.name,
        search: foldAccents(f.properties.name),
        centroid: { lat: round(lat, 5), lon: round(lon, 5) },
        power_cell: powerCell(lat, lon),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  await mkdir(path.join(root, "public/geo"), { recursive: true });
  await mkdir(path.join(root, "mock-data"), { recursive: true });
  await writeFile(
    path.join(root, "public/geo/pe-municipalities.json"),
    JSON.stringify({ type: "FeatureCollection", features }),
  );
  await writeFile(path.join(root, "mock-data/municipalities.json"), JSON.stringify(municipalities, null, 1) + "\n");
  const cells = new Set(municipalities.map((m) => m.power_cell.id));
  console.log(`wrote ${features.length} municipalities across ${cells.size} POWER cells`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
