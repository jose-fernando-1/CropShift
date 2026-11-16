import { ArrowRight, CloudSun, Droplets, ExternalLink, MapPin, Scale, ShieldCheck, Sprout, Target } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { DekadStrip } from "@/components/dekad-strip";

/** Where the "Open the demo" buttons go. Build-time: `/demo` behind nginx, the web dev server's URL locally. */
const DEMO_URL = process.env.NEXT_PUBLIC_DEMO_URL || "/demo";
const REPOSITORY_URL = "https://github.com/jose-fernando-1/CropShift";
const CHALLENGE_URL = "https://www.spaceappschallenge.org/";

const STATS = [
  { value: "40", label: "seasons of NASA climate (1984–2023)" },
  { value: "36", label: "ten-day planting windows per year" },
  { value: "11", label: "crops, from cowpea to sorghum" },
  { value: "185", label: "municipalities in Pernambuco" },
];

const STEPS = [
  {
    icon: MapPin,
    title: "Pick your field",
    text: "Tap the map, search a municipality, type coordinates or use your location. Soil type and irrigation are optional.",
  },
  {
    icon: CloudSun,
    title: "Read 40 years of climate",
    text: "Daily NASA POWER temperature, humidity, wind, radiation and rain give the reference evapotranspiration (FAO-56).",
  },
  {
    icon: Droplets,
    title: "Simulate every season",
    text: "For each crop and each planting dekad, a stage-by-stage water balance compares what the crop needs with what the field gets.",
  },
  {
    icon: Scale,
    title: "Compare with evidence",
    text: "Crops and windows are ranked, next to the official ZARC window where one exists, local IBGE yield history and a plain-language summary.",
  },
];

const NASA_DATA = [
  {
    name: "NASA POWER",
    role: "Daily climate since 1984 for every municipality: the input of every simulation.",
    url: "https://power.larc.nasa.gov/",
  },
  {
    name: "GPM IMERG",
    role: "Satellite rain, used to cross-check POWER rainfall in the validation.",
    url: "https://gpm.nasa.gov/data/imerg",
  },
  {
    name: "SMAP · MODIS",
    role: "Next step, not used in results yet: soil moisture, NDVI and evapotranspiration for the planned ML calibration.",
    url: "https://appeears.earthdatacloud.nasa.gov/",
  },
];

const OTHER_DATA = [
  { name: "MAPA ZARC", url: "https://dados.agricultura.gov.br/dataset/tabua-de-risco-zoneamento-agricola-de-risco-climatico" },
  { name: "IBGE PAM", url: "https://sidra.ibge.gov.br/tabela/5457" },
  { name: "FAO-56", url: "https://www.fao.org/4/x0490e/x0490e00.htm" },
  { name: "FAO EcoCrop", url: "https://ecocrop.apps.fao.org/ecocrop/srv/en/home" },
  { name: "ISRIC SoilGrids", url: "https://soilgrids.org/" },
  { name: "IBGE maps", url: "https://servicodados.ibge.gov.br/api/docs/malhas?versao=3" },
];

const HONESTY = [
  {
    title: "Checked against the official zoning",
    text: "At the pilot point in São Bento do Una the simulated windows match Brazil’s ZARC with rank correlations of 0.83 (cowpea), 0.84 (peanut) and 0.81 (sorghum). Everywhere, a quality gate re-checks each crop against ZARC and leaves it out when they disagree, instead of guessing.",
  },
  {
    title: "Frequencies, not forecasts",
    text: "“78%” means 78% of the simulated past seasons succeeded. It is not a weather forecast and not a calibrated probability.",
  },
  {
    title: "AI explains, code decides",
    text: "Rankings come from the simulation. Google Gemini only rewrites the computed results in plain language, checked against the numbers.",
  },
  {
    title: "Support, not a substitute",
    text: "Every result lists what to check in the field: soil analysis, markets, pests and the local calendar.",
  },
];

function DemoButton({ className = "", children = "Open the demo", ...props }: ComponentProps<"a">) {
  return (
    <a
      href={DEMO_URL}
      className={`inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-5 font-semibold text-white shadow-sm transition-colors hover:bg-brand-hover ${className}`}
      {...props}
    >
      {children}
      <ArrowRight className="size-4" aria-hidden />
    </a>
  );
}

