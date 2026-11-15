"use client";

import { Search } from "lucide-react";
import { useId, useMemo, useState } from "react";
import type { MunicipalityOption } from "@/lib/api/municipalities";
import { foldAccents } from "@/lib/domain/geo";
import { cn } from "@/lib/utils";

const MAX_RESULTS = 8;

/** Accessible combobox over the 185 municipalities (accent-insensitive). */
export function MunicipalitySearch({
  options,
  onSelect,
  disabled,
}: {
  options: MunicipalityOption[];
  onSelect: (code: string) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const results = useMemo(() => {
    const q = foldAccents(query.trim());
    if (!q) return [];
    const starts = options.filter((o) => o.search.startsWith(q));
    const contains = options.filter((o) => !o.search.startsWith(q) && o.search.includes(q));
    return [...starts, ...contains].slice(0, MAX_RESULTS);
  }, [options, query]);

  const choose = (o: MunicipalityOption) => {
    onSelect(o.code);
    setQuery("");
    setOpen(false);
  };

  const expanded = open && results.length > 0;
  return (
    <div className="relative">
      <label htmlFor={`${id}-input`} className="mb-1 block text-xs font-medium text-ink-2">
        Search a municipality
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
        <input
          id={`${id}-input`}
          role="combobox"
          aria-expanded={expanded}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={expanded ? `${id}-opt-${active}` : undefined}
          autoComplete="off"
          disabled={disabled}
          placeholder="e.g. São Bento do Una"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={(e) => {
            if (!expanded) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => (a + 1) % results.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => (a - 1 + results.length) % results.length);
            } else if (e.key === "Enter") {
              e.preventDefault();
              choose(results[active]);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          className="h-10 w-full rounded-md border border-border bg-surface pl-8 pr-3 text-sm placeholder:text-muted"
        />
      </div>
      {expanded ? (
        <ul id={`${id}-list`} role="listbox" className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-md border border-border bg-surface py-1 shadow-lg">
          {results.map((o, i) => (
            <li
              key={o.code}
              id={`${id}-opt-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(o);
              }}
              onMouseEnter={() => setActive(i)}
              className={cn("cursor-pointer px-3 py-1.5 text-sm", i === active && "bg-surface-2")}
            >
              {o.name}
            </li>
          ))}
        </ul>
      ) : null}
      {open && query.trim() && results.length === 0 ? (
        <p className="mt-1 text-xs text-ink-2" role="status">
          No municipality in Pernambuco matches “{query}”.
        </p>
      ) : null}
    </div>
  );
}
