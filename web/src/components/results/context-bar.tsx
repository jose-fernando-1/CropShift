"use client";

import { Check, Copy, Link2, MapPin } from "lucide-react";
import { useState } from "react";
import type { Recommendation } from "@/contract/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useMessages } from "@/i18n/use-i18n";

export function ContextBar({ rec }: { rec: Recommendation }) {
  const m = useMessages();
  const t = m.context;
  const { location } = rec;
  const [copied, setCopied] = useState<"id" | "link" | null>(null);
  const copy = async (what: "id" | "link") => {
    try {
      await navigator.clipboard.writeText(what === "id" ? rec.analysis_id : window.location.href);
      setCopied(what);
      setTimeout(() => setCopied(null), 1500);
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
          <p className="mt-0.5 text-xs text-ink-2">
            IBGE {location.municipality_code}
            {t.cell(location.power_cell.id, location.power_cell.lat, location.power_cell.lon)}
            {location.input_mode === "point" ? (location.near_centroid ? t.pointSameCell : t.pointOtherCell) : t.municipalityCentre}
          </p>
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => copy("link")} title={t.shareTitle}>
            {copied === "link" ? <Check aria-hidden /> : <Link2 aria-hidden />} {copied === "link" ? t.copied : t.share}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => copy("id")} title={t.copyIdTitle}>
            {copied === "id" ? <Check aria-hidden /> : <Copy aria-hidden />}
            <span className="max-w-36 truncate font-mono text-xs">{rec.analysis_id}</span>
          </Button>
        </div>
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
