"use client";

import { Popover as P } from "radix-ui";
import type { ReactNode } from "react";

export function InfoPopover({ trigger, children, label }: { trigger: ReactNode; children: ReactNode; label: string }) {
  return (
    <P.Root>
      <P.Trigger asChild aria-label={label}>
        {trigger}
      </P.Trigger>
      <P.Portal>
        <P.Content
          sideOffset={6}
          collisionPadding={12}
          className="z-50 max-w-xs rounded-md border border-border bg-surface p-3 text-sm text-ink shadow-lg"
        >
          {children}
          <P.Arrow className="fill-surface" />
        </P.Content>
      </P.Portal>
    </P.Root>
  );
}
