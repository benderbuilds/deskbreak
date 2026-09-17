import Link from "next/link";
import { CharacterArt } from "@/components/CharacterArt";
import { ExerciseActions } from "@/components/ExerciseActions";
import { BODY_AREA_LABELS, MOVEMENT_TYPE_LABELS } from "@/lib/body-areas";
import { SAFETY_LINE } from "@/lib/constants";
import { getEvidence } from "@/lib/content";
import { formatDose } from "@/lib/format";
import type { Exercise } from "@/lib/types";

const EVIDENCE_LABEL: Record<Exercise["evidenceLevel"], string> = {
  general: "General movement principle",
  emerging: "Emerging evidence",
  moderate: "Moderate evidence",
  strong: "Strong evidence",
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
  const references = getEvidence().filter((reference) =>
    exercise.evidenceCategories.includes(reference.category),
  );

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
        {exercise.rationale ? <Block title="Why DeskBreak uses it" body={exercise.rationale} /> : null}
      </dl>

      <p className="mt-6 text-xs leading-relaxed text-ink/50">{SAFETY_LINE}</p>

      <section className="mt-7" aria-labelledby="evidence">
        <h2 id="evidence" className="text-xs font-semibold uppercase tracking-[0.14em] text-ink/45">
          Evidence
        </h2>
        <p className="mt-2 text-sm text-ink/70">{EVIDENCE_LABEL[exercise.evidenceLevel]}.</p>
        {references.length ? (
          <ul className="mt-2 grid gap-1.5 text-sm text-ink/60">
            {references.slice(0, 3).map((reference) => (
              <li key={reference.id}>
                <a href={reference.url} target="_blank" rel="noreferrer" className="font-semibold text-coral">
                  {reference.title}
                </a>{" "}
                <span className="text-ink/45">
                  ({reference.source}, {reference.year})
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        <p className="mt-3 text-xs leading-relaxed text-ink/45">
          <Link href="/science" className="font-semibold text-coral">
            How DeskBreak uses evidence
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
