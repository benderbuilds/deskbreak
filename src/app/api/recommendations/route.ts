import { NextResponse } from "next/server";
import { currentProfile } from "@/lib/server/auth";
import { mergeSignals, signalsFor } from "@/lib/server/signals";
import {
  findMany,
  findOne,
  insert,
  insertMany,
  type RecommendationExerciseRow,
  type RecommendationRow,
} from "@/lib/server/store";
import { getEntitlementForAnonymousId, getEntitlementForUser } from "@/lib/server/entitlements";
import { emptySignals, type PersonalizationSignals } from "@/lib/personalization";
import { recommend, timeOfDayNow } from "@/lib/recommendation";
import {
  isDurationMinutes,
  isFunctionalConstraint,
  isPrimaryNeed,
  isSetupRequest,
  type FunctionalConstraint,
  type TimeOfDay,
} from "@/lib/types";

export const dynamic = "force-dynamic";

type Body = {
  need?: unknown;
  durationMinutes?: unknown;
  setup?: unknown;
  anonymousId?: string;
  timeOfDay?: TimeOfDay;
  seed?: string;
  constraints?: unknown;
  signals?: PersonalizationSignals;
};

/**
 * POST /api/recommendations
 *
 * The same engine the client runs offline, fed by the server's fuller picture:
 * every device this person has used, their stored constraints, and whatever the
 * client sent about the history it holds. Every answer is persisted with its
 * inputs and algorithm version so a later outcome can be attributed to it.
 */
export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const need = isPrimaryNeed(body.need) ? body.need : "general";
  const durationMinutes = isDurationMinutes(body.durationMinutes) ? body.durationMinutes : 3;
  const setup = isSetupRequest(body.setup) ? body.setup : "either";
  const anonymousId = typeof body.anonymousId === "string" ? body.anonymousId : null;

  try {
    const signedIn = await currentProfile();
    const profile = signedIn ?? (anonymousId ? await findOne("profiles", { anonymous_id: anonymousId }) : null);
    const pro = signedIn
      ? (await getEntitlementForUser(signedIn.id)).pro
      : anonymousId
        ? (await getEntitlementForAnonymousId(anonymousId)).pro
        : false;

    const storedConstraints = profile
      ? (await findMany("functional_constraints", { profile_id: profile.id })).map((row) => row.constraint_key)
      : [];
    const sentConstraints = Array.isArray(body.constraints) ? body.constraints : [];
    const constraints = [...new Set([...storedConstraints, ...sentConstraints])].filter(
      isFunctionalConstraint,
    ) as FunctionalConstraint[];

    const serverSignals = await signalsFor({ profileId: profile?.id, anonymousId }).catch(() => emptySignals());
    const signals = mergeSignals(serverSignals, body.signals);

    const recommendation = recommend({
      need,
      durationMinutes,
      setup,
      pro,
      constraints,
      signals,
      timeOfDay: body.timeOfDay ?? timeOfDayNow(),
      seed: body.seed ?? new Date().toISOString().slice(0, 10),
    });

    const row: RecommendationRow = {
      id: recommendation.id,
      profile_id: profile?.id ?? null,
      anonymous_id: anonymousId,
      need,
      setup,
      requested_duration: durationMinutes,
      recommended_duration: recommendation.program.durationMin,
      time_of_day: recommendation.inputs.timeOfDay,
      algorithm_version: recommendation.algorithmVersion,
      recommendation_reason: recommendation.reason,
      program_id: recommendation.program.id,
      program_name: recommendation.program.name,
      inputs: {
        ...recommendation.inputs,
        authored: recommendation.authored,
        fallback: recommendation.fallback,
        validation: recommendation.validation,
        signalSource: body.signals && body.signals.sessionCount > serverSignals.sessionCount ? "client" : "server",
      },
      created_at: new Date().toISOString(),
    };
    await insert("recommendations", row);
    const exerciseRows: RecommendationExerciseRow[] = recommendation.program.steps.map((step, index) => ({
      id: crypto.randomUUID(),
      recommendation_id: recommendation.id,
      exercise_id: step.exerciseId,
      sequence: index,
      score: recommendation.exercises[index]?.score ?? 0,
      duration_seconds: step.durationSec,
      phase: step.phase ?? null,
    }));
    await insertMany("recommendation_exercises", exerciseRows);

    return NextResponse.json({
      recommendationId: recommendation.id,
      algorithmVersion: recommendation.algorithmVersion,
      reason: recommendation.reason,
      personalized: recommendation.personalized,
      authored: recommendation.authored,
      program: {
        id: recommendation.program.id,
        name: recommendation.program.name,
        shortLabel: recommendation.program.shortLabel,
        durationMinutes: recommendation.program.durationMin,
        steps: recommendation.program.steps.map((step) => ({
          exerciseId: step.exerciseId,
          durationSec: step.durationSec,
          phase: step.phase,
        })),
      },
    });
  } catch (error) {
    console.error("[deskbreak] recommendation failed:", error);
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
