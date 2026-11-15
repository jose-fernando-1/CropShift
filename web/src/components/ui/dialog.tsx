"use client";

import { X } from "lucide-react";
import { Dialog as D } from "radix-ui";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

export function DialogContent({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-40 bg-black/40" />
      <D.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 max-h-[88vh] w-[calc(100vw-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg bg-surface p-6 shadow-xl",
          className,
        )}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <D.Title className="text-lg font-semibold">{title}</D.Title>
            {description ? <D.Description className="mt-1 text-sm text-ink-2">{description}</D.Description> : null}
          </div>
          <D.Close className="rounded-md p-1 text-ink-2 hover:bg-surface-2" aria-label="Close">
            <X className="size-5" />
          </D.Close>
        </div>
        {children}
      </D.Content>
    </D.Portal>
  );
}

/** Side sheet (right on desktop, full width on mobile) built on Dialog for focus trapping. */
export function SheetContent({
  title,
  description,
  children,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-40 bg-black/30" />
      <D.Content
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col bg-surface shadow-2xl sm:border-l sm:border-border",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <D.Title className="text-lg font-semibold">{title}</D.Title>
            {description ? <D.Description className="mt-0.5 text-sm text-ink-2">{description}</D.Description> : null}
          </div>
          <D.Close className="rounded-md p-1 text-ink-2 hover:bg-surface-2" aria-label="Close">
            <X className="size-5" />
          </D.Close>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
      </D.Content>
    </D.Portal>
  );
}
