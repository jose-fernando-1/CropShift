"use client";

import { Bot, FileText } from "lucide-react";
import { useMemo } from "react";
import type { Recommendation } from "@/contract/types";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocale, useMessages } from "@/i18n/use-i18n";
import { useExplanation } from "@/lib/api/queries";
import { templateExplanation } from "@/lib/explain/template";

/**
 * Plain-language explanation of the result. Comes from /explain (template or
 * AI, checked by the backend); if that call fails, the same deterministic
 * template runs in the browser, so the app always works without AI.
 */
export function ExplanationPanel({ rec }: { rec: Recommendation }) {
  const locale = useLocale();
  const t = useMessages().explain;
  const query = useExplanation(rec.analysis_id);
  const fallback = useMemo(() => (query.isError ? templateExplanation(rec, new Date(), locale) : null), [query.isError, rec, locale]);
  const explanation = query.data ?? fallback;

  const label = !explanation
    ? null
    : explanation.source === "ai"
      ? { icon: <Bot aria-hidden className="size-4" />, text: t.ai }
      : { icon: <FileText aria-hidden className="size-4" />, text: fallback ? t.fallback : t.template };

  return (
    <section aria-labelledby="explain-title" className="rounded-lg border border-border bg-surface p-4" data-testid="explanation">
      <h2 id="explain-title" className="font-semibold">
        {t.title}
      </h2>
      {label ? (
        <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-2" data-testid="explanation-source">
          {label.icon} {label.text}
        </p>
      ) : null}

      {query.isPending && !explanation ? (
        <div className="mt-3 space-y-2">
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-10/12" />
          <Skeleton className="h-4 w-8/12" />
        </div>
      ) : null}

      {explanation ? (
        <div className="mt-3 space-y-4 text-sm leading-relaxed">
          {/* Two balanced columns on wide screens keep lines readable; sections may split between paragraphs. */}
          <div className="xl:columns-2 xl:gap-10">
            {explanation.sections.map((s, i) => (
              <div key={s.id} className={i > 0 ? "mt-4" : undefined}>
                <h3 className="font-medium break-after-avoid">{s.title}</h3>
                {s.paragraphs.map((p) => (
                  <p key={p} className="mt-1 break-inside-avoid text-ink-2">
                    {p}
                  </p>
                ))}
              </div>
            ))}
          </div>
          <div>
            <h3 className="font-medium">{t.checksTitle}</h3>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-ink-2">
              {explanation.field_checks.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </section>
  );
}
