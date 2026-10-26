import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { LandingViewTracker } from "@/components/marketing/LandingCta";
import { BODY_AREAS, BODY_AREA_LABELS, SETUP_LABELS } from "@/lib/body-areas";
import { getExercises, isFloorMove } from "@/lib/content";
import type { Exercise } from "@/lib/types";

export const metadata: Metadata = {
  title: "Every DeskBreak move, by body area",
  description:
    "The full library of desk moves for neck, shoulders, back, wrists, hips and legs, each with how to do it, an easier option and a common mistake.",
  alternates: { canonical: "/moves" },
};

/**
 * The hub for every public move page, so none of them is reachable only from
 * the sitemap. Floor moves get their own section: they are opt-in and never
 * sit among the desk moves.
 */
export default function MovesIndex() {
  const exercises = getExercises();
  const deskMoves = exercises.filter((exercise) => !isFloorMove(exercise));
  const floorMoves = exercises.filter(isFloorMove);
  const groups = BODY_AREAS.map((area) => ({
    area,
    moves: deskMoves.filter((exercise) => exercise.bodyArea === area),
  })).filter((group) => group.moves.length);

  return (
    <MarketingShell>
      <LandingViewTracker page="moves" seo />
      <section className="py-10">
        <h1 className="font-display font-extrabold text-[2.2rem] leading-tight text-ink sm:text-[2.6rem]">
          Every move, by body area
        </h1>
        <p className="mt-4 max-w-[42rem] text-lg leading-relaxed text-muted">
          Each move has its own page: how to do it at your desk, what you should feel, an easier option and the mistake
          to avoid. Or let DeskBreak pick four for you in a{" "}
          <Link href="/desk-exercises" className="font-semibold text-pen">
            3-minute reset
          </Link>
          .
        </p>

        {groups.map((group) => (
          <MoveGroup key={group.area} title={BODY_AREA_LABELS[group.area]} moves={group.moves} />
        ))}

        {floorMoves.length ? (
          <MoveGroup
            title="On the floor"
            note="Only part of a routine when you choose floor work. Never mixed into a seated or standing desk reset."
            moves={floorMoves}
          />
        ) : null}
      </section>
    </MarketingShell>
  );
}

function MoveGroup({ title, note, moves }: { title: string; note?: string; moves: Exercise[] }) {
  return (
    <section className="mt-10">
      <h2 className="font-display font-extrabold text-xl text-ink">{title}</h2>
      {note ? <p className="mt-1 max-w-[42rem] text-sm text-muted">{note}</p> : null}
      <ul className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {moves.map((exercise) => (
          <li key={exercise.id}>
            <Link href={`/moves/${exercise.id}`} className="font-semibold text-pen">
              {exercise.name}
            </Link>{" "}
            <span className="text-sm text-muted">· {SETUP_LABELS[exercise.setup]}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