function Section({ id, eyebrow, title, children }: { id: string; eyebrow: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 px-4 py-16 sm:py-20">
      <div className="mx-auto max-w-page">
        <p className="text-sm font-semibold uppercase tracking-wider text-brand">{eyebrow}</p>
        <h2 className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{title}</h2>
        <div className="mt-10">{children}</div>
      </div>
    </section>
  );
}

export default function LandingPage() {
  return (
    <>
      <header className="sticky top-0 z-10 border-b border-border/70 bg-surface/85 backdrop-blur">
        <nav className="mx-auto flex h-16 max-w-page items-center justify-between gap-4 px-4" aria-label="Main">
          <a href="#top" className="flex items-center gap-2.5 font-semibold">
            <span className="grid size-8 place-items-center rounded-lg bg-brand text-white" aria-hidden>
              <Sprout className="size-5" />
            </span>
            Cropshift
          </a>
          <div className="flex items-center gap-6 text-sm">
            <a href="#how" className="hidden text-ink-2 hover:text-ink sm:inline">
              How it works
            </a>
            <a href="#data" className="hidden text-ink-2 hover:text-ink sm:inline">
              Data
            </a>
            <a href="#trust" className="hidden text-ink-2 hover:text-ink md:inline">
              Limits
            </a>
            <DemoButton className="h-9 text-sm">Demo</DemoButton>
          </div>
        </nav>
      </header>

      <main id="top" className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-b from-brand-soft via-surface to-surface px-4 pt-14 pb-16 sm:pt-20">
          <div className="mx-auto grid max-w-page items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-brand/20 bg-surface px-3 py-1 text-sm text-brand">
                <Sprout className="size-4" aria-hidden />
                NASA Space Apps Challenge 2026 · Team Rural
              </p>
              <h1 className="mt-5 text-5xl font-semibold tracking-tight text-balance sm:text-6xl">
                What to plant, <span className="text-brand">and when.</span>
              </h1>
              <p className="mt-5 max-w-xl text-lg text-ink-2 text-pretty">
                Cropshift turns 40 years of NASA climate data into planting windows for the crops of Pernambuco, Brazil. Pick a field and
                see, for every ten-day window of the year, how often each crop would have had the water it needs.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <DemoButton className="h-12 text-base" />
                <a
                  href="#how"
                  className="inline-flex h-12 items-center rounded-lg border border-border bg-surface px-5 font-medium hover:bg-surface-2"
                >
                  How it works
                </a>
              </div>
              <p className="mt-4 text-sm text-muted">Free, in your browser, no sign-up.</p>
            </div>
            <DekadStrip />
          </div>

          <dl className="mx-auto mt-16 grid max-w-page grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border lg:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label} className="bg-surface px-5 py-5">
                <dt className="sr-only">{s.label}</dt>
                <dd>
                  <span className="block text-3xl font-semibold text-brand tabular-nums">{s.value}</span>
                  <span className="mt-1 block text-sm text-ink-2">{s.label}</span>
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Challenge */}
        <Section id="challenge" eyebrow="The challenge" title="Rotations start with one choice: what goes in the ground next.">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-border bg-surface-2 p-6">
              <div className="flex items-center gap-2 text-sm font-semibold text-ink-2">
                <Target className="size-4" aria-hidden /> What the challenge asks
              </div>
              <p className="mt-3 text-ink-2">
                A decision-support tool that combines NASA Earth observations with local soil, crop characteristics and farmer priorities,
                so farmers can explore rotations that hold up under shifting rain and heat.
              </p>
            </div>
            <div className="rounded-2xl border border-brand/25 bg-brand-soft p-6">
              <div className="flex items-center gap-2 text-sm font-semibold text-brand">
                <Droplets className="size-4" aria-hidden /> How Cropshift answers
              </div>
              <p className="mt-3 text-ink">
                In Pernambuco&apos;s semi-arid interior, water decides the season. Cropshift checks every crop and planting window against
                four decades of real weather and shows why it ranks the way it does, with the evidence, the risks and what to check in the
                field.
              </p>
            </div>
          </div>
        </Section>

        {/* How it works */}
        <section id="how" className="scroll-mt-20 bg-surface-2 px-4 py-16 sm:py-20">
          <div className="mx-auto max-w-page">
            <p className="text-sm font-semibold uppercase tracking-wider text-brand">How it works</p>
            <h2 className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              From a point on the map to a ranked planting calendar.
            </h2>
            <ol className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((s, i) => (
                <li key={s.title} className="relative rounded-2xl border border-border bg-surface p-6">
                  <span className="absolute top-5 right-5 text-sm font-semibold text-muted tabular-nums">0{i + 1}</span>
                  <span className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand" aria-hidden>
                    <s.icon className="size-5" />
                  </span>
                  <h3 className="mt-4 font-semibold">{s.title}</h3>
                  <p className="mt-2 text-sm text-ink-2">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Data */}
        <Section id="data" eyebrow="Data" title="Built on open NASA Earth observations.">
          <ul className="grid gap-5 md:grid-cols-3">
            {NASA_DATA.map((d) => (
              <li key={d.name}>
                <a
                  href={d.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group block h-full rounded-2xl border border-border bg-surface p-6 transition-colors hover:border-brand/40 hover:bg-brand-soft/40"
                >
                  <span className="flex items-center justify-between font-semibold">
                    {d.name}
                    <ExternalLink className="size-4 text-muted group-hover:text-brand" aria-hidden />
                  </span>
                  <span className="mt-2 block text-sm text-ink-2">{d.role}</span>
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-8 text-sm text-ink-2">
            Plus local context:{" "}
            {OTHER_DATA.map((d, i) => (
              <span key={d.name}>
                <a className="text-brand underline-offset-2 hover:underline" href={d.url} target="_blank" rel="noreferrer">
                  {d.name}
                </a>
                {i < OTHER_DATA.length - 1 ? " · " : "."}
              </span>
            ))}
          </p>
        </Section>

        {/* Trust and limits */}
        <section id="trust" className="scroll-mt-20 bg-surface-2 px-4 py-16 sm:py-20">
          <div className="mx-auto max-w-page">
            <p className="text-sm font-semibold uppercase tracking-wider text-brand">Honest by design</p>
            <h2 className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Clear about what it knows, and what it does not.
            </h2>
            <div className="mt-10 grid gap-5 sm:grid-cols-2">
              {HONESTY.map((h) => (
                <div key={h.title} className="flex gap-4 rounded-2xl border border-border bg-surface p-6">
                  <ShieldCheck className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />
                  <div>
                    <h3 className="font-semibold">{h.title}</h3>
                    <p className="mt-1.5 text-sm text-ink-2">{h.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final call to action */}
        <section className="px-4 py-16 sm:py-20">
          <div className="mx-auto flex max-w-page flex-col items-start gap-6 rounded-3xl bg-brand-deep px-6 py-12 text-white sm:px-12 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight text-balance">See the windows for your field.</h2>
              <p className="mt-2 max-w-xl text-white/80">Pick any municipality in Pernambuco and compare the crops side by side.</p>
            </div>
            <a
              href={DEMO_URL}
              className="inline-flex h-12 shrink-0 items-center gap-2 rounded-lg bg-white px-6 font-semibold text-brand-deep transition-colors hover:bg-brand-soft"
            >
              Open the demo
              <ArrowRight className="size-4" aria-hidden />
            </a>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-surface-2">
        <div className="mx-auto grid max-w-page gap-8 px-4 py-10 text-sm text-ink-2 md:grid-cols-3">
          <div>
            <p className="flex items-center gap-2 font-semibold text-ink">
              <Sprout className="size-4 text-brand" aria-hidden /> Cropshift
            </p>
            <p className="mt-2">
              Team Rural, Recife, Brazil.{" "}
              <a className="text-brand underline-offset-2 hover:underline" href={CHALLENGE_URL} target="_blank" rel="noreferrer">
                NASA Space Apps Challenge 2026
              </a>
              .
            </p>
            <p className="mt-2">
              <a
                className="inline-flex items-center gap-1.5 text-brand underline-offset-2 hover:underline"
                href={REPOSITORY_URL}
                target="_blank"
                rel="noreferrer"
              >
                Source code on GitHub <ExternalLink className="size-3.5" aria-hidden />
              </a>
            </p>
          </div>
          <div>
            <p className="font-semibold text-ink">Use of AI</p>
            <p className="mt-2">
              Rankings and probabilities come from code, not from AI. Explanations are optionally rewritten by Google Gemini from the
              computed results. Parts of the code were written with AI assistance.
            </p>
          </div>
          <div>
            <p className="font-semibold text-ink">Disclaimer</p>
            <p className="mt-2">
              Cropshift is decision support and does not replace local agronomic advice. NASA does not endorse this project; NASA data is
              used under NASA&apos;s open data policy.
            </p>
          </div>
        </div>
      </footer>
    </>
  );
}
