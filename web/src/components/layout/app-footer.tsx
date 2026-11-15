"use client";

import { useMessages } from "@/i18n/use-i18n";
import { DataLimitsDialog } from "./data-limits-dialog";
import { nasaData, otherData } from "./sources";

export function AppFooter() {
  const m = useMessages();
  return (
    <footer className="mt-auto border-t border-border bg-surface-2">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 text-sm sm:grid-cols-3">
        <section>
          <h2 className="font-semibold">{m.footer.nasaData}</h2>
          <ul className="mt-2 space-y-1">
            {nasaData(m).map((d) => (
              <li key={d.url}>
                <a className="text-brand underline-offset-2 hover:underline" href={d.url} target="_blank" rel="noreferrer">
                  {d.name}
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-3">
            <DataLimitsDialog />
          </div>
        </section>
        <section>
          <h2 className="font-semibold">{m.footer.otherSources}</h2>
          <ul className="mt-2 space-y-1">
            {otherData(m).map((d) => (
              <li key={d.url}>
                <a className="text-ink-2 underline-offset-2 hover:underline" href={d.url} target="_blank" rel="noreferrer">
                  {d.name}
                </a>
              </li>
            ))}
          </ul>
        </section>
        <section className="text-ink-2">
          <h2 className="font-semibold text-ink">{m.footer.aiUse}</h2>
          <p className="mt-2">{m.footer.aiText}</p>
          <p className="mt-2">{m.footer.support}</p>
        </section>
      </div>
    </footer>
  );
}
