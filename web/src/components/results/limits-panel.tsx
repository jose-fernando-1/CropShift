import { TriangleAlert } from "lucide-react";
import type { Disclaimer } from "@/contract/types";

/** Shown before a result exists and in the methods dialog; once a result arrives the API's own disclaimers are used. */
export const LIMITS = [
  "Climate comes from NASA POWER cells of 0.5° × 0.625° (about 55 × 69 km). It does not describe your field.",
  "Soil water is an assumption (0.11 m³/m³ available water), not a measurement.",
  "Independent validation against recorded yields is weak to moderate (one test point).",
  "ZARC is also built from a water balance: agreeing with it shows consistency with the official method, not field success.",
  "Dekad 1 is assumed to be Jan 1–10; ZARC values 20/30/40 are shown as-is because their meaning as risk % is not confirmed.",
];

export function LimitsPanel({ disclaimers }: { disclaimers?: Disclaimer[] }) {
  const items = disclaimers?.map((d) => d.text) ?? LIMITS;
  return (
    <section aria-labelledby="limits-title" className="rounded-lg border border-border bg-surface-2 p-4">
      <h2 id="limits-title" className="flex items-center gap-2 text-sm font-semibold">
        <TriangleAlert className="size-4 text-warning-ink" aria-hidden /> Limits of these results
      </h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-2">
        {items.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </section>
  );
}
