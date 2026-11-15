"use client";

import { ToggleGroup } from "radix-ui";
import { isLocale, type Locale } from "@/i18n";
import { setLocale, useLocale, useMessages } from "@/i18n/use-i18n";
import { cn } from "@/lib/utils";

const OPTIONS: { value: Locale; short: string; full: string }[] = [
  { value: "en", short: "EN", full: "English" },
  { value: "pt-BR", short: "PT", full: "Português (Brasil)" },
];

/** EN | PT switch. The choice is remembered on this device; English is the default. */
export function LanguageSwitcher() {
  const locale = useLocale();
  const m = useMessages();
  return (
    <ToggleGroup.Root
      type="single"
      aria-label={m.app.language}
      value={locale}
      onValueChange={(v) => isLocale(v) && setLocale(v)}
      className="inline-flex rounded-md border border-border bg-surface-2 p-0.5"
      data-testid="language-switcher"
    >
      {OPTIONS.map((o) => (
        <ToggleGroup.Item
          key={o.value}
          value={o.value}
          lang={o.value}
          aria-label={o.full}
          title={o.full}
          className={cn(
            "rounded px-2 py-1 text-xs font-medium text-ink-2 hover:text-ink",
            "data-[state=on]:bg-surface data-[state=on]:text-ink data-[state=on]:shadow-sm",
          )}
        >
          {o.short}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
