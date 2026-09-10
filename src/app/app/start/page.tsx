import { Suspense } from "react";
import { StartFlow } from "@/components/StartFlow";
import { LoadingShell } from "@/components/StatusStates";

export const metadata = { title: "Start a DeskBreak", robots: { index: false } };

export default function StartPage() {
  return (
    <Suspense fallback={<LoadingShell label="Getting ready" />}>
      <StartFlow />
    </Suspense>
  );
}
