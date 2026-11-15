"use client";

import { Ban, Hourglass } from "lucide-react";
import type { ExcludedCrop } from "@/contract/types";
import { ZarcStrip } from "@/components/charts/zarc-strip";
import { Badge } from "@/components/ui/badge";
import { useLocale, useMessages } from "@/i18n/use-i18n";
import { kgPerHa } from "@/lib/domain/format";

/** Crops outside the quality gate: no own estimate, only the official window and recorded yields. */
export function ExcludedCard({ crop }: { crop: ExcludedCrop }) {
  const locale = useLocale();
  const t = useMessages().excluded;
  const failed = crop.reason_code === "gate_failed";
  const years = crop.pam?.years ?? [];
  return (
    <li className="rounded-lg border border-dashed border-border bg-surface-2 p-4" data-testid={`excluded-card-${crop.crop_id}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">{crop.name}</h3>
        {failed ? (
          <Badge tone="critical">
            <Ban aria-hidden /> {t.unreliable}
          </Badge>
        ) : (
          <Badge tone="neutral">
            <Hourglass aria-hidden /> {t.notYet}
          </Badge>
        )}
      </div>
      <p className="mt-1 text-sm text-ink-2">{crop.reason}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-xs text-ink-2">{t.zarc}</p>
          {crop.zarc ? <ZarcStrip zarc={crop.zarc} /> : <p className="text-sm text-muted">{t.noZarc}</p>}
        </div>
        <div>
          <p className="text-xs text-ink-2">{t.yieldHere}</p>
          {crop.pam && crop.pam.municipality_median !== null && years.length > 0 ? (
            <p className="text-sm">
              <span className="font-medium tabular-nums">{kgPerHa(crop.pam.municipality_median, locale)}</span>{" "}
              <span className="text-ink-2">{t.median(years.length, years[0], years[years.length - 1])}</span>
            </p>
          ) : (
            <p className="text-sm text-muted">{t.noYield}</p>
          )}
        </div>
      </div>
    </li>
  );
}
