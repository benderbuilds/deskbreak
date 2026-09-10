import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { Prose } from "@/components/marketing/Prose";
import { SUPPORT_EMAIL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What DeskBreak stores, why, and how to get rid of it.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <MarketingShell>
      <Prose
        title="Privacy"
        intro="Short version: we store as little as we can get away with, and we never sell it."
      >
        <h2>What stays on your device</h2>
        <p>
          Your preferences, streak and reset history live in your browser&apos;s local
          storage. Clearing site data clears them. You can use DeskBreak this way
          without ever giving us an email address.
        </p>

        <h2>What we store on our servers</h2>
        <ul>
          <li>An email address, if you give us one, so we can send reminders.</li>
          <li>
            A random anonymous id for your browser, so a purchase can be matched back
            to the device that made it.
          </li>
          <li>
            Completed resets: which routine, how long, and your answer to
            &quot;did that help?&quot;. We use this to pick better routines.
          </li>
          <li>
            Subscription status from Stripe. Card details go to Stripe directly and
            never touch our servers.
          </li>
          <li>
            Where you first arrived from, if a link carried campaign parameters.
          </li>
        </ul>

        <h2>Analytics</h2>
        <p>
          We use PostHog to count how many people start a reset, finish it, and
          subscribe. It is product measurement, not advertising, and we do not sell
          or share it.
        </p>

        <h2>Deleting your data</h2>
        <p>
          Email <a className="font-semibold text-coral" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>{" "}
          from the address you signed up with and we will delete everything tied to
          it, including any subscription record, once the subscription is cancelled.
        </p>
      </Prose>
    </MarketingShell>
  );
}
