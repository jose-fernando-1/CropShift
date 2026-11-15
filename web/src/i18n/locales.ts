/**
 * Supported UI/API languages. English is always the default (the challenge
 * requires an English UI); pt-BR is opt-in through the header switcher.
 * Safe to import on the server (no browser globals at module load).
 */
export const LOCALES = ["en", "pt-BR"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

function supported(tag: string): Locale | null {
  if (tag === "pt" || tag.startsWith("pt-")) return "pt-BR";
  if (tag === "en" || tag.startsWith("en-")) return "en";
  return null;
}

/**
 * Picks a supported locale from an Accept-Language header, honouring q-values
 * (q=0 means "not acceptable"); anything unknown falls back to English.
 */
export function localeFromAcceptLanguage(header: string | null | undefined): Locale {
  if (!header) return DEFAULT_LOCALE;
  const ranked = header
    .split(",")
    .map((part, index) => {
      const [rawTag, ...params] = part.split(";");
      const qParam = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      const q = qParam ? Number(qParam.slice(2)) : 1;
      return { locale: supported(rawTag.trim().toLowerCase()), q: Number.isFinite(q) ? q : 0, index };
    })
    .filter((x) => x.locale !== null && x.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index);
  return ranked[0]?.locale ?? DEFAULT_LOCALE;
}
