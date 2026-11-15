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
