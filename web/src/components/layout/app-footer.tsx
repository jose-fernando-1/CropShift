"use client";

import { useMessages } from "@/i18n/use-i18n";
import { DataLimitsDialog } from "./data-limits-dialog";
import { nasaData, otherData, projectRepository } from "./sources";

export function AppFooter() {
  const m = useMessages();
  const repository = projectRepository(m);
  return (
    <footer className="mt-auto border-t border-border bg-surface-2">
      <div className="mx-auto grid max-w-app gap-6 px-4 py-6 text-sm sm:grid-cols-2 lg:grid-cols-4 lg:px-6">
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
        <section>
          <h2 className="font-semibold">{m.footer.projectRepository}</h2>
          <ul className="mt-2 space-y-1">
            <li>
              <a
                className="inline-flex items-center gap-1.5 text-brand underline-offset-2 hover:underline"
                href={repository.url}
                target="_blank"
                rel="noreferrer"
              >
                <svg className="size-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 .297a12 12 0 0 0-3.79 23.385c.6.112.82-.26.82-.577v-2.234c-3.338.726-4.043-1.416-4.043-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.73.083-.73 1.205.085 1.84 1.237 1.84 1.237 1.07 1.835 2.807 1.305 3.492.998.108-.776.418-1.305.762-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.124-.303-.535-1.523.117-3.176 0 0 1.008-.322 3.3 1.23a11.5 11.5 0 0 1 3.003-.404c1.018.005 2.043.138 3.003.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.873.118 3.176.77.84 1.233 1.91 1.233 3.22 0 4.61-2.804 5.625-5.475 5.92.43.372.823 1.102.823 2.222v3.293c0 .32.216.694.825.576A12 12 0 0 0 12 .297" />
                </svg>
                {repository.name}
              </a>
            </li>
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
