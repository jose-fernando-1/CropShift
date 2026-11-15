"use client";

import type { ReactNode } from "react";
import { useMessages } from "@/i18n/use-i18n";
import { cn } from "@/lib/utils";

/**
 * Headline figure with its unit and source together (Definition of Done:
 * "fonte e unidade em cada número"). Used for the key figures in the crop
 * detail; cards and charts carry unit and source in their own captions.
 */
export function Metric({
  label,
  value,
  unit,
  source,
  className,
  emphasis = false,
}: {
  label: ReactNode;
  value: ReactNode;
  unit?: string;
  source: string;
  className?: string;
  emphasis?: boolean;
}) {
  const m = useMessages();
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-xs text-ink-2">{label}</dt>
      <dd className="mt-0.5">
        <span className={cn("tabular-nums", emphasis ? "text-2xl font-semibold" : "text-base font-medium")}>{value}</span>
        {unit ? <span className="ml-1 text-sm text-ink-2">{unit}</span> : null}
        <span className="block truncate text-2xs text-muted" title={source}>
          {m.metric.source} {source}
        </span>
      </dd>
    </div>
  );
}
