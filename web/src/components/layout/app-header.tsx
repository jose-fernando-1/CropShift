import { Activity, Sprout } from "lucide-react";
import type { Health } from "@/contract/types";
import { Button } from "@/components/ui/button";

export function AppHeader({
  health,
  inspectorEnabled,
  onOpenInspector,
}: {
  health: Health | undefined;
  inspectorEnabled: boolean;
  onOpenInspector: () => void;
}) {
  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-lg bg-brand text-white" aria-hidden>
            <Sprout className="size-5" />
          </span>
          <div>
            <h1 className="text-lg font-semibold leading-tight">Field Shift</h1>
            <p className="text-xs text-ink-2">What to plant and when, in Pernambuco. Decision support, not a substitute for your judgement.</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted">
          {health ? (
            <span className="hidden sm:inline" title="Data and method versions">
              data {health.data_version} · {health.method_version} · contract v{health.contract_version}
            </span>
          ) : null}
          {inspectorEnabled ? (
            <Button size="sm" variant="secondary" onClick={onOpenInspector} data-testid="open-inspector">
              <Activity aria-hidden /> Data flow
            </Button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
