import { CircleAlert, CircleCheck, CircleDot } from "lucide-react";
import type { Confidence } from "@/contract/types";
import { InfoPopover } from "@/components/ui/popover";
import { CONFIDENCE_LABELS } from "@/lib/domain/format";
import { cn } from "@/lib/utils";

const STYLE = {
  high: { icon: CircleCheck, className: "border-good/40 bg-[#eaf6ea] text-good-ink" },
  medium: { icon: CircleDot, className: "border-warning/60 bg-warning-soft text-warning-ink" },
  low: { icon: CircleAlert, className: "border-critical/40 bg-critical-soft text-critical-ink" },
} as const;

/** Confidence level with its reasons one click away (icon + label, never colour alone). */
export function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  const { icon: Icon, className } = STYLE[confidence.level];
  return (
    <InfoPopover
      label={`${CONFIDENCE_LABELS[confidence.level]} confidence: why?`}
      trigger={
        <button
          type="button"
          className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium", className)}
        >
          <Icon className="size-3.5" aria-hidden />
          {CONFIDENCE_LABELS[confidence.level]} confidence
        </button>
      }
    >
      <p className="font-medium">Why {confidence.level} confidence</p>
      <ul className="mt-1 list-disc space-y-1 pl-4 text-ink-2">
        {confidence.reasons.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted">
        Rule: high when the engine and ZARC agree on the best dekad and the crop passed the quality gate; medium when
        they agree only on the range or your point is away from the municipality centre; low otherwise.
      </p>
    </InfoPopover>
  );
}
