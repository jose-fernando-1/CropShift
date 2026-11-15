"use client";

import { useState } from "react";
import type { Pam } from "@/contract/types";
import { useLocale, useMessages } from "@/i18n/use-i18n";
import { kgPerHa, kgPerHaNumber } from "@/lib/domain/format";
import { ChartFrame } from "./chart-frame";
import { useWidth } from "./use-width";

const HEIGHT = 200;
const M = { top: 12, right: 132, bottom: 26, left: 52 };

/** Recorded yield in the municipality (IBGE PAM) against the municipality and state medians. */
export function YieldChart({ pam, municipalityName }: { pam: Pam; municipalityName: string }) {
  const locale = useLocale();
  const t = useMessages().chart;
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);

  const years = pam.years;
  const values = pam.yield_kg_ha;
  const refs = [pam.municipality_median, pam.state_median].filter((v): v is number => v !== null);
  const maxV = niceMax(Math.max(...values, ...refs));
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);
  const span = Math.max(1, maxYear - minYear);

  const plotW = width - M.left - M.right;
  const plotH = HEIGHT - M.top - M.bottom;
  const x = (year: number) => M.left + ((year - minYear) / span) * plotW;
  const y = (v: number) => M.top + plotH * (1 - v / maxV);
  const ticks = [0, 0.5, 1].map((t) => t * maxV);
  const yearTicks = years.filter((yr, i) => i === 0 || i === years.length - 1 || yr % 5 === 0);

  const line = years.map((yr, i) => `${i === 0 ? "M" : "L"}${x(yr)},${y(values[i])}`).join(" ");
  const activeIndex = active === null ? -1 : years.indexOf(active);

  const chart = (
    <div ref={ref}>
      <p className="mb-1 min-h-5 text-xs text-ink-2" aria-live="polite">
        {activeIndex >= 0 ? (
          <>
            <strong className="font-semibold text-ink">{kgPerHa(values[activeIndex], locale)}</strong> {t.yieldIn(years[activeIndex])}
          </>
        ) : (
          t.yieldHint
        )}
      </p>
      <svg
        width={width}
        height={HEIGHT}
        role="img"
        aria-label={t.yieldAria(pam.crop_label, municipalityName, minYear, maxYear)}
        className="block max-w-full"
        onPointerLeave={() => setActive(null)}
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={M.left} x2={M.left + plotW} y1={y(tick)} y2={y(tick)} stroke="var(--border)" strokeWidth={tick === 0 ? 1 : 0.75} />
            <text x={M.left - 6} y={y(tick)} dy="0.32em" textAnchor="end" fontSize={12} fill="var(--ink-2)">
              {kgPerHaNumber(tick, locale)}
            </text>
          </g>
        ))}
        {yearTicks.map((yr) => (
          <text key={yr} x={x(yr)} y={HEIGHT - 8} textAnchor="middle" fontSize={12} fill="var(--ink-2)">
            {yr}
          </text>
        ))}
        {pam.state_median !== null ? (
          <g>
            <line
              x1={M.left}
              x2={M.left + plotW}
              y1={y(pam.state_median)}
              y2={y(pam.state_median)}
              stroke="var(--muted)"
              strokeDasharray="2 3"
              strokeWidth={1.5}
            />
            <text x={M.left + plotW + 6} y={y(pam.state_median)} dy="0.32em" fontSize={12} fill="var(--ink-2)">
              {t.stateMedian(kgPerHaNumber(pam.state_median, locale))}
            </text>
          </g>
        ) : null}
        {pam.municipality_median !== null ? (
          <g>
            <line
              x1={M.left}
              x2={M.left + plotW}
              y1={y(pam.municipality_median)}
              y2={y(pam.municipality_median)}
              stroke="var(--ink-2)"
              strokeDasharray="6 3"
              strokeWidth={1.5}
            />
            <text
              x={M.left + plotW + 6}
              y={y(pam.municipality_median)}
              dy={pam.state_median !== null && Math.abs(y(pam.state_median) - y(pam.municipality_median)) < 12 ? "-0.6em" : "0.32em"}
              fontSize={12}
              fill="var(--ink)"
            >
              {t.localMedian(kgPerHaNumber(pam.municipality_median, locale))}
            </text>
          </g>
        ) : null}
        <path d={line} fill="none" stroke="var(--seq-450)" strokeWidth={2} strokeLinejoin="round" />
        {years.map((yr, i) => (
          <g key={yr}>
            <circle cx={x(yr)} cy={y(values[i])} r={active === yr ? 5 : 4} fill="var(--seq-450)" stroke="var(--surface)" strokeWidth={2} />
            <rect
              x={x(yr) - Math.max(12, plotW / span / 2)}
              y={M.top}
              width={Math.max(24, plotW / span)}
              height={plotH}
              fill="transparent"
              onPointerEnter={() => setActive(yr)}
              onPointerDown={() => setActive(yr)}
            />
          </g>
        ))}
        {active !== null ? (
          <line x1={x(active)} x2={x(active)} y1={M.top} y2={M.top + plotH} stroke="var(--ink)" strokeWidth={1} pointerEvents="none" />
        ) : null}
      </svg>
    </div>
  );

  const table = (
    <table className="w-full text-left text-xs">
      <thead className="sticky top-0 bg-surface-2">
        <tr>
          <th className="px-2 py-1.5 font-medium">{t.year}</th>
          <th className="px-2 py-1.5 font-medium">{t.yieldColumn}</th>
        </tr>
      </thead>
      <tbody>
        {years.map((yr, i) => (
          <tr key={yr} className="border-t border-border/60">
            <td className="px-2 py-1 tabular-nums">{yr}</td>
            <td className="px-2 py-1 tabular-nums">{kgPerHaNumber(values[i], locale)}</td>
          </tr>
        ))}
        <tr className="border-t border-border">
          <td className="px-2 py-1">{t.legendLocal}</td>
          <td className="px-2 py-1 tabular-nums">
            {pam.municipality_median === null ? "—" : kgPerHaNumber(pam.municipality_median, locale)}
          </td>
        </tr>
        <tr className="border-t border-border/60">
          <td className="px-2 py-1">{t.legendState}</td>
          <td className="px-2 py-1 tabular-nums">{pam.state_median === null ? "—" : kgPerHaNumber(pam.state_median, locale)}</td>
        </tr>
      </tbody>
    </table>
  );

  return (
    <ChartFrame
      title={t.yieldTitle}
      subtitle={t.yieldSubtitle(pam.crop_label)}
      legend={
        <>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 bg-[var(--seq-450)]" aria-hidden /> {t.legendYield}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 border-t-2 border-dashed border-ink-2" aria-hidden /> {t.legendLocal}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 border-t-2 border-dotted border-muted" aria-hidden /> {t.legendState}
          </span>
        </>
      }
      chart={chart}
      table={table}
    />
  );
}

function niceMax(v: number) {
  if (v <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(v));
  const n = v / pow;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return nice * pow;
}
