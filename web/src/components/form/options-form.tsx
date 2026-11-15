"use client";

import type { Regime, SoilClass } from "@/contract/types";
import { Segmented } from "@/components/ui/segmented";
import { useMessages } from "@/i18n/use-i18n";

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
  const t = useMessages().options;
  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1 flex items-baseline justify-between">
          <span className="text-xs font-medium text-ink-2">
            {t.soil} <span className="font-normal text-muted">{t.optional}</span>
          </span>
          {soil === null ? <span className="text-[11px] text-muted">{t.defaultSoil}</span> : null}
        </div>
        <Segmented<SoilChoice>
          label={t.soil}
          value={soil ? (String(soil) as SoilChoice) : "unknown"}
          onChange={(v) => onSoil(v === "unknown" ? null : (Number(v) as SoilClass))}
          options={[
            { value: "1", label: t.sandy, hint: t.soilHint(1) },
            { value: "2", label: t.medium, hint: t.soilHint(2) },
            { value: "3", label: t.clayey, hint: t.soilHint(3) },
            { value: "unknown", label: t.notSure, hint: t.notSureSoilHint },
          ]}
        />
      </div>
      <div>
        <div className="mb-1 flex items-baseline justify-between">
          <span className="text-xs font-medium text-ink-2">
            {t.water} <span className="font-normal text-muted">{t.optional}</span>
          </span>
          {regime === null ? <span className="text-[11px] text-muted">{t.defaultRegime}</span> : null}
        </div>
        <Segmented<RegimeChoice>
          label={t.regimeLabel}
          value={regime ?? "unknown"}
          onChange={(v) => onRegime(v === "unknown" ? null : v)}
          options={[
            { value: "rainfed", label: t.rainOnly },
            { value: "irrigated", label: t.irrigated },
            { value: "unknown", label: t.notSure },
          ]}
        />
      </div>
    </div>
  );
}
