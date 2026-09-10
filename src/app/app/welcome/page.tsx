import { Suspense } from "react";
import { WelcomeView } from "@/components/WelcomeView";
import { LoadingShell } from "@/components/StatusStates";

export const metadata = { title: "Welcome to Pro", robots: { index: false } };

export default function WelcomePage() {
  return (
    <Suspense fallback={<LoadingShell label="Confirming your subscription" />}>
      <WelcomeView />
    </Suspense>
  );
}
