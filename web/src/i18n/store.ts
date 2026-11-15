"use client";

import { DEFAULT_LOCALE, isLocale, type Locale } from "./locales";

/**
 * Client-side locale store (same pattern as lib/api/request-log.ts). Updated
 * synchronously from the switcher, so the next render's query keys and
 * fetches already use the new language.
 */
const STORAGE_KEY = "fs-lang";
let current: Locale | null = null;
const listeners = new Set<() => void>();

function read(): Locale {
  if (current) return current;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    current = isLocale(saved) ? saved : DEFAULT_LOCALE;
  } catch {
    current = DEFAULT_LOCALE;
  }
  return current;
}

export const localeStore = {
  get: read,
  getServer: (): Locale => DEFAULT_LOCALE,
  set(locale: Locale) {
    current = locale;
    try {
      window.localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      /* storage blocked: keep it for this page only */
    }
    for (const l of listeners) l();
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
