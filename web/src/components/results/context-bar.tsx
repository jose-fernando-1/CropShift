"use client";

import { Check, Link2, MapPin } from "lucide-react";
import { useState } from "react";
import type { Recommendation } from "@/contract/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLocale, useMessages } from "@/i18n/use-i18n";
import { coordinates } from "@/lib/domain/format";

export function ContextBar({ rec, requestPoint }: { rec: Recommendation; requestPoint: { lat: number; lon: number } | null }) {
  const locale = useLocale();
  const m = useMessages();
  const t = m.context;
  const { location } = rec;
  const atPoint = location.input_mode === "point" && requestPoint !== null;
  const shown = atPoint ? requestPoint : location.municipality_centroid;
  const [copied, setCopied] = useState(false);
  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked: ignore */
    }
  };

  return (
    <section aria-label={t.label} className="rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold" data-testid="result-municipality">
            <MapPin className="size-5 text-brand" aria-hidden /> {location.municipality_name}
          </h2>
          <p className="mt-0.5 text-xs text-ink-2 tabular-nums" title={t.pointTitle[atPoint ? "point" : "municipality"]}>
            <span className="sr-only">{t.pointTitle[atPoint ? "point" : "municipality"]}: </span>
            <span data-testid="result-coordinates">{coordinates(shown.lat, shown.lon, locale)}</span>
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={share} title={t.shareTitle}>
          {copied ? <Check aria-hidden /> : <Link2 aria-hidden />} {copied ? t.copied : t.share}
        </Button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Badge tone="outline">
          {t.soil(m.labels.soil[location.soil_class], location.soil_class)}
          {location.soil_source === "default" ? t.isDefault : ""}
        </Badge>
        <Badge tone="outline">
          {m.labels.regime[location.regime]}
          {location.regime_source === "default" ? t.isDefault : ""}
        </Badge>
        <Badge tone="outline">{t.method(rec.method_version)}</Badge>
        {rec.mock ? <Badge tone="warning">{t.mock}</Badge> : null}
      </div>
    </section>
  );
}
