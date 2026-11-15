"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CircleCheck, CircleX, Trash2 } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, SheetContent } from "@/components/ui/dialog";
import { useMessages } from "@/i18n/use-i18n";
import { getMockScenario, setMockScenario } from "@/lib/api/client";
import { requestLog, type LoggedRequest } from "@/lib/api/request-log";
import { cn } from "@/lib/utils";

const SCENARIOS = ["none", "power_down", "explain_down", "no_data"];

const EMPTY: LoggedRequest[] = [];

/**
 * Data-flow inspector (mock mode or ?debug=1): every API call with its
 * request, response, timing and contract check, plus failure scenarios.
 */
export function InspectorSheet({
  open,
  onOpenChange,
  mode,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: "mock" | "live" | "unknown";
}) {
  const t = useMessages().inspector;
  const entries = useSyncExternalStore(requestLog.subscribe, requestLog.snapshot, () => EMPTY);
  const [scenario, setScenario] = useState(getMockScenario);
  const [expanded, setExpanded] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const changeScenario = (value: string) => {
    setScenario(value);
    setMockScenario(value);
    queryClient.removeQueries({ queryKey: ["recommendation"] });
    queryClient.removeQueries({ queryKey: ["explanation"] });
    queryClient.invalidateQueries();
  };

  const layers = [
    { name: t.layers.fixtures, note: mode === "live" ? "track A" : "mock-data/*.json", mocked: mode !== "live" },
    { name: t.layers.route, note: mode === "live" ? "proxy → FastAPI" : "src/mocks", mocked: mode !== "live" },
    { name: t.layers.contract, note: "v0.1", mocked: false },
    { name: t.layers.cache, note: "TanStack", mocked: false },
    { name: t.layers.ui, note: "components", mocked: false },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <SheetContent title={t.title} description={t.description}>
        <div className="space-y-5 text-sm">
          <ol className="flex flex-wrap items-center gap-1 text-xs" aria-label={t.pipeline}>
            {layers.map((l, i) => (
              <li key={l.name} className="flex items-center gap-1">
                <span
                  className={cn(
                    "rounded-md border px-2 py-1",
                    l.mocked ? "border-warning bg-warning-soft text-warning-ink" : "border-border bg-surface-2",
                  )}
                >
                  <span className="font-medium">{l.name}</span> <span className="opacity-75">{l.note}</span>
                  {l.mocked ? <span className="ml-1 font-semibold">MOCK</span> : null}
                </span>
                {i < layers.length - 1 ? <ArrowRight className="size-3 text-muted" aria-hidden /> : null}
              </li>
            ))}
          </ol>

          {mode !== "live" ? (
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink-2">{t.scenario}</span>
              <select
                value={scenario}
                onChange={(e) => changeScenario(e.target.value)}
                className="h-9 w-full rounded-md border border-border bg-surface px-2"
                data-testid="scenario-select"
              >
                {SCENARIOS.map((s) => (
                  <option key={s} value={s}>
                    {t.scenarios[s]}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{t.requests(entries.length)}</h3>
            <Button size="sm" variant="ghost" onClick={() => requestLog.clear()}>
              <Trash2 aria-hidden /> {t.clear}
            </Button>
          </div>
          {entries.length === 0 ? <p className="text-ink-2">{t.empty}</p> : null}
          <ul className="space-y-2">
            {entries.map((e) => (
              <li key={e.id} className="rounded-md border border-border">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left"
                  onClick={() => setExpanded((x) => (x === e.id ? null : e.id))}
                  aria-expanded={expanded === e.id}
                >
                  <span className="w-10 font-mono text-xs text-ink-2">{e.method}</span>
                  <span className="min-w-0 flex-1 truncate font-mono text-xs">{e.path}</span>
                  <span className={cn("font-mono text-xs", e.status && e.status >= 400 ? "text-critical-ink" : "text-ink-2")}>
                    {e.status ?? "…"}
                  </span>
                  <span className="w-14 text-right font-mono text-xs text-muted">
                    {e.durationMs !== null ? `${Math.round(e.durationMs)} ms` : ""}
                  </span>
                  {e.schemaOk === null ? null : e.schemaOk ? (
                    <CircleCheck className="size-4 text-good-ink" aria-label={t.matches} />
                  ) : (
                    <CircleX className="size-4 text-critical-ink" aria-label={t.mismatch} />
                  )}
                </button>
                {expanded === e.id ? (
                  <div className="space-y-2 border-t border-border px-3 py-2">
                    <p className="text-xs text-ink-2">
                      Schema: <code>{e.schema}</code> · mode: <code>{e.mode ?? "?"}</code>
                    </p>
                    {e.schemaIssues.length > 0 ? (
                      <ul className="list-disc pl-5 text-xs text-critical-ink">
                        {e.schemaIssues.map((i) => (
                          <li key={i}>{i}</li>
                        ))}
                      </ul>
                    ) : null}
                    {e.requestBody !== undefined ? <Json label={t.requestBody} value={e.requestBody} open /> : null}
                    <Json label={t.responseBody} value={e.responseBody} />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      </SheetContent>
    </Dialog>
  );
}

function Json({ label, value, open = false }: { label: string; value: unknown; open?: boolean }) {
  return (
    <details open={open}>
      <summary className="cursor-pointer text-xs font-medium">{label}</summary>
      <pre className="mt-1 max-h-72 overflow-auto rounded bg-surface-2 p-2 text-[11px] leading-snug">{JSON.stringify(value, null, 2)}</pre>
    </details>
  );
}
