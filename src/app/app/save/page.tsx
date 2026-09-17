import { Suspense } from "react";
import { SaveProgressView } from "@/components/SaveProgressView";
import { LoadingShell } from "@/components/StatusStates";

export const metadata = { title: "Save my progress", robots: { index: false } };

export default function SavePage() {
  return (
    <Suspense fallback={<LoadingShell label="One moment" />}>
      <SaveProgressView />
    </Suspense>
  );
}
