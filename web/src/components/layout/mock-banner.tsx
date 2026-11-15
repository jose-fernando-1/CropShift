"use client";

import { FlaskConical } from "lucide-react";
import { useMessages } from "@/i18n/use-i18n";

/** Always visible while any response carries `mock: true` (plan v2: no synthetic number may pass for real data). */
export function MockBanner() {
  const m = useMessages();
  return (
    <div
      role="status"
      data-testid="mock-banner"
      className="sticky top-0 z-30 border-b border-warning bg-warning-soft text-warning-ink"
      style={{
        backgroundImage: "repeating-linear-gradient(135deg, transparent 0 14px, rgba(250,178,25,0.18) 14px 28px)",
      }}
    >
      <div className="mx-auto flex max-w-app items-center gap-2 px-4 py-1.5 text-sm lg:px-6">
        <FlaskConical className="size-4 shrink-0" aria-hidden />
        <p>
          <strong>{m.banner.strong}</strong> {m.banner.text}
        </p>
      </div>
    </div>
  );
}
