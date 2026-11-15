"use client";

import { useState, type KeyboardEvent } from "react";
import type { RankedCrop } from "@/contract/types";
import { useLocale, useMessages } from "@/i18n/use-i18n";
import { DEKADS, dekadLabel, dekadOfDate, monthNames, windowLabel } from "@/lib/domain/dekads";
import { percent, percentWithBand } from "@/lib/domain/format";
import { ChartFrame } from "./chart-frame";
import { useWidth } from "./use-width";

const HEIGHT = 240;
const M = { top: 26, right: 8, bottom: 30, left: 40 };

/**
 * Probability of success per planting dekad (bars, with the 95% band as a
 * whisker) over the official ZARC window (orange background). Hover, tap or
 * use the arrow keys to read a dekad.
 */
export function DekadChart({ crop }: { crop: RankedCrop }) {
  const locale = useLocale();
  const t = useMessages().chart;
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const today = dekadOfDate(new Date());

  const plotW = width - M.left - M.right;
  const plotH = HEIGHT - M.top - M.bottom;
  const bw = plotW / 36;
  const barW = Math.max(2, bw - 2); // 2px surface gap between bars
  const x = (d: number) => M.left + (d - 1) * bw;
  const y = (p: number) => M.top + plotH * (1 - p);
  const [best] = crop.best_windows;

  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const step = e.key === "ArrowRight" ? 1 : -1;
    setActive((a) => (a === null ? (step > 0 ? 1 : 36) : ((a - 1 + step + 36) % 36) + 1));
  };

  const a = active ? crop.p_success[active - 1] : null;
  const zarcAt = (d: number) => crop.zarc?.values[d - 1] ?? 0;

  const chart = (
    <div ref={ref}>
      <p className="mb-1 min-h-5 text-xs text-ink-2" aria-live="polite">
        {a && active ? (
          <>
            <strong className="font-semibold text-ink">{percentWithBand(a.p, a.lo, a.hi)}</strong> {t.success} ·{" "}
            {dekadLabel(active, locale)} ({t.dekadOf(active)}) ·{" "}
            {crop.zarc ? (zarcAt(active) > 0 ? t.zarcValue(zarcAt(active)) : t.outsideZarc) : t.noZarc}
          </>
        ) : (
          t.dekadHint
        )}
      </p>
      <svg
        width={width}
        height={HEIGHT}
        role="img"
        aria-label={t.dekadAria(crop.name, best ? windowLabel(best.start_dekad, best.end_dekad, locale) : null)}
        tabIndex={0}
        onKeyDown={onKey}
        onBlur={() => setActive(null)}
        onPointerLeave={() => setActive(null)}
        className="block max-w-full touch-pan-y"
      >
        {/* ZARC window background */}
        {DEKADS.filter((d) => zarcAt(d) > 0).map((d) => (
          <rect key={`z${d}`} x={x(d)} y={M.top} width={bw} height={plotH} fill="var(--zarc-soft)" />
        ))}
        {DEKADS.filter((d) => zarcAt(d) > 0).map((d) => (
          <rect key={`zl${d}`} x={x(d)} y={M.top + plotH + 1} width={bw} height={3} fill="var(--zarc)" />
        ))}

        {/* grid + y axis */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line x1={M.left} x2={M.left + plotW} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={t === 0 ? 1 : 0.75} />
            <text x={M.left - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--ink-2)">
              {t * 100}%
            </text>
          </g>
        ))}

        {/* month ticks */}
        {monthNames(locale).map((m, i) => (
          <g key={m}>
            <line x1={x(i * 3 + 1)} x2={x(i * 3 + 1)} y1={M.top + plotH} y2={M.top + plotH + 8} stroke="var(--border)" />
            <text x={x(i * 3 + 1) + (bw * 3) / 2} y={HEIGHT - 8} textAnchor="middle" fontSize={11} fill="var(--ink-2)">
              {width < 420 ? m[0].toUpperCase() : m}
            </text>
          </g>
        ))}

        {/* best window bracket */}
        {best && best.end_dekad >= best.start_dekad ? (
          <g>
            <path
              d={`M${x(best.start_dekad) + 1},${M.top - 6} v-5 H${x(best.end_dekad) + bw - 1} v5`}
              fill="none"
              stroke="var(--ink)"
              strokeWidth={1.25}
            />
            <text x={(x(best.start_dekad) + x(best.end_dekad) + bw) / 2} y={M.top - 15} textAnchor="middle" fontSize={11} fill="var(--ink)">
              {t.bestWindow(percent(best.mean_p))}
            </text>
          </g>
        ) : null}

        {/* bars + whiskers */}
        {crop.p_success.map((v, i) => {
          const d = i + 1;
          const top = y(v.p);
          const h = M.top + plotH - top;
          const r = Math.min(4, barW / 2, h);
          const bx = x(d) + (bw - barW) / 2;
          const isActive = active === d;
          return (
            <g key={d}>
              {h > 0.5 ? (
                <path
                  d={`M${bx},${M.top + plotH} V${top + r} Q${bx},${top} ${bx + r},${top} H${bx + barW - r} Q${bx + barW},${top} ${bx + barW},${top + r} V${M.top + plotH} Z`}
                  fill={isActive ? "var(--seq-600)" : "var(--seq-450)"}
                />
              ) : null}
              {bw >= 6 ? (
                <line x1={x(d) + bw / 2} x2={x(d) + bw / 2} y1={y(v.lo)} y2={y(v.hi)} stroke="var(--ink-2)" strokeWidth={1} opacity={0.7} />
              ) : null}
              {/* hit target: the whole column */}
              <rect
                x={x(d)}
                y={M.top}
                width={bw}
                height={plotH}
                fill="transparent"
                onPointerEnter={() => setActive(d)}
                onPointerDown={() => setActive(d)}
              />
              {isActive ? <rect x={x(d)} y={M.top} width={bw} height={plotH} fill="none" stroke="var(--ink)" strokeWidth={1} /> : null}
            </g>
          );
        })}

        {/* today */}
        <line
          x1={x(today) + bw / 2}
          x2={x(today) + bw / 2}
          y1={M.top}
          y2={M.top + plotH}
          stroke="var(--ink)"
          strokeDasharray="3 3"
          strokeWidth={1}
          pointerEvents="none"
        />
        <text x={x(today) + bw / 2 + 3} y={M.top + 10} fontSize={10} fill="var(--ink)" pointerEvents="none">
          {t.todayShort}
        </text>
      </svg>
    </div>
  );

  const legend = (
    <>
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-sm bg-[var(--seq-450)]" aria-hidden /> {t.legendProbability}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-px bg-ink-2" aria-hidden /> {t.legendRange}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-4 rounded-sm border-b-[3px] border-zarc bg-[var(--zarc-soft)]" aria-hidden />
        {crop.zarc ? t.legendZarcDetail(crop.zarc.soil_code, crop.zarc.cycle_code) : t.legendNoZarc}
      </span>
    </>
  );

  const table = (
    <table className="w-full text-left text-xs">
      <thead className="sticky top-0 bg-surface-2">
        <tr>
          <th className="px-2 py-1.5 font-medium">{t.dekad}</th>
          <th className="px-2 py-1.5 font-medium">{t.successRange}</th>
          <th className="px-2 py-1.5 font-medium">{t.zarcColumn}</th>
        </tr>
      </thead>
      <tbody>
        {crop.p_success.map((v, i) => (
          <tr key={i} className="border-t border-border/60">
            <th scope="row" className="px-2 py-1 font-normal">
              {i + 1}. {dekadLabel(i + 1, locale)}
            </th>
            <td className="px-2 py-1 tabular-nums">{percentWithBand(v.p, v.lo, v.hi)}</td>
            <td className="px-2 py-1 tabular-nums">{crop.zarc ? zarcAt(i + 1) || t.notRecommended : "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return <ChartFrame title={t.dekadTitle} legend={legend} chart={chart} table={table} />;
}
