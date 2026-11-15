import { Ban, Hourglass } from "lucide-react";
import type { ExcludedCrop } from "@/contract/types";
import { Badge } from "@/components/ui/badge";
import { ZarcStrip } from "@/components/charts/zarc-strip";
import { kgPerHa } from "@/lib/domain/format";

/** Crops outside the quality gate: no own estimate, only the official window and recorded yields. */
export function ExcludedCard({ crop }: { crop: ExcludedCrop }) {
  const failed = crop.reason_code === "gate_failed";
  return (
    <li className="rounded-lg border border-dashed border-border bg-surface-2 p-4" data-testid={`excluded-card-${crop.crop_id}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">{crop.name}</h3>
        {failed ? (
          <Badge tone="critical">
            <Ban aria-hidden /> Own estimate not reliable
          </Badge>
        ) : (
          <Badge tone="neutral">
            <Hourglass aria-hidden /> Not ranked yet
          </Badge>
        )}
      </div>
      <p className="mt-1 text-sm text-ink-2">{crop.reason}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-xs text-ink-2">Official ZARC window</p>
          {crop.zarc ? <ZarcStrip zarc={crop.zarc} /> : <p className="text-sm text-muted">Not available for this soil/regime.</p>}
        </div>
        <div>
          <p className="text-xs text-ink-2">Recorded yield here (IBGE PAM)</p>
          {crop.pam && crop.pam.municipality_median !== null ? (
            <p className="text-sm">
              <span className="font-medium tabular-nums">{kgPerHa(crop.pam.municipality_median)}</span>{" "}
              <span className="text-ink-2">
                median, {crop.pam.years.length} {crop.pam.years.length === 1 ? "year" : "years"} ({crop.pam.years[0]}–{crop.pam.years[crop.pam.years.length - 1]})
              </span>
            </p>
          ) : (
            <p className="text-sm text-muted">No recorded yield for this municipality.</p>
          )}
        </div>
      </div>
    </li>
  );
}
