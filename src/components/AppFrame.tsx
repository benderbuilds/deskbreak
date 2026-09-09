"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LoadingShell } from "@/components/StatusStates";
import { isOnboardingComplete } from "@/lib/storage";
import { useIsClient } from "@/lib/use-client";

const OPEN_PREFIXES = [
  "/",
  "/onboarding",
  "/paywall",
  "/done",
  "/workout/desk-reset-2min",
];

function isOpenPath(pathname: string): boolean {
  if (OPEN_PREFIXES.includes(pathname)) return true;
  if (pathname.startsWith("/paywall")) return true;
  if (pathname.startsWith("/workout/desk-reset-2min")) return true;
  return false;
}

export function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isClient = useIsClient();
  const onboarded = isClient && isOnboardingComplete();
  const needsOnboarding = isClient && !onboarded && !isOpenPath(pathname);

  useEffect(() => {
    if (needsOnboarding) {
      router.replace("/onboarding");
    }
  }, [needsOnboarding, router]);

  useEffect(() => {
    if (isClient && onboarded && pathname === "/onboarding") {
      router.replace("/");
    }
  }, [isClient, onboarded, pathname, router]);

  return (
    <div className="min-h-dvh bg-paper">
      <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col">
        {!isClient ? <LoadingShell /> : needsOnboarding ? <LoadingShell /> : children}
      </div>
    </div>
  );
}
