"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ButtonLink } from "@/components/Button";
import { track } from "@/lib/analytics";
import { NEED_OPTIONS } from "@/lib/constants";
import { isProEntitlement } from "@/lib/entitlements";
import { saveWorkdayPlan } from "@/lib/storage";
import { useAppState } from "@/lib/use-app-state";
import { useIsClient } from "@/lib/use-client";
import {
  BREAK_PREFERENCES,
  DEFAULT_WORKDAY_END,
  DEFAULT_WORKDAY_START,
  createPlan,
  formatMinutes,
  parseTimeInput,
  planForToday,
  toTimeInput,
} from "@/lib/workday";
import type { BreakPreference, PrimaryNeed, WorkdayPlan } from "@/lib/types";

/** Trouble spots worth scheduling around. "Surprise me" is not one of them. */
const TROUBLE_SPOTS = NEED_OPTIONS.filter((option) => option.id !== "general");

export function PlanView() {
  const router = useRouter();
  const isClient = useIsClient();
  const state = useAppState();
  const pro = isProEntitlement(state.entitlement);

  const existing = state.plan;
  const [start, setStart] = useState(
    toTimeInput(existing?.startMinutes ?? DEFAULT_WORKDAY_START),
  );
  const [end, setEnd] = useState(
    toTimeInput(existing?.endMinutes ?? DEFAULT_WORKDAY_END),
  );
  const [preference, setPreference] = useState<BreakPreference>(
    existing?.preference ?? "balanced",
  );
  const [spots, setSpots] = useState<PrimaryNeed[]>(existing?.troubleSpots ?? []);
  const [editing, setEditing] = useState(!existing);
  const [error, setError] = useState<string | null>(null);

  if (!isClient) return null;

  if (!pro) {
    return (
      <div className="flex flex-1 flex-col justify-center px-5 py-10">
        <h1 className="font-display text-[1.8rem] font-semibold leading-tight text-ink">
          Workday plans are part of Pro.
        </h1>
        <p className="mt-3 leading-relaxed text-ink/65">
          Tell DeskBreak your hours and it schedules the right breaks around them,
          so you stop having to remember.
        </p>
        <div className="mt-7 grid gap-3">
          <ButtonLink href="/app/pro?from=plan">See Pro</ButtonLink>
          <ButtonLink href="/app" variant="ghost">
            Back to DeskBreak
          </ButtonLink>
        </div>
      </div>
    );
  }

  function toggleSpot(need: PrimaryNeed) {
    setSpots((current) =>
      current.includes(need)
        ? current.filter((entry) => entry !== need)
        : [...current, need],
    );
  }

  function save() {
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
    setError(null);

    const plan = createPlan({
      startMinutes,
      endMinutes,
      preference,
      troubleSpots: spots,
      setup: state.preferredSetup ?? "seated",
    });
    saveWorkdayPlan(plan);
    track("workday_plan_created", {
      plan: preference,
      breaks: plan.breaks.length,
      trouble_spots: spots.join(",") || "none",
    });
    setEditing(false);
  }

  const plan: WorkdayPlan | null = state.plan
    ? planForToday(state.plan, state.preferredSetup ?? "seated")
    : null;

  if (!editing && plan) {
    return (
      <div className="flex flex-1 flex-col px-5 py-6">
        <h1 className="font-display text-[1.8rem] font-semibold leading-tight text-ink">
          Today&apos;s plan
        </h1>
        <p className="mt-2 text-sm text-ink/55">
          {formatMinutes(plan.startMinutes)} to {formatMinutes(plan.endMinutes)} ·{" "}
          {BREAK_PREFERENCES[plan.preference].hint}
        </p>

        <ul className="mt-5 grid gap-3">
          {plan.breaks.map((entry) => (
            <li
              key={entry.id}
              className="rounded-[22px] bg-white px-4 py-4 shadow-[0_3px_0_rgba(28,25,23,0.06)]"
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-display text-lg font-semibold tabular-nums text-ink">
                  {formatMinutes(entry.minutes)}
                </p>
                <p className="text-sm text-ink/50">{entry.durationMin} min</p>
              </div>
              <p className="mt-0.5 text-sm text-ink/60">
                {NEED_OPTIONS.find((option) => option.id === entry.need)?.label ??
                  "Desk reset"}
              </p>

              {entry.status === "done" ? (
                <p className="mt-3 text-sm font-semibold text-mint">Done</p>
              ) : entry.status === "skipped" ? (
                <p className="mt-3 text-sm font-semibold text-ink/40">Skipped</p>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    block={false}
                    className="min-h-11 px-4 text-sm"
                    onClick={() =>
                      router.push(
                        `/app/workout/${entry.programId}?need=${entry.need}&setup=${
                          state.preferredSetup ?? "seated"
                        }`,
                      )
                    }
                  >
                    Start now
                  </Button>
                  <Button
                    block={false}
                    variant="ghost"
                    className="min-h-11 px-4 text-sm"
                    onClick={() => {
                      track("reset_snoozed", { break_id: entry.id, need: entry.need });
                      saveWorkdayPlan({
                        ...plan,
                        breaks: plan.breaks.map((item) =>
                          item.id === entry.id
                            ? { ...item, minutes: item.minutes + 15, status: "snoozed" }
                            : item,
                        ),
                      });
                    }}
                  >
                    Snooze 15
                  </Button>
                  <Button
                    block={false}
                    variant="ghost"
                    className="min-h-11 px-4 text-sm"
                    onClick={() => {
                      track("reset_skipped", { break_id: entry.id, need: entry.need });
                      saveWorkdayPlan({
                        ...plan,
                        breaks: plan.breaks.map((item) =>
                          item.id === entry.id ? { ...item, status: "skipped" } : item,
                        ),
                      });
                    }}
                  >
                    Skip
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>

        <div className="mt-6">
          <Button variant="ghost" onClick={() => setEditing(true)}>
            Change my hours
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col px-5 py-6">
      <h1 className="font-display text-[1.8rem] font-semibold leading-tight text-ink">
        When does your desk day usually start?
      </h1>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <label className="text-sm font-semibold text-ink/60">
          Start
          <input
            type="time"
            value={start}
            onChange={(event) => setStart(event.target.value)}
            className="mt-1.5 min-h-14 w-full rounded-[18px] border-2 border-ink/12 bg-white px-4 text-base text-ink outline-none focus-visible:border-coral"
          />
        </label>
        <label className="text-sm font-semibold text-ink/60">
          Finish
          <input
            type="time"
            value={end}
            onChange={(event) => setEnd(event.target.value)}
            className="mt-1.5 min-h-14 w-full rounded-[18px] border-2 border-ink/12 bg-white px-4 text-base text-ink outline-none focus-visible:border-coral"
          />
        </label>
      </div>

      <fieldset className="mt-7">
        <legend className="font-display text-lg font-semibold text-ink">
          Typical break preference
        </legend>
        <div className="mt-3 grid gap-2">
          {(Object.keys(BREAK_PREFERENCES) as BreakPreference[]).map((key) => {
            const option = BREAK_PREFERENCES[key];
            const active = preference === key;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={active}
                onClick={() => setPreference(key)}
                className={[
                  "flex min-h-14 items-center justify-between rounded-[18px] px-4 text-left",
                  active
                    ? "bg-ink text-paper"
                    : "bg-white text-ink shadow-[0_2px_0_rgba(28,25,23,0.06)]",
                ].join(" ")}
              >
                <span className="font-semibold">{option.label}</span>
                <span className={active ? "text-paper/70" : "text-ink/50"}>
                  {option.hint}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="mt-7">
        <legend className="font-display text-lg font-semibold text-ink">
          Anything that usually bothers you?
        </legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {TROUBLE_SPOTS.map((option) => {
            const active = spots.includes(option.id);
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={active}
                onClick={() => toggleSpot(option.id)}
                className={[
                  "min-h-11 rounded-full px-4 text-sm font-semibold",
                  active
                    ? "bg-coral text-white"
                    : "bg-white text-ink/60 shadow-[0_2px_0_rgba(28,25,23,0.06)]",
                ].join(" ")}
              >
                {option.chip}
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

      <div className="mt-7">
        <Button onClick={save}>Create schedule</Button>
      </div>
    </div>
  );
}
