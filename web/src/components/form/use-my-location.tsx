"use client";

import { LocateFixed } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { useMessages } from "@/i18n/use-i18n";

export type GeoError = "denied" | "unavailable" | "unsupported";

/**
 * GPS only after an explicit action and consent (plan v2, section 7). The
 * position is used to find the municipality; it is never stored or put in links.
 */
export function UseMyLocation({
  onLocated,
  onError,
  disabled,
}: {
  onLocated: (lat: number, lon: number) => void;
  onError: (error: GeoError) => void;
  disabled?: boolean;
}) {
  const t = useMessages().location;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const locate = () => {
    setOpen(false);
    if (!("geolocation" in navigator)) {
      onError("unsupported");
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBusy(false);
        onLocated(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        setBusy(false);
        onError(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable");
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 },
    );
  };

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)} disabled={disabled || busy} className="w-full">
        <LocateFixed aria-hidden /> {busy ? t.findingYou : t.useMyLocation}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={t.consentTitle} description={t.consentDescription} className="max-w-md">
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-2">
            {t.consentItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <div className="mt-5 flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="ghost">{t.cancel}</Button>
            </DialogClose>
            <Button variant="primary" onClick={locate}>
              {t.allow}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
