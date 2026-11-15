"use client";

import { CloudOff, FileWarning, MapPinOff, RotateCw, SearchX, Timer } from "lucide-react";
import type { ReactNode } from "react";
import type { Recommendation } from "@/contract/types";
import { CalendarHeatmap } from "@/components/charts/calendar-heatmap";
import { ExplanationPanel } from "@/components/explain/explanation-panel";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMessages } from "@/i18n/use-i18n";
import { ApiClientError } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { ContextBar } from "./context-bar";
import { CropDetailSheet } from "./crop-detail-sheet";
import { ExcludedCard } from "./excluded-card";
import { LimitsPanel } from "./limits-panel";
import { RankingCard } from "./ranking-card";

export function ResultsView({
  rec,
  error,
  isLoading,
  isRefetching,
  openCrop,
  onOpenCrop,
  onRetry,
  onOpenInspector,
}: {
  rec: Recommendation | undefined;
  error: unknown;
  isLoading: boolean;
  isRefetching: boolean;
  openCrop: string | null;
  onOpenCrop: (id: string | null) => void;
  onRetry: () => void;
  onOpenInspector: (() => void) | null;
}) {
  const t = useMessages().results;
  if (error && !rec) return <ErrorState error={error} onRetry={onRetry} onOpenInspector={onOpenInspector} />;
  if (isLoading || !rec) return <LoadingState />;

  return (
    // "Refetch keeps the frame": previous result stays, dimmed, while new options load.
    <div className={cn("space-y-5 transition-opacity", isRefetching && "opacity-60")} aria-busy={isRefetching} data-testid="results">
      {error ? <ErrorState error={error} onRetry={onRetry} onOpenInspector={onOpenInspector} compact /> : null}
      <ContextBar rec={rec} />

      {rec.crops.length > 0 ? (
        <section aria-labelledby="calendar-title" className="rounded-lg border border-border bg-surface p-4">
          <h2 id="calendar-title" className="sr-only">
            {t.calendarTitle}
          </h2>
          <CalendarHeatmap crops={rec.crops} onSelect={(id) => onOpenCrop(id)} />
        </section>
      ) : null}

      <section aria-labelledby="ranking-title">
        <h2 id="ranking-title" className="text-base font-semibold">
          {t.rankedTitle}
        </h2>
        <p className="text-sm text-ink-2">{t.rankedText}</p>
        {rec.crops.length > 0 ? (
          <ol className="mt-3 grid gap-3 xl:grid-cols-2" aria-live="polite">
            {rec.crops.map((c) => (
              <RankingCard key={c.crop_id} crop={c} onOpen={() => onOpenCrop(c.crop_id)} />
            ))}
          </ol>
        ) : (
          <p className="mt-3 rounded-lg border border-border p-4 text-sm text-ink-2">{t.noneRanked}</p>
        )}
      </section>

      <ExplanationPanel rec={rec} />

      {rec.excluded.length > 0 ? (
        <section aria-labelledby="excluded-title">
          <h2 id="excluded-title" className="text-base font-semibold">
            {t.notRankedTitle}
          </h2>
          <p className="text-sm text-ink-2">{t.notRankedText}</p>
          <ul className="mt-3 grid gap-3 xl:grid-cols-2">
            {rec.excluded.map((e) => (
              <ExcludedCard key={e.crop_id} crop={e} />
            ))}
          </ul>
        </section>
      ) : null}

      <LimitsPanel disclaimers={rec.disclaimers} />

      <CropDetailSheet rec={rec} cropId={openCrop} onClose={() => onOpenCrop(null)} />
    </div>
  );
}

function LoadingState() {
  const t = useMessages().results;
  return (
    <div className="space-y-4" aria-busy="true" aria-label={t.loading}>
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-44 w-full" />
      <div className="grid gap-3 xl:grid-cols-2">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    </div>
  );
}

const ERRORS: Record<string, { icon: ReactNode; retry: boolean }> = {
  out_of_coverage: { icon: <MapPinOff aria-hidden />, retry: false },
  no_data: { icon: <SearchX aria-hidden />, retry: false },
  upstream_unavailable: { icon: <CloudOff aria-hidden />, retry: true },
  network: { icon: <CloudOff aria-hidden />, retry: true },
  rate_limited: { icon: <Timer aria-hidden />, retry: true },
  schema_mismatch: { icon: <FileWarning aria-hidden />, retry: true },
};

/**
 * Error copy is chosen on the client by error code, in the UI language; the
 * server's own message stays visible in the data-flow inspector.
 */
export function ErrorState({
  error,
  onRetry,
  onOpenInspector,
  compact = false,
}: {
  error: unknown;
  onRetry: () => void;
  onOpenInspector: (() => void) | null;
  compact?: boolean;
}) {
  const m = useMessages();
  const code = error instanceof ApiClientError ? error.code : "internal";
  const copy = m.errors[code] ?? m.errors.internal;
  const meta = ERRORS[code] ?? { icon: <FileWarning aria-hidden />, retry: true };
  return (
    <div
      role="alert"
      data-testid={`error-${code}`}
      className={cn("rounded-lg border border-critical/30 bg-critical-soft text-critical-ink", compact ? "p-3" : "p-6")}
    >
      <div className="flex items-start gap-3 [&_svg]:size-6 [&_svg]:shrink-0">
        {meta.icon}
        <div className="min-w-0">
          <p className="font-semibold">{copy.title}</p>
          <p className="mt-1 text-sm">{copy.text}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {meta.retry ? (
              <Button size="sm" variant="secondary" onClick={onRetry}>
                <RotateCw aria-hidden /> {m.results.tryAgain}
              </Button>
            ) : null}
            {code === "schema_mismatch" && onOpenInspector ? (
              <Button size="sm" variant="ghost" onClick={onOpenInspector}>
                {m.results.openInspector}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
