"use client";

import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { useCrops } from "@/lib/api/queries";
import { LIMITS } from "@/components/results/limits-panel";

const STATUS_LABEL = { passed: "Passed", failed: "Failed", not_run: "Not run yet" } as const;

export function DataLimitsDialog() {
  const crops = useCrops();
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="link" size="sm" className="h-auto">
          <Info aria-hidden /> Data, method &amp; limits
        </Button>
      </DialogTrigger>
      <DialogContent title="How Field Shift works" description="Method, quality gate and the limits of these results.">
        <div className="space-y-5 text-sm leading-relaxed">
          <section>
            <h3 className="font-semibold">Method</h3>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-ink-2">
              <li>Daily NASA POWER climate (1984–2024) for the 0.5° cell of your municipality gives reference evapotranspiration (FAO-56 Penman-Monteith) and rain.</li>
              <li>For each crop and each of the 36 planting dekads, a water balance runs over 40 seasons: crop demand per growth stage (Kc × ET0) against rain plus soil storage.</li>
              <li>A season succeeds when actual/required water use is at least 0.80 and the flowering deficit is under 25 mm. Probability = successful seasons / 40.</li>
              <li>The result is shown next to the official ZARC window and the municipality&apos;s recorded yields (IBGE PAM).</li>
              <li>Explanations are written from the results by template; when enabled, Gemini only rewrites them and is checked against the numbers.</li>
            </ol>
          </section>
          <section>
            <h3 className="font-semibold">Quality gate</h3>
            <p className="mt-1 text-ink-2">
              A crop is ranked only if the engine reproduces the ZARC window on held-out municipalities (rank correlation ≥ 0.70).
            </p>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-ink-2">
                  <tr className="border-b border-border">
                    <th className="py-1.5 pr-3 font-medium">Crop</th>
                    <th className="py-1.5 pr-3 font-medium">Gate</th>
                    <th className="py-1.5 pr-3 font-medium">Correlation</th>
                    <th className="py-1.5 font-medium">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {crops.data?.crops.map((c) => (
                    <tr key={c.crop_id} className="border-b border-border/60 align-top">
                      <td className="py-1.5 pr-3">{c.name}</td>
                      <td className="py-1.5 pr-3">{STATUS_LABEL[c.gate.status]}</td>
                      <td className="py-1.5 pr-3 tabular-nums">{c.gate.value ?? "—"}</td>
                      <td className="py-1.5 text-ink-2">{c.gate.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {crops.isLoading ? <p className="py-2 text-ink-2">Loading crop catalog…</p> : null}
              {crops.isError ? <p className="py-2 text-critical-ink">Could not load the crop catalog.</p> : null}
            </div>
          </section>
          <section>
            <h3 className="font-semibold">Limits</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-2">
              {LIMITS.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
