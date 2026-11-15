import type { Zarc } from "@/contract/types";
import { DEKADS, MONTHS, dekadLabel } from "@/lib/domain/dekads";

/** Compact 36-dekad strip of the official ZARC window (used where we show no own estimate). */
export function ZarcStrip({ zarc }: { zarc: Zarc }) {
  const window = DEKADS.filter((d) => zarc.values[d - 1] > 0);
  return (
    <div>
      <div className="grid grid-cols-[repeat(36,minmax(0,1fr))] gap-px" role="img" aria-label={`ZARC window: ${window.length > 0 ? `${dekadLabel(window[0])} to ${dekadLabel(window[window.length - 1])}` : "no recommended dekad"}`}>
        {DEKADS.map((d) => {
          const v = zarc.values[d - 1];
          return (
            <span
              key={d}
              title={`${dekadLabel(d)}: ${v > 0 ? `ZARC value ${v}` : "not recommended"}`}
              className="h-3"
              style={{ background: v > 0 ? "var(--zarc)" : "var(--surface-3)" }}
            />
          );
        })}
      </div>
      <div className="mt-0.5 grid grid-cols-12 text-[10px] text-muted" aria-hidden>
        {MONTHS.map((m) => (
          <span key={m}>{m[0]}</span>
        ))}
      </div>
    </div>
  );
}
