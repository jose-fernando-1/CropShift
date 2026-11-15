import { getMessages, type Locale } from "@/i18n";

export function percent(p: number) {
  return `${Math.round(p * 100)}%`;
}

/** "85% (72–93%)" */
export function percentWithBand(p: number, lo: number, hi: number) {
  return `${percent(p)} (${Math.round(lo * 100)}–${Math.round(hi * 100)}%)`;
}

/** "1,234" (en) / "1.234" (pt-BR) */
export function kgPerHaNumber(value: number, locale: Locale = "en") {
  return Math.round(value).toLocaleString(getMessages(locale).numberLocale);
}

export function kgPerHa(value: number, locale: Locale = "en") {
  return `${kgPerHaNumber(value, locale)} kg/ha`;
}

/** Up to `digits` decimals in the locale's style: "0.45" (en) / "0,45" (pt-BR). */
export function decimal(value: number, locale: Locale = "en", digits = 2) {
  return value.toLocaleString(getMessages(locale).numberLocale, { maximumFractionDigits: digits, useGrouping: false });
}

/** "0.6–1" or "1.05" when min == max. */
export function numberRange(range: { min: number; max: number }, locale: Locale = "en") {
  return range.min === range.max ? decimal(range.min, locale) : `${decimal(range.min, locale)}–${decimal(range.max, locale)}`;
}

/** "-8.6000, -36.4000" (en) / "-8,6000; -36,4000" (pt-BR, same form the coordinate box accepts). */
export function coordinates(lat: number, lon: number, locale: Locale = "en") {
  const f = (v: number) => v.toLocaleString(getMessages(locale).numberLocale, { minimumFractionDigits: 4, maximumFractionDigits: 4, useGrouping: false });
  return `${f(lat)}${locale === "pt-BR" ? ";" : ","} ${f(lon)}`;
}
