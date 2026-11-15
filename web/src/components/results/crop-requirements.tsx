"use client";

import { ExternalLink } from "lucide-react";
import type { ReactNode } from "react";
import type { CropRequirements as Requirements, NumberRange } from "@/contract/types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocale, useMessages } from "@/i18n/use-i18n";
import { useCrops } from "@/lib/api/queries";
import { decimal, numberRange } from "@/lib/domain/format";

const FAO56_URL = "https://www.fao.org/4/x0490e/x0490e00.htm";
const ECOCROP_URL = "https://ecocrop.apps.fao.org/ecocrop/srv/en/home";

type Row = { label: ReactNode; value: ReactNode };

/** Raw crop sheet (FAO-56 + EcoCrop) from the /v1/crops catalog, shown in the crop detail sheet. */
export function CropRequirementsSection({ cropId }: { cropId: string }) {
  const m = useMessages();
  const t = m.requirements;
  const tryAgain = m.results.tryAgain;
  const crops = useCrops();
  const requirements = crops.data?.crops.find((c) => c.crop_id === cropId)?.requirements;

  return (
    <section aria-labelledby="crop-requirements-title" className="space-y-3" data-testid="crop-requirements">
      <div>
        <h3 id="crop-requirements-title" className="text-sm font-semibold">
          {t.title}
        </h3>
        <p className="mt-0.5 text-xs text-ink-2">{t.intro}</p>
      </div>
      {crops.isPending ? (
        <div role="status" aria-label={t.loading} className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      ) : crops.isError ? (
        <p className="flex flex-wrap items-center gap-2 text-sm text-ink-2" role="alert">
          {t.error}
          <Button size="sm" variant="secondary" onClick={() => crops.refetch()}>
            {tryAgain}
          </Button>
        </p>
      ) : requirements ? (
        <RequirementTables requirements={requirements} />
      ) : (
        <p className="text-sm text-muted">{t.unavailable}</p>
      )}
    </section>
  );
}

function RequirementTables({ requirements: { fao56, ecocrop } }: { requirements: Requirements }) {
  const locale = useLocale();
  const t = useMessages().requirements;
  const u = t.units;
  const withUnit = (value: string, unit: string) => `${value} ${unit}`;
  const range = (r: NumberRange, unit?: string) => (unit ? withUnit(numberRange(r, locale), unit) : numberRange(r, locale));
  const notListed = <span className="text-muted">{t.notListed}</span>;
  const s = fao56.stage_days;
  const stageSum = s.initial + s.development + s.mid_season + s.late_season;

  const faoRows: Row[] = [
    ...(["initial", "development", "mid_season", "late_season"] as const).map((k) => ({
      label: t.stages[k],
      value: withUnit(String(s[k]), u.days),
    })),
    { label: t.stages.total, value: withUnit(String(s.total), u.days) + (stageSum !== s.total ? " *" : "") },
    { label: t.kcInitial, value: fao56.kc.initial === null ? notListed : decimal(fao56.kc.initial, locale) },
    { label: t.kcMid, value: range(fao56.kc.mid) },
    { label: t.kcEnd, value: range(fao56.kc.end) },
    { label: t.height, value: range(fao56.max_height_m, u.m) },
    { label: t.rootDepth, value: range(fao56.max_root_depth_m, u.m) },
    {
      label: (
        <>
          {t.depletion}
          <span className="block text-xs font-normal text-muted">{t.depletionHint}</span>
        </>
      ),
      value: decimal(fao56.depletion_fraction, locale),
    },
    { label: t.salinity, value: fao56.salinity_threshold_ece_ds_m ? range(fao56.salinity_threshold_ece_ds_m, u.dsM) : notListed },
  ];

  const ecoRows: Row[] = [
    { label: t.species, value: <i>{ecocrop.species}</i> },
    { label: t.tempOptimal, value: range(ecocrop.temperature_optimal_c, u.c) },
    { label: t.tempAbsolute, value: range(ecocrop.temperature_absolute_c, u.c) },
    { label: t.rainOptimal, value: range(ecocrop.rainfall_optimal_mm, u.mmYear) },
    { label: t.rainAbsolute, value: range(ecocrop.rainfall_absolute_mm, u.mmYear) },
    { label: t.ph, value: range(ecocrop.ph_optimal) },
    { label: t.cycle, value: range(ecocrop.cycle_days, u.days) },
    {
      label: t.tolerances,
      value:
        ecocrop.tolerances.length > 0 ? (
          ecocrop.tolerances.map((x) => t.tolerance[x] ?? x).join(", ")
        ) : (
          <span className="text-muted">{t.noneListed}</span>
        ),
    },
  ];

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <RequirementTable caption={t.fao56} rows={faoRows} footnote={stageSum !== s.total ? `* ${t.totalNote(stageSum)}` : null} />
        <RequirementTable caption={t.ecocrop} rows={ecoRows} footnote={null} />
      </div>
      <p className="flex flex-wrap gap-x-3 text-xs text-ink-2">
        <span>{t.source}:</span>
        <a href={FAO56_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand hover:underline">
          FAO-56 <ExternalLink className="size-3" aria-hidden />
        </a>
        <a href={ECOCROP_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand hover:underline">
          EcoCrop <ExternalLink className="size-3" aria-hidden />
        </a>
      </p>
    </>
  );
}

function RequirementTable({ caption, rows, footnote }: { caption: string; rows: Row[]; footnote: string | null }) {
  const t = useMessages().requirements;
  return (
    <div className="rounded-lg border border-border p-3">
      <table className="w-full text-sm">
        <caption className="mb-2 text-left text-xs font-semibold uppercase tracking-wide text-ink-2">{caption}</caption>
        <thead className="sr-only">
          <tr>
            <th scope="col">{t.parameter}</th>
            <th scope="col">{t.value}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-border first:border-t-0">
              <th scope="row" className="py-1.5 pr-3 text-left align-top font-normal text-ink-2">
                {row.label}
              </th>
              <td className="py-1.5 text-right align-top tabular-nums">{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {footnote ? <p className="mt-2 text-xs text-muted">{footnote}</p> : null}
    </div>
  );
}
