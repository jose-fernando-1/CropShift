"use client";

import { Activity, Sprout } from "lucide-react";
import type { Health } from "@/contract/types";
import { Button } from "@/components/ui/button";
import { useMessages } from "@/i18n/use-i18n";
import { LanguageSwitcher } from "./language-switcher";

export function AppHeader({
  health,
  inspectorEnabled,
  onOpenInspector,
}: {
  health: Health | undefined;
  inspectorEnabled: boolean;
  onOpenInspector: () => void;
}) {
  const m = useMessages();
  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-lg bg-brand text-white" aria-hidden>
            <Sprout className="size-5" />
          </span>
          <div>
            <h1 className="text-lg font-semibold leading-tight">Field Shift</h1>
            <p className="text-xs text-ink-2">{m.app.tagline}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted">
          {health ? (
            <span className="hidden sm:inline" title={m.app.versionsTitle}>
              {m.app.versions(health.data_version, health.method_version, health.contract_version)}
            </span>
          ) : null}
          <LanguageSwitcher />
          {inspectorEnabled ? (
            <Button size="sm" variant="secondary" onClick={onOpenInspector} data-testid="open-inspector">
              <Activity aria-hidden /> {m.app.dataFlow}
            </Button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
