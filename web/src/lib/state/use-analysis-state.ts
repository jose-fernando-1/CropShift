"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import type { RecommendationRequest, Regime, SoilClass } from "@/contract/types";

export type Selection =
  | { kind: "municipality"; code: string }
  | { kind: "point"; code: string; lat: number; lon: number };

/**
 * Analysis inputs. The URL holds what makes a result shareable (municipality,
 * soil, regime, open crop); an exact point stays in memory only, so
 * coordinates never end up in links, history or server logs.
 */
export function useAnalysisState() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [point, setPoint] = useState<{ code: string; lat: number; lon: number } | null>(null);
  // Last query string we asked the router for: router.replace commits asynchronously, so
  // building from it (not from render-time params or window.location) never drops a patch.
  const lastQuery = useRef<string | null>(null);

  const mun = params.get("mun");
  const soilParam = params.get("soil");
  const regimeParam = params.get("regime");
  const soil: SoilClass | null = soilParam === "1" || soilParam === "2" || soilParam === "3" ? (Number(soilParam) as SoilClass) : null;
  const regime: Regime | null = regimeParam === "rainfed" || regimeParam === "irrigated" ? regimeParam : null;
  const crop = params.get("crop");

  const selection: Selection | null = useMemo(() => {
    if (!mun || !/^\d{7}$/.test(mun)) return null;
    if (point && point.code === mun) return { kind: "point", ...point };
    return { kind: "municipality", code: mun };
  }, [mun, point]);

  const update = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(lastQuery.current ?? window.location.search);
      for (const [k, v] of Object.entries(patch)) {
        if (v === null) next.delete(k);
        else next.set(k, v);
      }
      const qs = next.toString();
      lastQuery.current = qs;
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router],
  );

  const request: RecommendationRequest | null = useMemo(() => {
    if (!selection) return null;
    const options = { ...(soil ? { soil_class: soil } : {}), ...(regime ? { regime } : {}) };
    return selection.kind === "point"
      ? { lat: selection.lat, lon: selection.lon, ...options }
      : { municipality_code: selection.code, ...options };
  }, [selection, soil, regime]);

  return {
    selection,
    soil,
    regime,
    crop,
    request,
    selectMunicipality: (code: string) => {
      setPoint(null);
      update({ mun: code, crop: null });
    },
    selectPoint: (code: string, lat: number, lon: number) => {
      setPoint({ code, lat, lon });
      update({ mun: code, crop: null });
    },
    clearSelection: () => {
      setPoint(null);
      update({ mun: null, crop: null });
    },
    setSoil: (value: SoilClass | null) => update({ soil: value ? String(value) : null }),
    setRegime: (value: Regime | null) => update({ regime: value }),
    openCrop: (id: string | null) => update({ crop: id }),
  };
}

export type AnalysisState = ReturnType<typeof useAnalysisState>;
