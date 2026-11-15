"use client";

import { CircleHelp, ExternalLink, ListChecks, ThumbsUp, TriangleAlert } from "lucide-react";
import type { Recommendation } from "@/contract/types";
import { DekadChart } from "@/components/charts/dekad-chart";
import { YieldChart } from "@/components/charts/yield-chart";
import { Dialog, SheetContent } from "@/components/ui/dialog";
import { FIELD_CHECKS } from "@/lib/explain/template";
import { windowLabel } from "@/lib/domain/dekads";
import { kgPerHaNumber, percent } from "@/lib/domain/format";
import { ConfidenceBadge } from "./confidence-badge";
import { Metric } from "./metric";

export function CropDetailSheet({
  rec,
  cropId,
  onClose,
}: {
  rec: Recommendation;
  cropId: string | null;
  onClose: () => void;
}) {
  const crop = rec.crops.find((c) => c.crop_id === cropId);
  return (
    <Dialog open={Boolean(crop)} onOpenChange={(open) => !open && onClose()}>
      {crop ? (
        <SheetContent
          title={
            <span>
              <span className="mr-2 text-ink-2 tabular-nums">#{crop.rank}</span>
              {crop.name}
            </span>
          }
          description={`${rec.location.municipality_name} · soil class ${rec.location.soil_class} · ${rec.location.regime}`}
        >
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <ConfidenceBadge confidence={crop.confidence} />
              <span className="text-xs text-ink-2">Machine-learning calibration: {crop.flags.ml_applied ? "applied" : "not applied (water-balance engine only)"}</span>
            </div>

            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {crop.best_windows[0] ? (
                <Metric
                  emphasis
                  label={`Best window: ${windowLabel(crop.best_windows[0].start_dekad, crop.best_windows[0].end_dekad)}`}
                  value={percent(crop.best_windows[0].mean_p)}
                  unit="avg. success"
                  source="water-balance engine, NASA POWER 1984–2024"
                />
              ) : null}
              {crop.pam?.municipality_median != null ? (
                <Metric label="Local median yield" value={kgPerHaNumber(crop.pam.municipality_median)} unit="kg/ha" source={`IBGE PAM (${crop.pam.crop_label})`} />
              ) : null}
              {crop.pam?.state_median != null ? (
                <Metric label="Pernambuco median yield" value={kgPerHaNumber(crop.pam.state_median)} unit="kg/ha" source={`IBGE PAM (${crop.pam.crop_label})`} />
              ) : null}
            </dl>

            <DekadChart crop={crop} />

            {crop.pam ? <YieldChart pam={crop.pam} municipalityName={rec.location.municipality_name} /> : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <BulletList icon={<ThumbsUp className="size-4 text-good-ink" aria-hidden />} title="Strengths" items={crop.strengths} empty="Nothing stands out." />
              <BulletList icon={<TriangleAlert className="size-4 text-warning-ink" aria-hidden />} title="Risks" items={crop.risks} empty="No specific risk flagged by the simulation." />
              <BulletList icon={<CircleHelp className="size-4 text-ink-2" aria-hidden />} title="Missing data" items={crop.missing_data} empty="None." />
              <BulletList icon={<ListChecks className="size-4 text-brand" aria-hidden />} title="Check in the field" items={FIELD_CHECKS} empty="" />
            </div>

            {crop.zarc ? (
              <p className="text-xs text-ink-2">
                ZARC: season {crop.zarc.season}, cycle {crop.zarc.cycle_code}, soil code {crop.zarc.soil_code}, {crop.zarc.ordinance.replaceAll("_", " ")}.
              </p>
            ) : null}

            <section>
              <h3 className="text-sm font-semibold">Sources</h3>
              <ul className="mt-2 space-y-1 text-sm">
                {crop.sources.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-baseline gap-x-2">
                    {s.url ? (
                      <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand hover:underline">
                        {s.name} <ExternalLink className="size-3" aria-hidden />
                      </a>
                    ) : (
                      <span>{s.name}</span>
                    )}
                    {s.version ? <span className="text-xs text-muted">{s.version}</span> : null}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </SheetContent>
      ) : null}
    </Dialog>
  );
}

function BulletList({ icon, title, items, empty }: { icon: React.ReactNode; title: string; items: string[]; empty: string }) {
  return (
    <section className="rounded-lg border border-border p-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        {icon} {title}
      </h3>
      {items.length > 0 ? (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-2">
          {items.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted">{empty}</p>
      )}
    </section>
  );
}
