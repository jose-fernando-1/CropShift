import { DataLimitsDialog } from "./data-limits-dialog";
import { NASA_DATA, OTHER_DATA } from "./sources";

export function AppFooter() {
  return (
    <footer className="mt-auto border-t border-border bg-surface-2">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 text-sm sm:grid-cols-3">
        <section>
          <h2 className="font-semibold">NASA data</h2>
          <ul className="mt-2 space-y-1">
            {NASA_DATA.map((d) => (
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
          <h2 className="font-semibold">Other sources</h2>
          <ul className="mt-2 space-y-1">
            {OTHER_DATA.map((d) => (
              <li key={d.url}>
                <a className="text-ink-2 underline-offset-2 hover:underline" href={d.url} target="_blank" rel="noreferrer">
                  {d.name}
                </a>
              </li>
            ))}
          </ul>
        </section>
        <section className="text-ink-2">
          <h2 className="font-semibold text-ink">AI use</h2>
          <p className="mt-2">
            Rankings and probabilities come from code, not from AI. Explanations are generated from the results by
            template, and optionally rewritten by Google Gemini, checked against the numbers. Parts of the code were
            written with AI assistance.
          </p>
          <p className="mt-2">Field Shift is decision support. It does not replace your own judgement or local advice.</p>
        </section>
      </div>
    </footer>
  );
}
