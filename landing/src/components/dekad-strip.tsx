/**
 * Illustrative version of the app's main chart: probability of success for each of the 36 planting dekads,
 * with the official ZARC window outlined. The values are a smooth example curve, not a real result, and the
 * caption says so.
 */
const PEAK = 13.5;
const WIDTH = 3.2;
const ZARC_FIRST = 11;
const ZARC_LAST = 16;
const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

const values = Array.from({ length: 36 }, (_, i) => {
  const d = i + 1;
  return Math.round(84 * Math.exp(-((d - PEAK) ** 2) / (2 * WIDTH ** 2)));
});

function ramp(p: number) {
  if (p >= 75) return "var(--seq-700)";
  if (p >= 60) return "var(--seq-600)";
  if (p >= 45) return "var(--seq-500)";
  if (p >= 30) return "var(--seq-400)";
  if (p >= 18) return "var(--seq-300)";
  if (p >= 8) return "var(--seq-200)";
  if (p >= 3) return "var(--seq-100)";
  return "var(--seq-0)";
}

export function DekadStrip() {
  return (
    <figure className="rounded-2xl border border-border bg-surface p-5 shadow-xl shadow-brand-deep/10 sm:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-semibold">Cowpea</p>
        <p className="text-sm text-muted">Agreste, Pernambuco · rainfed</p>
      </div>
      <p className="mt-1 text-sm text-ink-2">Chance of a successful season, by planting dekad</p>

      <div className="mt-5 flex h-36 items-end gap-[3px]" aria-hidden>
        {values.map((p, i) => {
          const d = i + 1;
          const inZarc = d >= ZARC_FIRST && d <= ZARC_LAST;
          return (
            <div key={d} className="flex h-full flex-1 flex-col justify-end">
              <div className="rounded-t-[3px]" style={{ height: `${Math.max(p, 3)}%`, background: ramp(p) }} />
              <div className={`mt-1 h-2 rounded-[2px] ${inZarc ? "border-2 border-zarc" : "bg-surface-3"}`} />
            </div>
          );
        })}
      </div>
      <div className="mt-1 grid grid-cols-12 text-center text-[11px] text-muted" aria-hidden>
        {MONTHS.map((m, i) => (
          <span key={i}>{m}</span>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-2">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-6 rounded-sm" style={{ background: "linear-gradient(90deg, var(--seq-100), var(--seq-700))" }} />
          more seasons succeed
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-6 rounded-sm border-2 border-zarc" />
          official ZARC window
        </span>
      </div>
      <figcaption className="mt-3 text-xs text-muted">
        Illustrative example. The demo computes the real values for your municipality.
      </figcaption>
    </figure>
  );
}
