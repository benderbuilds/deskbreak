import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { LandingViewTracker } from "@/components/marketing/LandingCta";
import { BreakTimer } from "@/components/marketing/BreakTimer";
import { RichText } from "@/components/marketing/RichText";

const BASE = (process.env.NEXT_PUBLIC_APP_URL || "https://deskbreak.co").replace(/\/$/, "");

const META_TITLE = "Desk break timer: free, no signup";
const META_DESCRIPTION =
  "A free desk break timer that runs in your browser. Pick an interval, get a chime and a notification when it ends, then start a guided 3-minute reset.";

export const metadata: Metadata = {
  title: META_TITLE,
  description: META_DESCRIPTION,
  alternates: { canonical: "/desk-break-timer" },
  openGraph: { title: META_TITLE, description: META_DESCRIPTION },
};

/**
 * Copy rules apply here as everywhere: no official guideline sets a break
 * interval, so the page never recommends one as if it did.
 */
const SECTIONS: { heading: string; body: string }[] = [
  {
    heading: "How it works",
    body: "Pick how long you want to work, then press start. When the time is up you'll hear a chime and, if you allow it, get a browser notification. From there you can start a guided 3-minute reset, snooze for five minutes, or start the next interval. Keep this tab open; the timer remembers where it was if you reload.",
  },
  {
    heading: "How long should the interval be?",
    body: "No official guideline sets one. The studies that tested a rhythm mostly tried breaks of one to a few minutes every 20 to 30 minutes, and several were small or run in a lab; [How often should you get up from your desk?](/blog/how-often-should-you-get-up-from-your-desk) walks through what each one actually tested. Treat any interval as a starting point. Pick one you'll keep, and lengthen it if the chime starts to feel like nagging.",
  },
  {
    heading: "What to do when it goes off",
    body: "Anything that gets you out of the position you've been in. Stand up and walk to refill your water, or do two or three moves beside the desk: a [standing glute squeeze](/moves/standing-glute-squeeze), a [standing overhead reach](/moves/standing-overhead-reach), [wrist circles](/moves/wrist-circles) or a [chin tuck](/moves/chin-tuck). If your eyes are tired, look at something far away for a while; [the 20-20-20 rule](/blog/does-the-20-20-20-rule-work) is one way to remember. The guided reset picks the moves and times them for you.",
  },
  {
    heading: "A reminder that works with the tab closed",
    body: "This timer only runs while the page is open. For a reminder that reaches you when it isn't, turn on the free daily reminder in [the DeskBreak app](/app). It's one reminder a day, at a time you choose.",
  },
];

export default function DeskBreakTimerPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "DeskBreak desk break timer",
    url: `${BASE}/desk-break-timer`,
    description: META_DESCRIPTION,
    applicationCategory: "HealthApplication",
    operatingSystem: "Any",
    browserRequirements: "Requires a modern web browser",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };

  return (
    <MarketingShell>
      <LandingViewTracker page="desk_break_timer" seo />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <article className="py-10">
        <h1 className="font-display font-extrabold text-[2.2rem] leading-tight text-ink">Desk break timer</h1>
        <p className="mt-4 max-w-[42rem] text-lg leading-relaxed text-muted">
          A free timer that tells you when to get up. No account, nothing to install.
        </p>

        <div className="mt-8 max-w-[34rem]">
          <BreakTimer />
        </div>

        <div className="mt-10 max-w-[42rem] space-y-7">
          {SECTIONS.map((section) => (
            <section key={section.heading}>
              <h2 className="font-display font-extrabold text-xl text-ink">{section.heading}</h2>
              <p className="mt-2 leading-relaxed text-ink/70">
                <RichText text={section.body} />
              </p>
            </section>
          ))}
        </div>
      </article>
    </MarketingShell>
  );
}
