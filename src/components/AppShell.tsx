"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { BottomNav, SideNav } from "@/components/AppNav";
import { ReminderRunner } from "@/components/ReminderRunner";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";
import { useAccountSync, useEntitlementSync } from "@/lib/use-app-state";

/** Routes that own the whole screen: no chrome, no distractions. */
const FULL_BLEED = [
  "/app/start",
  "/app/workout",
  "/app/done",
  "/app/pro",
  "/app/welcome",
  "/app/save",
];

function Sync() {
  // A checkout return carries the session id, which unlocks Pro immediately
  // rather than waiting on the webhook round trip.
  const sessionId = useSearchParams().get("session_id");
  useEntitlementSync(sessionId);
  useAccountSync();
  return null;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const bare = FULL_BLEED.some((route) => pathname.startsWith(route));

  return (
    <div className="min-h-dvh bg-paper">
      <Suspense fallback={null}>
        <Sync />
      </Suspense>
      <ServiceWorkerRegistrar />
      <ReminderRunner />
      {bare ? (
        <div className="mx-auto flex min-h-dvh w-full max-w-[520px] flex-col lg:max-w-[720px]">
          {children}
        </div>
      ) : (
        <div className="mx-auto flex min-h-dvh w-full max-w-[1120px]">
          <SideNav />
          <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
            <main className="mx-auto flex w-full max-w-[520px] flex-1 flex-col lg:max-w-none lg:px-10 lg:py-4">
              {children}
            </main>
            <BottomNav />
          </div>
        </div>
      )}
    </div>
  );
}
