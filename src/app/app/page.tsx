import { Suspense } from "react";
import { NotificationActionHandler } from "@/components/NotificationActionHandler";
import { TodayView } from "@/components/TodayView";

export const metadata = { title: "Today", robots: { index: false } };

export default function TodayPage() {
  return (
    <>
      <Suspense fallback={null}>
        <NotificationActionHandler />
      </Suspense>
      <TodayView />
    </>
  );
}
