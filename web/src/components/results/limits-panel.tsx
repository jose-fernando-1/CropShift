"use client";

import { TriangleAlert } from "lucide-react";
import type { Disclaimer } from "@/contract/types";
import { useMessages } from "@/i18n/use-i18n";

/** Shows the API's disclaimers once a result exists; before that, the fixed limits from the message catalog. */
export function LimitsPanel({ disclaimers }: { disclaimers?: Disclaimer[] }) {
  const m = useMessages();
  const items = disclaimers?.map((d) => d.text) ?? m.limits.items;
  return (
    <section aria-labelledby="limits-title" className="rounded-lg border border-border bg-surface-2 p-4">
      <h2 id="limits-title" className="flex items-center gap-2 text-sm font-semibold">
        <TriangleAlert className="size-4 text-warning-ink" aria-hidden /> {m.limits.title}
      </h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-2">
        {items.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </section>
  );
}
