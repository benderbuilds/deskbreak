"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isOnboardingComplete } from "@/lib/storage";
import { useIsClient } from "@/lib/use-client";

export function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isClient = useIsClient();
  const onboarded = isClient && isOnboardingComplete();
  const blocked = isClient && !onboarded && pathname !== "/onboarding";

  useEffect(() => {
    if (blocked) {
      router.replace("/onboarding");
    }
  }, [blocked, router]);

  return (
    <div className="min-h-dvh bg-paper">
      <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col">
        {isClient && !blocked ? children : null}
      </div>
    </div>
  );
}
