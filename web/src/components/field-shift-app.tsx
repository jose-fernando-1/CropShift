"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { AppFooter } from "@/components/layout/app-footer";
import { AppHeader } from "@/components/layout/app-header";
import { MockBanner } from "@/components/layout/mock-banner";
import { LocationPanel } from "@/components/form/location-panel";
import { OptionsForm } from "@/components/form/options-form";
import { InspectorSheet } from "@/components/inspector/inspector-sheet";
import { LimitsPanel } from "@/components/results/limits-panel";
import { ResultsView } from "@/components/results/results-view";
import { useHealth, useRecommendation } from "@/lib/api/queries";
import { useAnalysisState } from "@/lib/state/use-analysis-state";

export function FieldShiftApp() {
  const state = useAnalysisState();
  const health = useHealth();
  const debug = useSearchParams().get("debug") === "1";
  const [inspectorOpen, setInspectorOpen] = useState(false);

  const recommendation = useRecommendation(state.request);

  const isMock = health.data?.mock === true || recommendation.data?.mock === true;
  const inspectorEnabled = isMock || debug;
  const mode = health.data ? (health.data.mock ? "mock" : "live") : "unknown";
  const openInspector = inspectorEnabled ? () => setInspectorOpen(true) : null;

  return (
    <>
      {isMock ? <MockBanner /> : null}
      <AppHeader health={health.data} inspectorEnabled={inspectorEnabled} onOpenInspector={() => setInspectorOpen(true)} />

      <main className="mx-auto grid w-full max-w-7xl flex-1 gap-6 px-4 py-6 lg:grid-cols-[380px_minmax(0,1fr)] xl:grid-cols-[420px_minmax(0,1fr)]">
        <aside className="space-y-6 lg:sticky lg:top-12 lg:self-start">
          <LocationPanel state={state} />
          <section aria-labelledby="options-title" className="space-y-3">
            <h2 id="options-title" className="font-semibold">
              2. About your farm
            </h2>
            <OptionsForm soil={state.soil} regime={state.regime} onSoil={state.setSoil} onRegime={state.setRegime} />
          </section>
        </aside>

        <div className="min-w-0 space-y-5">
          {state.request ? (
            <ResultsView
              rec={recommendation.data}
              error={recommendation.error}
              isLoading={recommendation.isPending}
              isRefetching={recommendation.isFetching && recommendation.isPlaceholderData}
              openCrop={state.crop}
              onOpenCrop={state.openCrop}
              onRetry={() => recommendation.refetch()}
              onOpenInspector={openInspector}
            />
          ) : (
            <EmptyState />
          )}
        </div>
      </main>

      <AppFooter />
      {inspectorEnabled ? <InspectorSheet open={inspectorOpen} onOpenChange={setInspectorOpen} mode={mode} /> : null}
    </>
  );
}

function EmptyState() {
  return (
    <div className="space-y-5" data-testid="empty-state">
      <section className="rounded-lg border border-border bg-surface p-6">
        <h2 className="text-xl font-semibold">What should you plant, and when?</h2>
        <p className="mt-2 max-w-prose text-ink-2">
          Choose a point in Pernambuco. Field Shift replays 40 seasons of NASA climate data to show, for each crop, how
          often planting in each 10-day period would have worked. It puts that next to the official ZARC planting window
          and what your municipality actually harvested.
        </p>
        <ol className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          <li className="rounded-md bg-surface-2 p-3">
            <strong className="block">1. Location</strong>
            Tap the map, search your municipality, type coordinates or use your location.
          </li>
          <li className="rounded-md bg-surface-2 p-3">
            <strong className="block">2. Your farm</strong>
            Soil type and irrigation are optional. If you skip them, defaults are used and shown.
          </li>
          <li className="rounded-md bg-surface-2 p-3">
            <strong className="block">3. Results</strong>
            A planting calendar, ranked crops, the official window, yield history and a plain-language summary.
          </li>
        </ol>
      </section>
      <LimitsPanel />
    </div>
  );
}
