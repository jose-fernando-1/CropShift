import { Suspense } from "react";
import { CropshiftApp } from "@/components/cropshift-app";

export default function Home() {
  return (
    <Suspense>
      <CropshiftApp />
    </Suspense>
  );
}
