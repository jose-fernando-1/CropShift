"use client";

import { Crosshair } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { useMessages } from "@/i18n/use-i18n";

/**
 * Parses latitude first: "-8.6, -36.4", "-8.6 -36.4", and the Brazilian
 * decimal-comma forms "-8,6; -36,4" or "-8,6 -36,4".
 */
export function parseCoordinates(text: string): { lat: number; lon: number } | null {
  let t = text.trim();
  if (t.includes(";")) t = t.replace(/,/g, ".").replace(/;/g, " ");
  else if (!t.includes(".") && /^\S+,\S+\s+\S+,\S+$/.test(t)) t = t.replace(/,/g, ".");
  const parts = t.replace(/,/g, " ").split(/\s+/).filter(Boolean);
  if (parts.length !== 2) return null;
  const [lat, lon] = parts.map(Number);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat, lon };
}

export function CoordinateInput({ onSubmit, disabled }: { onSubmit: (lat: number, lon: number) => void; disabled?: boolean }) {
  const id = useId();
  const t = useMessages().location;
  const [text, setText] = useState("");
  const [invalid, setInvalid] = useState(false);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const c = parseCoordinates(text);
        if (!c) {
          setInvalid(true);
          return;
        }
        setInvalid(false);
        onSubmit(c.lat, c.lon);
      }}
    >
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-ink-2">
        {t.coordsLabel}
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          inputMode="decimal"
          placeholder="-8.60, -36.40"
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-invalid={invalid ? true : undefined}
          aria-describedby={invalid ? `${id}-err` : undefined}
          disabled={disabled}
          className="h-10 min-w-0 flex-1 rounded-md border border-border bg-surface px-3 font-mono text-sm placeholder:text-muted"
        />
        <Button type="submit" variant="secondary" disabled={disabled}>
          <Crosshair aria-hidden /> {t.go}
        </Button>
      </div>
      {invalid ? (
        <p id={`${id}-err`} className="mt-1 text-xs text-critical-ink">
          {t.coordsError}
        </p>
      ) : null}
    </form>
  );
}
