"use client";

import { HomeView } from "@/components/HomeView";
import { LandingView } from "@/components/LandingView";
import { useAppState } from "@/lib/use-app-state";
import { useIsClient } from "@/lib/use-client";

export default function HomePage() {
  const isClient = useIsClient();
  const onboarded = useAppState().onboardingComplete;
  if (!isClient || !onboarded) {
    return <LandingView />;
  }
  return <HomeView />;
}
