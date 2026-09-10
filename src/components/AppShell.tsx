"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { BottomNav } from "@/components/BottomNav";
import { useEntitlementSync } from "@/lib/use-app-state";

/** Routes that own the whole screen: no chrome, no distractions. */
const FULL_BLEED = ["/app/start", "/app/workout", "/app/done", "/app/pro", "/app/welcome"];

function EntitlementSync() {
  // A checkout return carries the session id, which unlocks Pro immediately
  // rather than waiting on the webhook round trip.
  const sessionId = useSearchParams().get("session_id");
  useEntitlementSync(sessionId);
  return null;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const bare = FULL_BLEED.some((route) => pathname.startsWith(route));

  return (
    <div className="min-h-dvh bg-paper">
      <Suspense fallback={null}>
        <EntitlementSync />
      </Suspense>
      <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col">
        {children}
        {bare ? null : <BottomNav />}
      </div>
    </div>
  );
}
