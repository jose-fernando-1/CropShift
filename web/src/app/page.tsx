import { Suspense } from "react";
import { FieldShiftApp } from "@/components/field-shift-app";

export default function Home() {
  return (
    <Suspense>
      <FieldShiftApp />
    </Suspense>
  );
}
