import { ButtonLink } from "@/components/Button";
import { ErrorState } from "@/components/StatusStates";

export const metadata = { title: "Offline", robots: { index: false } };

/** Served by the service worker when a page is not cached and there is no network. */
export default function OfflinePage() {
  return (
    <div className="flex min-h-dvh flex-col justify-center px-5">
      <ErrorState
        title="You're offline"
        body="Your Desk Reset still works. Open Today and start one; it runs entirely on this device."
        action={<ButtonLink href="/app">Open Today</ButtonLink>}
      />
    </div>
  );
}
