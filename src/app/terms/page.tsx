import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { Prose } from "@/components/marketing/Prose";
import { MOVEMENT_DISCLAIMER, SUPPORT_EMAIL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Terms",
  description: "The terms of using DeskBreak.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <MarketingShell>
      <Prose title="Terms">
        <h2>Movement, not medicine</h2>
        <p>{MOVEMENT_DISCLAIMER}</p>
        <p>
          If you have an injury, a recent surgery, or a condition that movement
          affects, ask someone qualified before using DeskBreak. Skip anything that
          hurts. Every reset has a Skip button for exactly this reason.
        </p>

        <h2>Your account</h2>
        <p>
          DeskBreak Free needs no account. If you give us an email address, keep it
          accurate: it is how a Pro subscription is recovered on a new device.
        </p>

        <h2>Subscriptions</h2>
        <ul>
          <li>DeskBreak Pro is billed monthly or annually through Stripe.</li>
          <li>It renews automatically until you cancel.</li>
          <li>
            Cancelling stops the next charge and leaves Pro active until the end of
            the period you already paid for.
          </li>
          <li>
            Not what you expected? Email us within 30 days and we will refund it.
          </li>
        </ul>

        <h2>What we can change</h2>
        <p>
          The routines, the app and these terms can all change. If a change to these
          terms matters to a paying subscriber, we will email before it takes effect.
        </p>

        <h2>Questions</h2>
        <p>
          <a className="font-semibold text-coral" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        </p>
      </Prose>
    </MarketingShell>
  );
}
