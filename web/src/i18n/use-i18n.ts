"use client";

import { useEffect, useSyncExternalStore } from "react";
import { getMessages } from "./index";
import type { Locale } from "./locales";
import { localeStore } from "./store";

/** Current UI locale; "en" during server render and hydration, then the saved choice. */
export function useLocale(): Locale {
  return useSyncExternalStore(localeStore.subscribe, localeStore.get, localeStore.getServer);
}

export function useMessages() {
  return getMessages(useLocale());
}

export function setLocale(locale: Locale) {
  localeStore.set(locale);
}

/** Keeps <html lang> and the tab title in step with the chosen language. */
export function useDocumentLocale() {
  const locale = useLocale();
  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = getMessages(locale).app.title;
  }, [locale]);
}
