"use client";

import { useState } from "react";
import type { RankedCrop } from "@/contract/types";
import { useLocale, useMessages } from "@/i18n/use-i18n";
import { DEKADS, dekadLabel, dekadOfDate, monthNames, windowLabel } from "@/lib/domain/dekads";
import { percent, percentWithBand } from "@/lib/domain/format";
import { cn } from "@/lib/utils";
import { ChartFrame } from "./chart-frame";
import { PROBABILITY_STEPS, probabilityStep } from "./scale";

type Hover = { cropId: string; dekad: number } | null;

/**
 * Planting calendar: ranked crops x 36 dekads, colour = probability of
 * success, orange outline = official ZARC window. Rows keep the API's order.
 */
export function CalendarHeatmap({ crops, onSelect }: { crops: RankedCrop[]; onSelect: (cropId: string) => void }) {
  const locale = useLocale();
  const t = useMessages().chart;
  const [hover, setHover] = useState<Hover>(null);
  const today = dekadOfDate(new Date());
  const hovered = hover ? crops.find((c) => c.crop_id === hover.cropId) : undefined;

  const readout =
    hovered && hover ? (
      <>
        <strong className="font-semibold text-ink">{percentWithBand(...pBand(hovered, hover.dekad))}</strong> {t.success} · {hovered.name} ·{" "}
        {dekadLabel(hover.dekad, locale)}
        {hovered.zarc ? ` · ${t.zarcValue(hovered.zarc.values[hover.dekad - 1])}` : ` · ${t.noZarc}`}
      </>
    ) : (
      <span>{t.calendarHint}</span>
    );

  const chart = (
    <div>
      <p className="mb-2 min-h-5 text-xs text-ink-2" aria-live="polite">
        {readout}
      </p>
      <div className="overflow-x-auto pb-1">
        <div className="min-w-[560px]">
          {/* month header */}
          <div className="grid grid-cols-[minmax(104px,160px)_repeat(36,minmax(0,1fr))] text-2xs text-ink-2">
            <span />
            {monthNames(locale).map((m, i) => (
              <span key={m} className="col-span-3 border-l border-border pl-1" style={{ gridColumnStart: i * 3 + 2 }}>
                {m}
              </span>
            ))}
          </div>
          {/* "today" marker row */}
          <div className="grid h-3 grid-cols-[minmax(104px,160px)_repeat(36,minmax(0,1fr))]">
            <span />
            <span
              className="flex justify-center text-2xs leading-3 text-ink"
              style={{ gridColumnStart: today + 1 }}
              title={t.today(dekadLabel(today, locale))}
            >
              ▼
            </span>
          </div>
          <div className="space-y-1" onPointerLeave={() => setHover(null)}>
            {crops.map((c) => {
              const [best] = c.best_windows;
              return (
                <button
                  key={c.crop_id}
                  type="button"
                  onClick={() => onSelect(c.crop_id)}
                  className="group grid w-full grid-cols-[minmax(104px,160px)_repeat(36,minmax(0,1fr))] items-stretch rounded-sm text-left hover:bg-surface-2"
                  aria-label={t.rowLabel(
                    c.rank,
                    c.name,
                    best ? windowLabel(best.start_dekad, best.end_dekad, locale) : t.none,
                    best ? percent(best.mean_p) : null,
                  )}
                >
                  <span className="truncate pr-2 text-sm font-medium group-hover:underline">
                    <span className="text-ink-2 tabular-nums">{c.rank}.</span> {c.name}
                  </span>
                  {DEKADS.map((d) => {
                    const p = c.p_success[d - 1].p;
                    const inZarc = (c.zarc?.values[d - 1] ?? 0) > 0;
                    const isHover = hover?.cropId === c.crop_id && hover.dekad === d;
                    return (
                      <span
                        key={d}
                        aria-hidden
                        onPointerEnter={() => setHover({ cropId: c.crop_id, dekad: d })}
                        className={cn("relative h-7 border-r-2 border-surface", isHover && "z-10 outline-2 outline-ink")}
                        style={{
                          background: probabilityStep(p).color,
                          boxShadow: inZarc ? "inset 0 -3px 0 var(--zarc), inset 0 3px 0 var(--zarc)" : undefined,
                        }}
                      />
                    );
                  })}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );

  const legend = (
    <>
      <span className="flex items-center gap-1.5">
        <span className="flex overflow-hidden rounded-sm" aria-hidden>
          {PROBABILITY_STEPS.map((s) => (
            <span key={s.min} className="h-3 w-3" style={{ background: s.color }} />
          ))}
        </span>
        {t.legendScale}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-4 rounded-sm" style={{ boxShadow: "inset 0 -3px 0 var(--zarc), inset 0 3px 0 var(--zarc)" }} aria-hidden />
        {t.legendZarc}
      </span>
      <span>▼ {t.today(dekadLabel(today, locale))}</span>
    </>
  );

  const table = (
    <table className="w-full text-left text-xs">
      <thead className="sticky top-0 bg-surface-2">
        <tr>
          <th className="px-2 py-1.5 font-medium">{t.dekad}</th>
          {crops.map((c) => (
            <th key={c.crop_id} className="px-2 py-1.5 font-medium">
              {c.name}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {DEKADS.map((d) => (
          <tr key={d} className="border-t border-border/60">
            <th scope="row" className="px-2 py-1 font-normal whitespace-nowrap">
              {d}. {dekadLabel(d, locale)}
            </th>
            {crops.map((c) => (
              <td key={c.crop_id} className="px-2 py-1 tabular-nums whitespace-nowrap">
                {percentWithBand(...pBand(c, d))}
                {c.zarc && c.zarc.values[d - 1] > 0 ? <span className="ml-1 text-ink-2">· {t.zarcValue(c.zarc.values[d - 1])}</span> : null}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );

  return <ChartFrame title={t.calendarTitle} subtitle={t.calendarSubtitle} legend={legend} chart={chart} table={table} />;
}

function pBand(c: RankedCrop, d: number): [number, number, number] {
  const x = c.p_success[d - 1];
  return [x.p, x.lo, x.hi];
}
