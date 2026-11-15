"use client";

import { Activity, Sprout } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMessages } from "@/i18n/use-i18n";
import { LanguageSwitcher } from "./language-switcher";

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION;

export function AppHeader({ inspectorEnabled, onOpenInspector }: { inspectorEnabled: boolean; onOpenInspector: () => void }) {
  const m = useMessages();
  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-lg bg-brand text-white" aria-hidden>
            <Sprout className="size-5" />
          </span>
          <div>
            <h1 className="text-lg font-semibold leading-tight">Cropshift</h1>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted">
          {APP_VERSION ? (
            <span className="hidden tabular-nums sm:inline" title={m.app.versionTitle} data-testid="app-version">
              {m.app.version(APP_VERSION)}
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
