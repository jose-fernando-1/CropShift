/**
 * Dekad (decêndio) helpers. A year has 36 dekads, three per month:
 * days 1-10, 11-20 and 21-end. Dekad 1 = Jan 1-10 is an assumption the
 * ZARC dictionary does not state; the UI shows it in the limits panel.
 */

import { getMessages, type Locale } from "@/i18n";

export const DEKADS = Array.from({ length: 36 }, (_, i) => i + 1);

/** Month abbreviations from the message catalog (static tables, not Intl, so output never depends on ICU). */
export function monthNames(locale: Locale = "en") {
  return getMessages(locale).months;
}

/** Days per month in a non-leap year; Feb dekad 3 ends on the 28th. */
const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function dekadMonth(dekad: number) {
  return Math.floor((dekad - 1) / 3);
}

export function dekadRange(dekad: number) {
  const month = dekadMonth(dekad);
  const part = (dekad - 1) % 3;
  const startDay = part * 10 + 1;
  const endDay = part === 2 ? MONTH_DAYS[month] : startDay + 9;
  return { month, startDay, endDay };
}

/** "Apr 21–30" (en) / "abr 21–30" (pt-BR) */
export function dekadLabel(dekad: number, locale: Locale = "en") {
  const { month, startDay, endDay } = dekadRange(dekad);
  return `${monthNames(locale)[month]} ${startDay}–${endDay}`;
}

/** "Apr 21" */
export function dekadStartLabel(dekad: number, locale: Locale = "en") {
  const { month, startDay } = dekadRange(dekad);
  return `${monthNames(locale)[month]} ${startDay}`;
}

/** "May 31" */
export function dekadEndLabel(dekad: number, locale: Locale = "en") {
  const { month, endDay } = dekadRange(dekad);
  return `${monthNames(locale)[month]} ${endDay}`;
}

/** "Apr 21 – May 31"; a single dekad renders as "Apr 21–30". */
export function windowLabel(start: number, end: number, locale: Locale = "en") {
  if (start === end) return dekadLabel(start, locale);
  return `${dekadStartLabel(start, locale)} – ${dekadEndLabel(end, locale)}`;
}

/** Number of dekads in a window, handling wrap past dekad 36. */
export function windowLength(start: number, end: number) {
  return end >= start ? end - start + 1 : 36 - start + 1 + end;
}

export function dekadOfDate(date: Date) {
  const day = date.getDate();
  const part = day <= 10 ? 0 : day <= 20 ? 1 : 2;
  return date.getMonth() * 3 + part + 1;
}

/** 1-based dekad index advanced by `offset`, wrapping around the year. */
export function shiftDekad(dekad: number, offset: number) {
  return ((((dekad - 1 + offset) % 36) + 36) % 36) + 1;
}
