"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { track } from "@/lib/analytics";
import {
  BREAK_ACTION_COPY,
  breakTitle,
  completeMicroBreak,
  microActionLabel,
  startBreakHref,
} from "@/lib/break-actions";
import { formatMinutes, formatRelativeMinutes, minutesNow, todayKey } from "@/lib/dates";
import { isProEntitlement } from "@/lib/entitlements";
import { personalizationSignals, saveWorkdayPlan } from "@/lib/storage";
import { useAppState } from "@/lib/use-app-state";
import {
  BREAK_TYPE_COPY,
  effectiveStart,
  isDue,
  isMicroBreak,
  nextBreak,
  planForToday,
  planProgress,
  skipBreak,
  withExpiry,
} from "@/lib/workday";
import type { PlannedBreak, WorkoutSession } from "@/lib/types";

type Entry =
  | { kind: "session"; minutes: number; label: string; session: WorkoutSession }
  | { kind: "stand"; minutes: number; label: string; at: string }
  | { kind: "break"; minutes: number; label: string; entry: PlannedBreak };

/**
 * The day, as a short list. Completed resets and stand-ups, then what is
 * still to come. Deliberately not a calendar.
 *
 * A break that is due right now lives in Today's top card, so this list only
 * previews the next one while it is still ahead.
 */
export function TodayTimeline() {
  const router = useRouter();
  const state = useAppState();
  const pro = isProEntitlement(state.entitlement);
  const now = minutesNow();
  const today = todayKey();

  const plan = state.plan && pro
    ? withExpiry(planForToday(state.plan, { signals: personalizationSignals(state), preferredDuration: state.preferredDuration }), now)
    : null;

  const sessionsToday = state.progress.history.filter(
    (session) => todayKey(new Date(session.finishedAt)) === today,
  );
  const standsToday = state.microBreaks.filter((at) => todayKey(new Date(at)) === today);

  const entries: Entry[] = [
    ...sessionsToday.map((session) => {
      const at = new Date(session.finishedAt);
      return {
        kind: "session" as const,
        minutes: at.getHours() * 60 + at.getMinutes(),
        label: session.programName.replace(/^\d+-Minute /, ""),
        session,
      };
    }),
    ...standsToday.map((iso) => {
      const at = new Date(iso);
      return { kind: "stand" as const, minutes: at.getHours() * 60 + at.getMinutes(), label: "Stood up", at: iso };
    }),
    ...(plan?.breaks ?? [])
      .filter((entry) => entry.status !== "completed")
      .map((entry) => ({
        kind: "break" as const,
        minutes: effectiveStart(entry),
        label: `${breakTitle(entry, BREAK_TYPE_COPY[entry.type].label)}${isMicroBreak(entry) ? " · 1 min" : ""}`,
        entry,
      })),
  ].sort((a, b) => a.minutes - b.minutes);

  const upcoming = plan ? nextBreak(plan, now) : null;
  const preview = upcoming && !isDue(upcoming, now) ? upcoming : null;
  const progress = plan ? planProgress(plan) : null;

  if (!entries.length && !plan) {
    return (
      <div className="mt-3">
        <p className="text-sm leading-relaxed text-ink/55">
          {state.progress.totalWorkouts === 0
            ? "Nothing yet. Your first reset takes three minutes."
            : "No resets yet today."}
        </p>
        {!pro ? (
          <Link href="/app/pro?from=today_planner" className="mt-3 block text-sm font-semibold text-coral">
            Want DeskBreak to remind you before you&apos;ve been sitting all afternoon?
          </Link>
        ) : (
          <Link href="/app/plan" className="mt-3 block text-sm font-semibold text-coral">
            Set up your workday plan
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="mt-3">
      {progress && progress.total ? (
        <p className="text-sm text-ink/55">
          {progress.done} of {progress.total} breaks done
          {progress.microTotal ? `, ${progress.microDone} of ${progress.microTotal} stand-ups` : ""}
        </p>
      ) : null}

      {preview ? (
        <div className="surface mt-3 px-4 py-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink/45">Next break</p>
          <div className="mt-1 flex items-baseline justify-between gap-3">
            <p className="font-display text-xl font-semibold text-ink tabular-nums">
              {formatMinutes(effectiveStart(preview))}
            </p>
            <p className="text-sm text-ink/55">{formatRelativeMinutes(effectiveStart(preview) - now)}</p>
          </div>
          <p className="mt-0.5 text-sm text-ink/60">
            {breakTitle(preview, BREAK_TYPE_COPY[preview.type].label)} · {preview.durationMin} min
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {isMicroBreak(preview) ? (
              <Button size="sm" variant="secondary" block={false} onClick={() => completeMicroBreak(preview, "today")}>
                {microActionLabel(preview)}
              </Button>
            ) : (
              <Button size="sm" variant="secondary" block={false} onClick={() => router.push(startBreakHref(preview, "today"))}>
                {BREAK_ACTION_COPY.startEarly}
              </Button>
            )}
            <Button
              size="sm"
              variant="tertiary"
              block={false}
              onClick={() => {
                if (!plan) return;
                track("planned_break_skipped", { break_id: preview.id });
                saveWorkdayPlan(skipBreak(plan, preview.id));
              }}
            >
              {BREAK_ACTION_COPY.skip}
            </Button>
          </div>
        </div>
      ) : null}

      <ul className="mt-3 grid gap-1.5" aria-label="Today's activity">
        {entries.map((item) => {
          const done = item.kind !== "break";
          const current = item.kind === "break" && upcoming?.id === item.entry.id;
          const status =
            item.kind !== "break"
              ? null
              : item.entry.status === "expired"
                ? BREAK_ACTION_COPY.missed
                : item.entry.status === "skipped"
                  ? BREAK_ACTION_COPY.skipped
                  : null;
          const key =
            item.kind === "session" ? item.session.sessionId : item.kind === "stand" ? `stand-${item.at}` : item.entry.id;
          return (
            <li
              key={key}
              className={["flex items-center gap-3 px-1 py-1.5 text-sm", status ? "text-ink/40" : "text-ink/75"].join(" ")}
            >
              <span
                aria-hidden
                className={[
                  "grid h-5 w-5 place-items-center rounded-full text-[11px] font-bold",
                  done ? "bg-mint text-ink" : current ? "border-2 border-coral text-coral" : "border border-ink/25",
                ].join(" ")}
              >
                {done ? "✓" : current ? "●" : ""}
              </span>
              <span className="w-[4.6rem] shrink-0 tabular-nums">{formatMinutes(item.minutes)}</span>
              <span className="min-w-0 truncate">
                {item.label}
                {status ? ` · ${status}` : ""}
              </span>
              <span className="sr-only">{done ? "done" : current ? "next" : status ?? "planned"}</span>
            </li>
          );
        })}
      </ul>
      {plan ? (
        <Link href="/app/plan" className="mt-3 inline-block text-sm font-semibold text-coral">
          Change plan
        </Link>
      ) : null}
    </div>
  );
}
