"use client";

import type { Zarc } from "@/contract/types";
import { useLocale, useMessages } from "@/i18n/use-i18n";
import { DEKADS, dekadLabel, monthNames } from "@/lib/domain/dekads";

/** Compact 36-dekad strip of the official ZARC window (used where we show no own estimate). */
export function ZarcStrip({ zarc }: { zarc: Zarc }) {
  const locale = useLocale();
  const t = useMessages().chart;
  const window = DEKADS.filter((d) => zarc.values[d - 1] > 0);
  return (
    <div>
      <div
        className="grid grid-cols-[repeat(36,minmax(0,1fr))] gap-px"
        role="img"
        aria-label={
          window.length > 0
            ? t.zarcStripAria(dekadLabel(window[0], locale), dekadLabel(window[window.length - 1], locale))
            : t.zarcStripNone
        }
      >
        {DEKADS.map((d) => {
          const v = zarc.values[d - 1];
          return (
            <span
              key={d}
              title={`${dekadLabel(d, locale)}: ${v > 0 ? t.zarcValue(v) : t.notRecommended}`}
              className="h-3"
              style={{ background: v > 0 ? "var(--zarc)" : "var(--surface-3)" }}
            />
          );
        })}
      </div>
      <div className="mt-0.5 grid grid-cols-12 text-2xs text-muted" aria-hidden>
        {monthNames(locale).map((m) => (
          <span key={m}>{m[0].toUpperCase()}</span>
        ))}
      </div>
    </div>
  );
}
