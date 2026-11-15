"use client";

import type { Regime, SoilClass } from "@/contract/types";
import { Segmented } from "@/components/ui/segmented";

type SoilChoice = "1" | "2" | "3" | "unknown";
type RegimeChoice = Regime | "unknown";

export function OptionsForm({
  soil,
  regime,
  onSoil,
  onRegime,
}: {
  soil: SoilClass | null;
  regime: Regime | null;
  onSoil: (v: SoilClass | null) => void;
  onRegime: (v: Regime | null) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1 flex items-baseline justify-between">
          <span className="text-xs font-medium text-ink-2" id="soil-label">
            Soil type <span className="font-normal text-muted">(optional)</span>
          </span>
          {soil === null ? <span className="text-[11px] text-muted">default: medium</span> : null}
        </div>
        <Segmented<SoilChoice>
          label="Soil type"
          value={soil ? (String(soil) as SoilChoice) : "unknown"}
          onChange={(v) => onSoil(v === "unknown" ? null : (Number(v) as SoilClass))}
          options={[
            { value: "1", label: "Sandy", hint: "ZARC soil class 1" },
            { value: "2", label: "Medium", hint: "ZARC soil class 2" },
            { value: "3", label: "Clayey", hint: "ZARC soil class 3" },
            { value: "unknown", label: "Not sure", hint: "Uses medium (class 2) and says so" },
          ]}
        />
      </div>
      <div>
        <div className="mb-1 flex items-baseline justify-between">
          <span className="text-xs font-medium text-ink-2">
            Water <span className="font-normal text-muted">(optional)</span>
          </span>
          {regime === null ? <span className="text-[11px] text-muted">default: rainfed</span> : null}
        </div>
        <Segmented<RegimeChoice>
          label="Water regime"
          value={regime ?? "unknown"}
          onChange={(v) => onRegime(v === "unknown" ? null : v)}
          options={[
            { value: "rainfed", label: "Rain only" },
            { value: "irrigated", label: "Irrigated" },
            { value: "unknown", label: "Not sure" },
          ]}
        />
      </div>
    </div>
  );
}
