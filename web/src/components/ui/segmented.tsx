"use client";

import { ToggleGroup } from "radix-ui";
import { cn } from "@/lib/utils";

/** Single-choice segmented control (radio-group semantics, arrow-key navigation). */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; hint?: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <ToggleGroup.Root
      type="single"
      aria-label={label}
      value={value}
      onValueChange={(v) => v && onChange(v as T)}
      className="inline-flex w-full rounded-md border border-border bg-surface-2 p-0.5"
    >
      {options.map((o) => (
        <ToggleGroup.Item
          key={o.value}
          value={o.value}
          title={o.hint}
          className={cn(
            "flex-1 rounded px-2 py-1.5 text-sm text-ink-2 transition-colors hover:text-ink",
            "data-[state=on]:bg-surface data-[state=on]:font-medium data-[state=on]:text-ink data-[state=on]:shadow-sm",
          )}
        >
          {o.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
