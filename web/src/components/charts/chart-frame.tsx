"use client";

import { Table2, ChartColumn } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

/** Title row with a chart/table toggle: every chart has a table view. */
export function ChartFrame({
  title,
  subtitle,
  legend,
  chart,
  table,
}: {
  title: string;
  subtitle?: ReactNode;
  legend?: ReactNode;
  chart: ReactNode;
  table: ReactNode;
}) {
  const [asTable, setAsTable] = useState(false);
  return (
    <figure className="min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <figcaption>
          <span className="text-sm font-semibold">{title}</span>
          {subtitle ? <span className="block text-xs text-ink-2">{subtitle}</span> : null}
        </figcaption>
        <Button size="sm" variant="ghost" onClick={() => setAsTable((v) => !v)} aria-pressed={asTable}>
          {asTable ? <ChartColumn aria-hidden /> : <Table2 aria-hidden />}
          {asTable ? "View as chart" : "View as table"}
        </Button>
      </div>
      {legend && !asTable ? <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">{legend}</div> : null}
      <div className="mt-2">{asTable ? <div className="max-h-80 overflow-auto rounded-md border border-border">{table}</div> : chart}</div>
    </figure>
  );
}
