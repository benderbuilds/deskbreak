import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { Prose } from "@/components/marketing/Prose";
import { SUPPORT_EMAIL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Support",
  description: "Get help with DeskBreak.",
  alternates: { canonical: "/support" },
};

export default function SupportPage() {
  return (
    <MarketingShell>
      <Prose
        title="Support"
        intro="A real person reads these. Usually within a day."
      >
        <p>
          Email{" "}
          <a className="font-semibold text-coral" href={`mailto:${SUPPORT_EMAIL}`}>
            {SUPPORT_EMAIL}
          </a>
          .
        </p>

        <h2>Common things</h2>
        <ul>
          <li>
            <strong>I paid but Pro is not showing.</strong> Open{" "}
            <Link className="font-semibold text-coral" href="/app/settings">
              Settings
            </Link>{" "}
            and use Restore Pro with your checkout email.
          </li>
          <li>
            <strong>I want to cancel.</strong> Email us and we will cancel it the same
            day. Pro stays on until the period you paid for runs out.
          </li>
          <li>
            <strong>A move hurts.</strong> Skip it. Then tell us which one, so we can
            look at the cue.
          </li>
          <li>
            <strong>Delete my data.</strong> Email from the address you signed up with.
          </li>
        </ul>
      </Prose>
    </MarketingShell>
  );
}
