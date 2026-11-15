import type { Locale } from "./locales";
import { en, type Messages } from "./messages/en";
import { ptBR } from "./messages/pt-BR";

export { DEFAULT_LOCALE, LOCALES, isLocale, localeFromAcceptLanguage, type Locale } from "./locales";
export type { Messages } from "./messages/en";

const CATALOG: Record<Locale, Messages> = { en, "pt-BR": ptBR };

/** Messages for code outside React (template, mock, formatters). Components use useMessages(). */
export function getMessages(locale: Locale): Messages {
  return CATALOG[locale];
}
