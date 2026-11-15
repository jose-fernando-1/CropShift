import { Suspense } from "react";
import { CropshiftApp } from "@/components/cropshift-app";
import { showDataFlow } from "@/lib/server/flags";

// Rendered per request so SHOW_DATA_FLOW is read at runtime, not baked in at build time.
export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <Suspense>
      <CropshiftApp dataFlowAllowed={showDataFlow()} />
    </Suspense>
  );
}
