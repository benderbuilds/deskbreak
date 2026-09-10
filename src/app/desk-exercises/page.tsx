import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { LandingViewTracker, StartResetButton } from "@/components/marketing/LandingCta";
import { AREA_PAGES, GUIDE_PAGES } from "@/lib/seo-content";

export const metadata: Metadata = {
  title: "Desk exercises by body part",
  description:
    "Desk exercises for necks, shoulders, backs, hips and wrists. Two minutes each, no equipment, guided.",
  alternates: { canonical: "/desk-exercises" },
};

export default function DeskExercisesIndex() {
  return (
    <MarketingShell>
      <LandingViewTracker page="desk_exercises_index" />
      <div className="py-10">
        <h1 className="font-display text-[2.2rem] font-semibold leading-tight tracking-tight text-ink">
          Desk exercises, by the bit that hurts
        </h1>
        <p className="mt-4 max-w-[42rem] text-lg leading-relaxed text-ink/65">
          Pick where it is bothering you. Each page has the moves written out and a
          guided two-minute version you can start immediately.
        </p>

        <ul className="mt-8 grid gap-3 sm:grid-cols-2">
          {AREA_PAGES.map((page) => (
            <li key={page.slug}>
              <Link
                href={`/desk-exercises/${page.slug}`}
                className="block rounded-[22px] bg-white px-5 py-5 shadow-[0_4px_0_rgba(28,25,23,0.06)] transition-transform duration-200 hover:-translate-y-0.5"
              >
                <p className="font-display text-lg font-semibold text-ink">
                  {page.title}
                </p>
                <p className="mt-1 text-sm text-ink/55">{page.moves.length} moves</p>
              </Link>
            </li>
          ))}
        </ul>

        <h2 className="mt-12 font-display text-[1.6rem] font-semibold tracking-tight text-ink">
          Guides
        </h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-3">
          {GUIDE_PAGES.map((guide) => (
            <li key={guide.slug}>
              <Link
                href={`/guides/${guide.slug}`}
                className="block rounded-[22px] border-2 border-ink/8 px-5 py-5 hover:border-ink/20"
              >
                <p className="font-display text-base font-semibold text-ink">
                  {guide.title}
                </p>
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-10">
          <StartResetButton source="desk_exercises_index" />
        </div>
      </div>
    </MarketingShell>
  );
}
