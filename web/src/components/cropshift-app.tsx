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
import { useDocumentLocale, useMessages } from "@/i18n/use-i18n";
import { useHealth, useRecommendation } from "@/lib/api/queries";
import { useAnalysisState } from "@/lib/state/use-analysis-state";

export function CropshiftApp({ dataFlowAllowed }: { dataFlowAllowed: boolean }) {
  useDocumentLocale();
  const m = useMessages();
  const state = useAnalysisState();
  const health = useHealth();
  const debug = useSearchParams().get("debug") === "1";
  const [inspectorOpen, setInspectorOpen] = useState(false);

  const recommendation = useRecommendation(state.request);

  const isMock = health.data?.mock === true || recommendation.data?.mock === true;
  const inspectorEnabled = dataFlowAllowed && (isMock || debug);
  const mode = health.data ? (health.data.mock ? "mock" : "live") : "unknown";
  const openInspector = inspectorEnabled ? () => setInspectorOpen(true) : null;

  return (
    <>
      {isMock ? <MockBanner /> : null}
      <AppHeader inspectorEnabled={inspectorEnabled} onOpenInspector={() => setInspectorOpen(true)} />

      <main className="mx-auto grid w-full max-w-7xl flex-1 gap-6 px-4 py-6 lg:grid-cols-[380px_minmax(0,1fr)] xl:grid-cols-[420px_minmax(0,1fr)]">
        <aside className="space-y-6 lg:sticky lg:top-12 lg:self-start">
          <LocationPanel state={state} />
          <section aria-labelledby="options-title" className="space-y-3">
            <h2 id="options-title" className="font-semibold">
              {m.options.title}
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
              requestPoint={state.request && "lat" in state.request ? { lat: state.request.lat, lon: state.request.lon } : null}
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
  const t = useMessages().empty;
  return (
    <div className="space-y-5" data-testid="empty-state">
      <section className="rounded-lg border border-border bg-surface p-6">
        <h2 className="text-xl font-semibold">{t.title}</h2>
        <p className="mt-2 max-w-prose text-ink-2">{t.text}</p>
        <ol className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          {t.steps.map((step) => (
            <li key={step.title} className="rounded-md bg-surface-2 p-3">
              <strong className="block">{step.title}</strong>
              {step.text}
            </li>
          ))}
        </ol>
      </section>
      <LimitsPanel />
    </div>
  );
}
