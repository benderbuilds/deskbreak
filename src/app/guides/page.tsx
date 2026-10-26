import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { LandingViewTracker } from "@/components/marketing/LandingCta";
import { AREA_PAGES, GUIDE_PAGES, LANDING_PAGES } from "@/lib/seo-content";

export const metadata: Metadata = {
  title: "Desk exercise guides: short routines for a workday",
  description:
    "Every DeskBreak guide in one place: short desk routines by body area, for standing desks, and for the gap between meetings.",
  alternates: { canonical: "/guides" },
};

/** The hub for every routine and guide page. */
export default function GuidesIndex() {
  const sections = [
    {
      title: "Short guides",
      links: GUIDE_PAGES.map((page) => ({ href: `/guides/${page.slug}`, title: page.title, blurb: page.metaDescription })),
    },
    {
      title: "Routines",
      links: LANDING_PAGES.map((page) => ({ href: `/${page.slug}`, title: page.title, blurb: page.metaDescription })),
    },
    {
      title: "By body area",
      links: AREA_PAGES.map((page) => ({
        href: `/desk-exercises/${page.slug}`,
        title: page.title,
        blurb: page.metaDescription,
      })),
    },
  ];

  return (
    <MarketingShell>
      <LandingViewTracker page="guides" seo />
      <section className="py-10">
        <h1 className="font-display font-extrabold text-[2.2rem] leading-tight text-ink sm:text-[2.6rem]">
          Desk exercise guides
        </h1>
        <p className="mt-4 max-w-[42rem] text-lg leading-relaxed text-muted">
          Short routines that fit a workday, in your clothes, beside your desk. Looking for one move?{" "}
          <Link href="/moves" className="font-semibold text-pen">
            Browse every move
          </Link>
          .
        </p>
        {sections.map((section) => (
          <section key={section.title} className="mt-10">
            <h2 className="font-display font-extrabold text-xl text-ink">{section.title}</h2>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {section.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="surface block h-full px-5 py-5 transition-colors hover:border-ink">
                    <span className="font-display font-extrabold text-lg leading-snug text-ink">{link.title}</span>
                    <span className="mt-2 block text-sm leading-relaxed text-muted">{link.blurb}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </section>
    </MarketingShell>
  );
}
