import { Suspense } from "react";
import { PaywallView } from "@/components/PaywallView";
import { LoadingShell } from "@/components/StatusStates";

export const metadata = { title: "DeskBreak Pro", robots: { index: false } };

export default function ProPage() {
  return (
    <Suspense fallback={<LoadingShell label="Loading Pro" />}>
      <PaywallView />
    </Suspense>
  );
}
