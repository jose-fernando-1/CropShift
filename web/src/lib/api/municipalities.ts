"use client";

import { useQuery } from "@tanstack/react-query";
import { foldAccents } from "@/lib/domain/geo";

export type MunicipalityFeatureCollection = GeoJSON.FeatureCollection<
  GeoJSON.Polygon | GeoJSON.MultiPolygon,
  { code: string; name: string }
>;

export type MunicipalityOption = { code: string; name: string; search: string };

/** Static IBGE mesh (public/geo), shared by the map and the search box. Not part of the API. */
export function useMunicipalities() {
  return useQuery({
    queryKey: ["geo", "pe-municipalities"],
    staleTime: Infinity,
    queryFn: async () => {
      const res = await fetch("/geo/pe-municipalities.json");
      if (!res.ok) throw new Error(`map data: HTTP ${res.status}`);
      const geojson = (await res.json()) as MunicipalityFeatureCollection;
      const options: MunicipalityOption[] = geojson.features
        .map((f) => ({ code: f.properties.code, name: f.properties.name, search: foldAccents(f.properties.name) }))
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
      return { geojson, options, byCode: new Map(options.map((o) => [o.code, o])) };
    },
  });
}
