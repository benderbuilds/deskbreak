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
          <li>
            An email address, if you give us one, so we can sign you in with a link,
            sync your progress between devices and, only if you turn it on, send a
            daily reminder.
          </li>
          <li>
            A random anonymous id for your browser, so a purchase can be matched back
            to the device that made it.
          </li>
          <li>
            Sign-in links are single use and expire within the hour. We keep only a
            hash of each one, plus a short record of how often links were requested
            so the sign-in form cannot be abused.
          </li>
          <li>
            If you turn on push notifications, the subscription your browser hands
            us, so we can nudge you at the break times you chose. Turning push off
            removes it.
          </li>
          <li>
            Your workday plan: the hours you work, the days, and which breaks you
            snoozed or skipped, so the next nudge lands at a better time.
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
