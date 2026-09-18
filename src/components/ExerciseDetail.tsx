import Link from "next/link";
import { CharacterArt } from "@/components/CharacterArt";
import { ExerciseActions } from "@/components/ExerciseActions";
import { BODY_AREA_LABELS, MOVEMENT_TYPE_LABELS } from "@/lib/body-areas";
import { SAFETY_LINE } from "@/lib/constants";
import { formatDose } from "@/lib/format";
import { MOVE_STUDIES, getSource, shortCitation } from "@/lib/seo-content";
import type { Exercise, MovementType } from "@/lib/types";

/** Used when a move has no rationale of its own. Never a claim about the move. */
const WHY_BY_TYPE: Record<MovementType, string> = {
  mobility: "Sitting keeps some joints in one position for hours. This takes one through a range your desk rarely asks for.",
  strength: "Light work for muscles that do little in a chair, and a change from sitting still.",
  isometric: "Light activation for muscles that do little in a chair.",
  aerobic: "Getting up and moving is among the best-studied ways to break up sitting.",
  breathing: "A slower breath gives the break a calm finish before you go back to work.",
  position_change: "A change of position. DeskBreak favours moving between positions over holding any one of them.",
  eye_break: "A few seconds of looking into the distance breaks up close-up screen time.",
};

/**
 * One movement, fully explained. Rendered on the server for the public page
 * and inside the app; the only interactive part is the action row.
 */
export function ExerciseDetail({
  exercise,
  inApp,
}: {
  exercise: Exercise;
  inApp: boolean;
}) {
  // Only studies of this move or a close analogue. No per-move evidence grade.
  const studies = (MOVE_STUDIES[exercise.id] ?? []).map(getSource);

  return (
    <article className={inApp ? "px-5 py-6 lg:max-w-[640px] lg:px-0" : "py-10"}>
      {inApp ? (
        <Link href="/app/explore" className="text-sm font-semibold text-coral">
          &larr; Explore
        </Link>
      ) : null}
      <div className="mt-3 flex justify-center">
        <CharacterArt
          pose="exercise"
          exerciseId={exercise.id}
          animate
          size={240}
          alt={`Stretch demonstrating ${exercise.name}`}
        />
      </div>
      <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-coral">
        {exercise.bodyAreas.map((area) => BODY_AREA_LABELS[area]).join(" · ")}
      </p>
      <h1 className="mt-1 font-display text-[2rem] font-semibold leading-tight tracking-tight text-ink">
        {exercise.name}
      </h1>
      <p className="mt-1 text-sm text-ink/55">
        {MOVEMENT_TYPE_LABELS[exercise.movementType]} ·{" "}
        {exercise.setup === "either" ? "Seated or standing" : exercise.setup === "seated" ? "Seated" : "Standing"}
      </p>

      <ExerciseActions exercise={exercise} inApp={inApp} />

      <dl className="mt-7 grid gap-5">
        <Block title="How to do it" body={exercise.cue} />
        <Block title="Dose" body={formatDose(exercise.defaultDose)} />
        {exercise.feelIt ? <Block title="What you should feel" body={capitalize(exercise.feelIt)} /> : null}
        {exercise.avoid ? <Block title="Common mistake" body={exercise.avoid} /> : null}
        {exercise.easier ? <Block title="Make it easier" body={exercise.easier} /> : null}
        {exercise.avoidIf ? <Block title="Avoid this movement if" body={exercise.avoidIf} /> : null}
      </dl>

      <p className="mt-6 text-xs leading-relaxed text-ink/50">{SAFETY_LINE}</p>

      <section className="mt-7" aria-labelledby="why-its-here">
        <h2 id="why-its-here" className="text-xs font-semibold uppercase tracking-[0.14em] text-ink/45">
          Why it&apos;s here
        </h2>
        <p className="mt-2 leading-relaxed text-ink/80">{exercise.rationale ?? WHY_BY_TYPE[exercise.movementType]}</p>
        {studies.length ? (
          <ul className="mt-2 grid gap-1.5 text-sm text-ink/60">
            {studies.map((study) => (
              <li key={study.id}>
                <span className="text-ink/45">Studied: </span>
                {study.summary}{" "}
                <a href={study.url} target="_blank" rel="noreferrer" className="font-semibold text-coral">
                  ({shortCitation(study.id)})
                </a>
              </li>
            ))}
          </ul>
        ) : null}
        <p className="mt-3 text-xs leading-relaxed text-ink/45">
          <Link href="/science" className="font-semibold text-coral">
            How DeskBreak uses research
          </Link>
        </p>
      </section>
    </article>
  );
}

function Block({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-ink/45">{title}</dt>
      <dd className="mt-1 leading-relaxed text-ink/80">{body}</dd>
    </div>
  );
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
