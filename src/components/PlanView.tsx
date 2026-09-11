"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ButtonLink, Chip } from "@/components/Button";
import { pushPreferences } from "@/lib/account-client";
import { track } from "@/lib/analytics";
import { formatMinutes, minutesNow, parseTimeInput, toTimeInput } from "@/lib/dates";
import { isProEntitlement } from "@/lib/entitlements";
import { pushSupported, subscribeToPush } from "@/lib/push-client";
import { personalizationSignals, saveWorkdayPlan } from "@/lib/storage";
import { useAppState } from "@/lib/use-app-state";
import { useIsClient } from "@/lib/use-client";
import {
  BREAK_TYPE_COPY,
  REMINDER_LEVELS,
  breakHref,
  createPlan,
  defaultPreferences,
  effectiveStart,
  planForToday,
  skipBreak,
  snoozeBreak,
  withExpiry,
} from "@/lib/workday";
import type { ReminderLevel, WorkdayPlan } from "@/lib/types";

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

/**
 * The workday planner.
 *
 * Two questions: when do you work, and how much help do you want. Never a
 * break count. The result is a movement plan for the day, not a list of
 * scheduled workouts.
 */
export function PlanView() {
  const router = useRouter();
  const isClient = useIsClient();
  const state = useAppState();
  const pro = isProEntitlement(state.entitlement);

  const existing = state.plan?.preferences ?? null;
  const [start, setStart] = useState(toTimeInput(existing?.startMinutes ?? defaultPreferences().startMinutes));
  const [end, setEnd] = useState(toTimeInput(existing?.endMinutes ?? defaultPreferences().endMinutes));
  const [level, setLevel] = useState<ReminderLevel>(existing?.level ?? "balanced");
  const [days, setDays] = useState<number[]>(existing?.enabledDays ?? defaultPreferences().enabledDays);
  const [editing, setEditing] = useState(!existing);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (!isClient) return null;

  if (!pro) {
    return (
      <div className="flex flex-1 flex-col justify-center px-5 py-10">
        <h1 className="font-display text-[1.8rem] font-semibold leading-tight text-ink">
          Let DeskBreak manage your workday.
        </h1>
        <p className="mt-3 leading-relaxed text-ink/65">
          Tell DeskBreak your hours and it puts the right movement breaks into your
          day, then reminds you before you&apos;ve been sitting all afternoon.
        </p>
        <div className="mt-7 grid gap-3">
          <ButtonLink href="/app/pro?from=plan">See Pro</ButtonLink>
          <ButtonLink href="/app" variant="secondary">
            Back to Today
          </ButtonLink>
        </div>
      </div>
    );
  }

  function toggleDay(day: number) {
    setDays((current) =>
      current.includes(day) ? current.filter((entry) => entry !== day) : [...current, day].sort(),
    );
  }

  async function save() {
    const startMinutes = parseTimeInput(start);
    const endMinutes = parseTimeInput(end);
    if (startMinutes === null || endMinutes === null) {
      setError("Those times don't look right.");
      return;
    }
    if (endMinutes - startMinutes < 120) {
      setError("Give us at least two hours of desk day to work with.");
      return;
    }
    if (!days.length) {
      setError("Pick at least one workday.");
      return;
    }
    setError(null);

    const plan = createPlan({
      startMinutes,
      endMinutes,
      level,
      enabledDays: days,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? null,
    });
    saveWorkdayPlan(plan);
    track("workday_plan_created", { level, breaks: plan.breaks.length, days: days.length });
    for (const entry of plan.breaks) {
      track("planned_break_created", { break_id: entry.id, break_type: entry.type, start: entry.startMinutes });
    }
    void pushPreferences();
    void syncBreaks(plan);
    setEditing(false);

    if (pushSupported() && !state.push.endpoint) {
      const result = await subscribeToPush();
      setNotice(
        result === "subscribed"
          ? "Reminders on. We'll nudge you even when DeskBreak isn't open."
          : result === "denied"
            ? "Notifications are blocked in this browser. Reminders will show while DeskBreak is open, and by email if you've saved one."
            : "Reminders will show while DeskBreak is open. Turn on push under You for the rest.",
      );
    }
  }

  const plan: WorkdayPlan | null = state.plan
    ? withExpiry(
        planForToday(state.plan, {
          signals: personalizationSignals(state),
          preferredDuration: state.preferredDuration,
        }),
        minutesNow(),
      )
    : null;

  if (!editing && plan) {
    return (
      <div className="flex flex-1 flex-col px-5 py-6 lg:px-0">
        <h1 className="font-display text-[1.8rem] font-semibold leading-tight text-ink">Today&apos;s plan</h1>
        <p className="mt-2 text-sm text-ink/55">
          {formatMinutes(plan.preferences.startMinutes)} to {formatMinutes(plan.preferences.endMinutes)} ·{" "}
          {REMINDER_LEVELS[plan.preferences.level].label}
        </p>
        {notice ? (
          <p className="surface mt-4 px-4 py-3 text-sm leading-relaxed text-ink/70" role="status">
            {notice}
          </p>
        ) : null}

        {!plan.breaks.length ? (
          <p className="surface mt-5 px-4 py-4 text-sm text-ink/60">
            Not a workday. Your plan picks up on the next one.
          </p>
        ) : null}

        <ul className="mt-5 grid gap-2.5">
          {plan.breaks.map((entry) => {
            const copy = BREAK_TYPE_COPY[entry.type];
            const open = entry.status === "planned" || entry.status === "delivered" || entry.status === "snoozed";
            return (
              <li key={entry.id} className="surface px-4 py-4">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-display text-lg font-semibold tabular-nums text-ink">
                    {formatMinutes(effectiveStart(entry))}
                    <span className="ml-1 text-sm font-normal text-ink/45">to {formatMinutes(entry.endMinutes)}</span>
                  </p>
                  <p className="text-sm text-ink/50">{entry.durationMin} min</p>
                </div>
                <p className="mt-0.5 text-sm text-ink/70">
                  {copy.label} · {copy.blurb}
                </p>

                {entry.status === "completed" ? (
                  <p className="mt-3 text-sm font-semibold text-mint-deep">Done</p>
                ) : entry.status === "skipped" ? (
                  <p className="mt-3 text-sm font-semibold text-ink/40">Skipped</p>
                ) : entry.status === "expired" ? (
                  <p className="mt-3 text-sm font-semibold text-ink/40">Missed. No big deal.</p>
                ) : open ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      block={false}
                      onClick={() => {
                        track("planned_break_started", { break_id: entry.id, break_type: entry.type, source: "plan" });
                        router.push(breakHref(entry));
                      }}
                    >
                      Start now
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      block={false}
                      onClick={() => {
                        track("planned_break_snoozed", { break_id: entry.id, minutes: 15 });
                        const next = snoozeBreak(plan, entry.id, 15);
                        saveWorkdayPlan(next);
                        void syncBreaks(next);
                      }}
                    >
                      15 min
                    </Button>
                    <Button
                      size="sm"
                      variant="tertiary"
                      block={false}
                      onClick={() => {
                        track("planned_break_skipped", { break_id: entry.id });
                        const next = skipBreak(plan, entry.id);
                        saveWorkdayPlan(next);
                        void syncBreaks(next);
                      }}
                    >
                      Skip
                    </Button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>

        <div className="mt-6">
          <Button variant="secondary" onClick={() => setEditing(true)}>
            Change my hours
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col px-5 py-6 lg:max-w-[560px] lg:px-0">
      <h1 className="font-display text-[1.8rem] font-semibold leading-tight text-ink">
        When do you normally work?
      </h1>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <label className="text-sm font-semibold text-ink/60">
          Start
          <input
            type="time"
            value={start}
            onChange={(event) => setStart(event.target.value)}
            className="mt-1.5 min-h-13 w-full rounded-[14px] border border-ink/12 bg-white px-4 text-base text-ink outline-none focus-visible:border-coral"
          />
        </label>
        <label className="text-sm font-semibold text-ink/60">
          Finish
          <input
            type="time"
            value={end}
            onChange={(event) => setEnd(event.target.value)}
            className="mt-1.5 min-h-13 w-full rounded-[14px] border border-ink/12 bg-white px-4 text-base text-ink outline-none focus-visible:border-coral"
          />
        </label>
      </div>

      <fieldset className="mt-6">
        <legend className="text-sm font-semibold text-ink/60">Workdays</legend>
        <div className="mt-2 flex gap-1.5" role="group">
          {DAY_LABELS.map((label, day) => (
            <Chip
              key={day}
              label={label}
              ariaLabel={["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][day]}
              active={days.includes(day)}
              onClick={() => toggleDay(day)}
            />
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-7">
        <legend className="font-display text-lg font-semibold text-ink">How much help do you want?</legend>
        <div className="mt-3 grid gap-2">
          {(Object.keys(REMINDER_LEVELS) as ReminderLevel[]).map((key) => {
            const option = REMINDER_LEVELS[key];
            const active = level === key;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={active}
                onClick={() => setLevel(key)}
                className={[
                  "flex min-h-13 items-center justify-between rounded-[14px] px-4 text-left transition-colors",
                  active ? "bg-ink text-paper" : "surface text-ink hover:bg-ink/3",
                ].join(" ")}
              >
                <span className="font-semibold">{option.label}</span>
                <span className={active ? "text-paper/70" : "text-ink/50"}>{option.hint}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {error ? (
        <p className="mt-4 text-sm font-semibold text-coral" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-7 grid gap-2.5">
        <Button onClick={save}>Build my workday</Button>
        {existing ? (
          <Button variant="tertiary" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        ) : null}
      </div>
    </div>
  );
}

async function syncBreaks(plan: WorkdayPlan): Promise<void> {
  if (!plan.generatedFor) return;
  try {
    await fetch("/api/planned-breaks", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: plan.generatedFor, breaks: plan.breaks }),
    });
  } catch {
    /* the push scheduler regenerates from preferences if this never lands */
  }
}
