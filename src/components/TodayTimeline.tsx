"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { track } from "@/lib/analytics";
import { formatMinutes, formatRelativeMinutes, minutesNow } from "@/lib/dates";
import { isProEntitlement } from "@/lib/entitlements";
import { personalizationSignals, saveWorkdayPlan } from "@/lib/storage";
import { useAppState } from "@/lib/use-app-state";
import {
  BREAK_TYPE_COPY,
  breakHref,
  effectiveStart,
  nextBreak,
  planForToday,
  skipBreak,
  snoozeBreak,
  withExpiry,
} from "@/lib/workday";
import type { PlannedBreak, WorkoutSession } from "@/lib/types";

type Entry =
  | { kind: "session"; minutes: number; label: string; session: WorkoutSession }
  | { kind: "break"; minutes: number; label: string; entry: PlannedBreak };

/**
 * The day, as a short list. Completed resets, then what is still to come.
 * Deliberately not a calendar.
 */
export function TodayTimeline() {
  const router = useRouter();
  const state = useAppState();
  const pro = isProEntitlement(state.entitlement);
  const now = minutesNow();
  const today = new Date().toISOString().slice(0, 10);

  const plan = state.plan && pro
    ? withExpiry(planForToday(state.plan, { signals: personalizationSignals(state), preferredDuration: state.preferredDuration }), now)
    : null;

  const sessionsToday = state.progress.history.filter(
    (session) => session.finishedAt.slice(0, 10) === today || session.startedAt.slice(0, 10) === today,
  );

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
    ...(plan?.breaks ?? [])
      .filter((entry) => entry.status !== "completed")
      .map((entry) => ({
        kind: "break" as const,
        minutes: effectiveStart(entry),
        label: BREAK_TYPE_COPY[entry.type].label,
        entry,
      })),
  ].sort((a, b) => a.minutes - b.minutes);

  const upcoming = plan ? nextBreak(plan, now) : null;

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
      {upcoming ? (
        <div className="surface px-4 py-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink/45">Next break</p>
          <div className="mt-1 flex items-baseline justify-between gap-3">
            <p className="font-display text-xl font-semibold text-ink tabular-nums">
              {formatMinutes(effectiveStart(upcoming))}
            </p>
            <p className="text-sm text-ink/55">{formatRelativeMinutes(effectiveStart(upcoming) - now)}</p>
          </div>
          <p className="mt-0.5 text-sm text-ink/60">
            {BREAK_TYPE_COPY[upcoming.type].label} · {upcoming.durationMin} min
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              block={false}
              onClick={() => {
                track("planned_break_started", { break_id: upcoming.id, break_type: upcoming.type, source: "today" });
                router.push(breakHref(upcoming));
              }}
            >
              Move now
            </Button>
            <Button
              size="sm"
              variant="tertiary"
              block={false}
              onClick={() => {
                if (!plan) return;
                track("planned_break_snoozed", { break_id: upcoming.id, minutes: 15 });
                saveWorkdayPlan(snoozeBreak(plan, upcoming.id, 15));
              }}
            >
              15 min
            </Button>
            <Button
              size="sm"
              variant="tertiary"
              block={false}
              onClick={() => {
                if (!plan) return;
                track("planned_break_skipped", { break_id: upcoming.id });
                saveWorkdayPlan(skipBreak(plan, upcoming.id));
              }}
            >
              Skip
            </Button>
          </div>
        </div>
      ) : null}

      <ul className="mt-3 grid gap-1.5" aria-label="Today's activity">
        {entries.map((item) => {
          const done = item.kind === "session";
          const current = item.kind === "break" && upcoming?.id === item.entry.id;
          const muted = item.kind === "break" && (item.entry.status === "skipped" || item.entry.status === "expired");
          return (
            <li
              key={item.kind === "session" ? item.session.sessionId : item.entry.id}
              className={["flex items-center gap-3 px-1 py-1.5 text-sm", muted ? "text-ink/35" : "text-ink/75"].join(" ")}
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
                {muted ? ` · ${item.entry.status}` : ""}
              </span>
              <span className="sr-only">{done ? "done" : current ? "next" : muted ? item.entry.status : "planned"}</span>
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
