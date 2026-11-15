import { ChevronRight, Leaf } from "lucide-react";
import type { RankedCrop } from "@/contract/types";
import { Badge } from "@/components/ui/badge";
import { windowLabel } from "@/lib/domain/dekads";
import { percent } from "@/lib/domain/format";
import { ConfidenceBadge } from "./confidence-badge";
import { probabilityStep } from "@/components/charts/scale";

/** One ranked crop. Order and rank come from the API; the UI never re-sorts. */
export function RankingCard({ crop, onOpen }: { crop: RankedCrop; onOpen: () => void }) {
  const [best, second] = crop.best_windows;
  const bestP = best ? crop.p_success.slice(best.start_dekad - 1, best.end_dekad) : [];
  const lo = bestP.length ? Math.min(...bestP.map((x) => x.lo)) : null;
  const hi = bestP.length ? Math.max(...bestP.map((x) => x.hi)) : null;

  return (
    <li className="rounded-lg border border-border bg-surface p-4 shadow-sm" data-testid={`rank-card-${crop.crop_id}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-3 text-sm font-semibold tabular-nums" aria-label={`Rank ${crop.rank}`}>
            {crop.rank}
          </span>
          <div className="min-w-0">
            <h3 className="font-semibold">{crop.name}</h3>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <ConfidenceBadge confidence={crop.confidence} />
              {crop.legume ? (
                <Badge tone="brand">
                  <Leaf aria-hidden /> Legume
                </Badge>
              ) : null}
              {!crop.zarc ? <Badge tone="warning">No ZARC to compare</Badge> : null}
            </div>
          </div>
        </div>
        {best ? (
          <div className="shrink-0 text-right">
            <div className="flex items-center justify-end gap-1.5">
              <span className="size-2.5 rounded-full" style={{ background: probabilityStep(best.mean_p).color }} aria-hidden />
              <span className="text-2xl font-semibold tabular-nums">{percent(best.mean_p)}</span>
            </div>
            <p className="text-[11px] text-muted">avg. success in best window</p>
          </div>
        ) : null}
      </div>

      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-ink-2">Best planting window</dt>
          <dd className="font-medium">{best ? windowLabel(best.start_dekad, best.end_dekad) : "None found"}</dd>
          {second ? <dd className="text-xs text-ink-2">also {windowLabel(second.start_dekad, second.end_dekad)} ({percent(second.mean_p)})</dd> : null}
        </div>
        <div>
          <dt className="text-xs text-ink-2">Range across that window</dt>
          <dd className="font-medium tabular-nums">{lo !== null && hi !== null ? `${percent(lo)}–${percent(hi)}` : "—"}</dd>
          <dd className="text-[11px] text-muted">95% range, 40 seasons of NASA POWER</dd>
        </div>
      </dl>

      {crop.risks[0] ? <p className="mt-3 text-sm text-ink-2">⚠ {crop.risks[0]}</p> : null}

      <button
        type="button"
        onClick={onOpen}
        className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline"
        aria-label={`Details, chart and sources for ${crop.name}`}
      >
        Details, chart and sources <ChevronRight className="size-4" aria-hidden />
      </button>
    </li>
  );
}
