"use client";

import { ChevronDown, ChevronUp, MapPin, MapPinOff, Sparkles, TriangleAlert } from "lucide-react";
import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMessages } from "@/i18n/use-i18n";
import { ApiClientError } from "@/lib/api/client";
import { useMunicipalities } from "@/lib/api/municipalities";
import { useResolve } from "@/lib/api/queries";
import { polygonCentroid } from "@/lib/domain/geo";
import type { AnalysisState } from "@/lib/state/use-analysis-state";
import { cn } from "@/lib/utils";
import { CoordinateInput } from "./coordinate-input";
import { MunicipalitySearch } from "./municipality-search";
import { UseMyLocation, type GeoError } from "./use-my-location";

const LocationMap = dynamic(() => import("@/components/map/location-map"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
});

/** Prototype test point (São Bento do Una), used by "Try an example". */
const EXAMPLE = { lat: -8.6, lon: -36.4 };

type NoticeKind = "outOfState" | GeoError | "resolveError";
type Notice = { kind: NoticeKind; errorCode?: string };

const NOTICE_TEST_IDS: Record<NoticeKind, string> = {
  outOfState: "notice-out-of-state",
  denied: "notice-gps-denied",
  unavailable: "notice-gps-unavailable",
  unsupported: "notice-gps-unsupported",
  resolveError: "notice-resolve-error",
};

export function LocationPanel({ state }: { state: AnalysisState }) {
  const m = useMessages();
  const t = m.location;
  const municipalities = useMunicipalities();
  const resolve = useResolve();
  const [pin, setPin] = useState<{ lat: number; lon: number } | null>(null);
  const [focus, setFocus] = useState<[number, number] | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  // Every new selection bumps this; a resolve that finishes after a newer selection is ignored.
  const generation = useRef(0);

  const selectedCode = state.selection?.code ?? null;
  const selectedName = selectedCode ? municipalities.data?.byCode.get(selectedCode)?.name : undefined;
  const shownPin = state.selection?.kind === "point" ? { lat: state.selection.lat, lon: state.selection.lon } : pin;

  const pick = (lat: number, lon: number) => {
    const mine = ++generation.current;
    setPin({ lat, lon });
    setFocus([lat, lon]);
    setNotice(null);
    resolve.mutate(
      { lat, lon },
      {
        onSuccess: (res) => {
          if (mine !== generation.current) return;
          if (res.coverage === "covered") {
            state.selectPoint(res.municipality.municipality_code, lat, lon);
            setMapOpen(false);
          } else {
            setNotice({ kind: "outOfState" });
          }
        },
        onError: (err) => {
          if (mine !== generation.current) return;
          setNotice({ kind: "resolveError", errorCode: err instanceof ApiClientError ? err.code : "internal" });
        },
      },
    );
  };

  const chooseMunicipality = (code: string) => {
    generation.current++;
    setPin(null);
    setNotice(null);
    state.selectMunicipality(code);
    setMapOpen(false);
    const feature = municipalities.data?.geojson.features.find((f) => f.properties.code === code);
    if (feature) {
      const [lon, lat] = polygonCentroid(feature.geometry);
      setFocus([lat, lon]);
    }
  };

  const collapsed = Boolean(state.selection) && !mapOpen;
  const noticeCopy =
    notice === null
      ? null
      : notice.kind === "resolveError"
        ? { title: t.notices.resolveError, text: (m.errors[notice.errorCode ?? "internal"] ?? m.errors.internal).text }
        : t.notices[notice.kind];

  return (
    <section aria-labelledby="location-title" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 id="location-title" className="font-semibold">
          {t.title}
        </h2>
        {state.selection ? (
          <Button size="sm" variant="ghost" className="lg:hidden" onClick={() => setMapOpen((v) => !v)} aria-expanded={!collapsed}>
            {collapsed ? <ChevronDown aria-hidden /> : <ChevronUp aria-hidden />} {collapsed ? t.change : t.hideMap}
          </Button>
        ) : null}
      </div>

      {state.selection ? (
        <p className="flex items-center gap-2 rounded-md bg-brand-soft px-3 py-2 text-sm" data-testid="selected-location">
          <MapPin className="size-4 shrink-0 text-brand" aria-hidden />
          <span>
            <strong>{selectedName ?? state.selection.code}</strong>
            <span className="text-ink-2">{state.selection.kind === "point" ? t.yourPoint : t.centre}</span>
          </span>
        </p>
      ) : null}

      <div className={cn("space-y-3", collapsed && "hidden lg:block")}>
        {municipalities.data ? (
          <MunicipalitySearch options={municipalities.data.options} onSelect={chooseMunicipality} />
        ) : (
          <Skeleton className="h-16" />
        )}

        <div className="relative h-72 overflow-hidden rounded-md border border-border lg:h-80">
          {municipalities.data ? (
            <LocationMap geojson={municipalities.data.geojson} selectedCode={selectedCode} pin={shownPin} focus={focus} onPick={pick} />
          ) : municipalities.isError ? (
            <div className="grid h-full place-items-center p-4 text-center text-sm text-ink-2">{t.mapError}</div>
          ) : (
            <Skeleton className="h-full w-full" />
          )}
          {resolve.isPending ? (
            <span className="absolute left-2 top-2 z-[500] rounded bg-surface/90 px-2 py-1 text-xs shadow" role="status">
              {t.finding}
            </span>
          ) : null}
        </div>

        {notice && noticeCopy ? (
          <div
            role="alert"
            data-testid={NOTICE_TEST_IDS[notice.kind]}
            className={cn(
              "flex gap-2 rounded-md border p-3 text-sm",
              notice.kind === "resolveError"
                ? "border-critical/40 bg-critical-soft text-critical-ink"
                : "border-warning bg-warning-soft text-warning-ink",
            )}
          >
            {notice.kind === "outOfState" ? (
              <MapPinOff className="mt-0.5 size-4 shrink-0" aria-hidden />
            ) : (
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            )}
            <div>
              <p className="font-medium">{noticeCopy.title}</p>
              <p>{noticeCopy.text}</p>
            </div>
          </div>
        ) : null}

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <UseMyLocation onLocated={pick} onError={(e) => setNotice({ kind: e })} disabled={resolve.isPending} />
          <Button variant="secondary" onClick={() => pick(EXAMPLE.lat, EXAMPLE.lon)} disabled={resolve.isPending} data-testid="try-example">
            <Sparkles aria-hidden /> {t.example}
          </Button>
        </div>

        <CoordinateInput onSubmit={pick} disabled={resolve.isPending} />
      </div>
    </section>
  );
}
