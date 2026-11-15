"use client";

import { CircleAlert, CircleCheck, CircleDot } from "lucide-react";
import type { Confidence } from "@/contract/types";
import { InfoPopover } from "@/components/ui/popover";
import { useMessages } from "@/i18n/use-i18n";
import { cn } from "@/lib/utils";

const STYLE = {
  high: { icon: CircleCheck, className: "border-good/40 bg-[#eaf6ea] text-good-ink" },
  medium: { icon: CircleDot, className: "border-warning/60 bg-warning-soft text-warning-ink" },
  low: { icon: CircleAlert, className: "border-critical/40 bg-critical-soft text-critical-ink" },
} as const;

/** Confidence level with its reasons one click away (icon + label, never colour alone). */
export function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  const m = useMessages();
  const { icon: Icon, className } = STYLE[confidence.level];
  const level = m.labels.confidence[confidence.level];
  return (
    <InfoPopover
      label={m.confidence.why(level)}
      trigger={
        <button
          type="button"
          className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium", className)}
        >
          <Icon className="size-3.5" aria-hidden />
          {m.confidence.badge(level)}
        </button>
      }
    >
      <p className="font-medium">{m.confidence.title(level)}</p>
      <ul className="mt-1 list-disc space-y-1 pl-4 text-ink-2">
        {confidence.reasons.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted">{m.confidence.rule}</p>
    </InfoPopover>
  );
}
