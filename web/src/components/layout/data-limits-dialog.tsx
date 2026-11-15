"use client";

import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { useMessages } from "@/i18n/use-i18n";
import { useCrops } from "@/lib/api/queries";

export function DataLimitsDialog() {
  const m = useMessages();
  const crops = useCrops();
  const c = m.method;
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="link" size="sm" className="h-auto">
          <Info aria-hidden /> {c.trigger}
        </Button>
      </DialogTrigger>
      <DialogContent title={c.title} description={c.description}>
        <div className="space-y-5 text-sm leading-relaxed">
          <section>
            <h3 className="font-semibold">{c.methodTitle}</h3>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-ink-2">
              {c.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </section>
          <section>
            <h3 className="font-semibold">{c.gateTitle}</h3>
            <p className="mt-1 text-ink-2">{c.gateText}</p>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-ink-2">
                  <tr className="border-b border-border">
                    <th className="py-1.5 pr-3 font-medium">{c.gateColumns.crop}</th>
                    <th className="py-1.5 pr-3 font-medium">{c.gateColumns.gate}</th>
                    <th className="py-1.5 pr-3 font-medium">{c.gateColumns.correlation}</th>
                    <th className="py-1.5 font-medium">{c.gateColumns.note}</th>
                  </tr>
                </thead>
                <tbody>
                  {crops.data?.crops.map((crop) => (
                    <tr key={crop.crop_id} className="border-b border-border/60 align-top">
                      <td className="py-1.5 pr-3">{crop.name}</td>
                      <td className="py-1.5 pr-3">{c.gateStatus[crop.gate.status]}</td>
                      <td className="py-1.5 pr-3 tabular-nums">
                        {crop.gate.value === null ? "—" : crop.gate.value.toLocaleString(m.numberLocale)}
                      </td>
                      <td className="py-1.5 text-ink-2">{crop.gate.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {crops.isLoading ? <p className="py-2 text-ink-2">{c.loading}</p> : null}
              {crops.isError ? <p className="py-2 text-critical-ink">{c.loadError}</p> : null}
            </div>
          </section>
          <section>
            <h3 className="font-semibold">{c.limitsTitle}</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-2">
              {m.limits.items.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
