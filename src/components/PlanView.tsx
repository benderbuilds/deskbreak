"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ButtonLink, Chip } from "@/components/Button";
import { PushSetup } from "@/components/PushSetup";
import { pushPreferences } from "@/lib/account-client";
import { track } from "@/lib/analytics";
import {
  BREAK_ACTION_COPY,
  breakTitle,
  completeMicroBreak,
  microActionLabel,
  startBreakHref,
  syncBreaks,
} from "@/lib/break-actions";
import { formatMinutes, minutesNow, parseTimeInput, toTimeInput } from "@/lib/dates";
import { isProEntitlement } from "@/lib/entitlements";
import { personalizationSignals, saveWorkdayPlan } from "@/lib/storage";
import { useAppState } from "@/lib/use-app-state";
import { useIsClient } from "@/lib/use-client";
import {
  BREAK_TYPE_COPY,
  REMINDER_LEVELS,
  createPlan,
  defaultPreferences,
  effectiveStart,
  isDue,
  isMicroBreak,
  isOpen,
  planForToday,
  planProgress,
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
  // Null until the person chooses: stored state isn't readable on the first
  // (server) render, so "no plan yet" can't be decided up front.
  const [editingChoice, setEditing] = useState<boolean | null>(null);
  const editing = editingChoice ?? !existing;
  const [error, setError] = useState<string | null>(null);
  // Snoozes and skips on today's breaks are a draft until "Save plan".
  const [draft, setDraft] = useState<WorkdayPlan | null>(null);
  const [saved, setSaved] = useState(false);
  const [justBuilt, setJustBuilt] = useState(false);

  const formChanged =
    Boolean(existing) &&
    editing &&
    (parseTimeInput(start) !== existing?.startMinutes ||
      parseTimeInput(end) !== existing?.endMinutes ||
      level !== existing?.level ||
      [...days].sort().join() !== [...(existing?.enabledDays ?? [])].sort().join());
  const dirty = Boolean(draft) || formChanged;

  useUnsavedChangesGuard(dirty);

  if (!isClient) return null;

  if (!pro) {
    return (
      <div className="flex flex-1 flex-col justify-center px-5 py-10">
        <h1 className="font-display font-extrabold text-[1.8rem] leading-tight text-ink">
          Let DeskBreak manage your workday.
        </h1>
        <p className="mt-3 leading-relaxed text-muted">
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

  /** Loads the saved hours into the form, now that stored state is readable. */
  function openEditor() {
    if (existing) {
      setStart(toTimeInput(existing.startMinutes));
      setEnd(toTimeInput(existing.endMinutes));
      setLevel(existing.level);
      setDays(existing.enabledDays);
    }
    setError(null);
    setEditing(true);
  }

  function toggleDay(day: number) {
    setDays((current) =>
      current.includes(day) ? current.filter((entry) => entry !== day) : [...current, day].sort(),
    );
  }

  function buildFromForm() {
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

    const firstBuild = !existing;
    const plan = createPlan({
      startMinutes,
      endMinutes,
      level,
      enabledDays: days,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? null,
    });
    saveWorkdayPlan(plan);
    track("workday_plan_created", { level, breaks: plan.breaks.length, days: days.length, first: firstBuild });
    for (const entry of plan.breaks) {
      track("planned_break_created", { break_id: entry.id, break_type: entry.type, start: entry.startMinutes });
    }
    void pushPreferences();
    void syncBreaks(plan);
    setDraft(null);
    setEditing(false);
    setJustBuilt(firstBuild);
    setSaved(!firstBuild);
  }

  function saveDraft() {
    if (!draft) return;
    saveWorkdayPlan(draft);
    void syncBreaks(draft);
    setDraft(null);
    setSaved(true);
  }

  function editDraft(next: WorkdayPlan) {
    setDraft(next);
    setSaved(false);
  }

  const stored: WorkdayPlan | null = state.plan
    ? withExpiry(
        planForToday(state.plan, {
          signals: personalizationSignals(state),
          preferredDuration: state.preferredDuration,
        }),
        minutesNow(),
      )
    : null;
  const plan = draft ?? stored;

  if (!editing && plan) {
    const dueId = plan.breaks.find((entry) => isDue(entry))?.id ?? null;
    const progress = planProgress(plan);
    return (
      <div className="flex flex-1 flex-col px-5 py-6 lg:px-0">
        <h1 className="font-display font-extrabold text-[1.8rem] leading-tight text-ink">Today&apos;s plan</h1>
        <p className="mt-2 text-sm text-muted">
          {formatMinutes(plan.preferences.startMinutes)} to {formatMinutes(plan.preferences.endMinutes)} ·{" "}
          {REMINDER_LEVELS[plan.preferences.level].label}
          {progress.total ? ` · ${progress.done} of ${progress.total} done` : ""}
        </p>

        {justBuilt ? (
          <div className="surface-elevated mt-5 px-4 py-4">
            <p className="font-display font-extrabold text-base text-ink">Your workday is set.</p>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              DeskBreak reminds you while it&apos;s open. Turn on notifications to get breaks when it isn&apos;t.
            </p>
            <div className="mt-3 border-t border-line pt-3">
              <PushSetup context="plan" />
            </div>
          </div>
        ) : null}

        {!plan.breaks.length ? (
          <p className="surface mt-5 px-4 py-4 text-sm text-muted">
            Not a workday. Your plan picks up on the next one.
          </p>
        ) : null}

        <ul className="mt-5 divide-y divide-line overflow-hidden rounded-card border border-line bg-sheet">
          {plan.breaks.map((entry) => {
            const copy = BREAK_TYPE_COPY[entry.type];
            const micro = isMicroBreak(entry);
            const due = entry.id === dueId;
            return (
              <li key={entry.id} className={[due ? "bg-sheet shadow-[inset_4px_0_0_var(--pen)]" : "", "px-4 py-4"].join(" ")}>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-display font-extrabold text-lg tabular-nums text-ink">
                    {formatMinutes(effectiveStart(entry))}
                    <span className="ml-1 text-sm font-normal text-muted">to {formatMinutes(entry.endMinutes)}</span>
                  </p>
                  <p className="text-sm text-muted">{due ? "Due now" : `${entry.durationMin} min`}</p>
                </div>
                <p className="mt-0.5 text-sm text-ink/70">
                  {micro ? `${breakTitle(entry, copy.label)} · 1 min. ${copy.blurb}` : `${copy.label} · ${copy.blurb}`}
                </p>

                {entry.status === "completed" ? (
                  <p className="mt-3 text-sm font-semibold text-pen">{BREAK_ACTION_COPY.done}</p>
                ) : entry.status === "skipped" ? (
                  <p className="mt-3 text-sm font-semibold text-muted">{BREAK_ACTION_COPY.skipped}</p>
                ) : entry.status === "expired" ? (
                  <p className="mt-3 text-sm font-semibold text-muted">{BREAK_ACTION_COPY.missed}. No big deal.</p>
                ) : isOpen(entry) ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {micro ? (
                      due ? (
                        <Button
                          size="sm"
                          block={false}
                          onClick={() => {
                            completeMicroBreak(entry, "plan");
                            if (draft) {
                              setDraft({
                                ...draft,
                                breaks: draft.breaks.map((item) =>
                                  item.id === entry.id ? { ...item, status: "completed" as const } : item,
                                ),
                              });
                            }
                          }}
                        >
                          {microActionLabel(entry)}
                        </Button>
                      ) : null
                    ) : (
                      <Button
                        size="sm"
                        variant={due ? "primary" : "secondary"}
                        block={false}
                        onClick={() => {
                          if (dirty && !window.confirm(LEAVE_WARNING)) return;
                          router.push(startBreakHref(entry, "plan"));
                        }}
                      >
                        {due ? BREAK_ACTION_COPY.start : BREAK_ACTION_COPY.startEarly}
                      </Button>
                    )}
                    {due ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        block={false}
                        onClick={() => {
                          track("planned_break_snoozed", { break_id: entry.id, minutes: 15 });
                          editDraft(snoozeBreak(plan, entry.id, 15));
                        }}
                      >
                        {BREAK_ACTION_COPY.snooze}
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="tertiary"
                      block={false}
                      onClick={() => {
                        track("planned_break_skipped", { break_id: entry.id });
                        editDraft(skipBreak(plan, entry.id));
                      }}
                    >
                      {BREAK_ACTION_COPY.skip}
                    </Button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>

        <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 mt-6 lg:bottom-4">
          <div className="flex flex-wrap items-center gap-3 rounded-card border border-ink bg-sheet px-4 py-3">
            <p className="min-w-0 flex-1 text-sm text-muted" role="status">
              {draft ? "Unsaved changes" : saved ? "Saved" : "No changes"}
            </p>
            <Button variant="ink" size="sm" block={false} onClick={saveDraft} disabled={!draft}>
              {saved && !draft ? "Saved" : "Save plan"}
            </Button>
          </div>
        </div>

        <div className="mt-4">
          <Button
            variant="secondary"
            onClick={() => {
              if (draft && !window.confirm(DISCARD_WARNING)) return;
              setDraft(null);
              setSaved(false);
              openEditor();
            }}
          >
            Change my hours
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col px-5 py-6 lg:max-w-[560px] lg:px-0">
      <h1 className="font-display font-extrabold text-[1.8rem] leading-tight text-ink">
        When do you normally work?
      </h1>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <label className="text-sm font-semibold text-muted">
          Start
          <input
            type="time"
            value={start}
            onChange={(event) => setStart(event.target.value)}
            className="mt-1.5 min-h-13 w-full rounded-[14px] border border-line-strong bg-white px-4 text-base text-ink"
          />
        </label>
        <label className="text-sm font-semibold text-muted">
          Finish
          <input
            type="time"
            value={end}
            onChange={(event) => setEnd(event.target.value)}
            className="mt-1.5 min-h-13 w-full rounded-[14px] border border-line-strong bg-white px-4 text-base text-ink"
          />
        </label>
      </div>

      <fieldset className="mt-6">
        <legend className="text-sm font-semibold text-muted">Workdays</legend>
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
        <legend className="font-display font-extrabold text-lg text-ink">How much help do you want?</legend>
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
                  active ? "border border-ink bg-ink text-paper" : "border border-line-strong bg-sheet text-ink hover:border-ink",
                ].join(" ")}
              >
                <span className="font-semibold">{option.label}</span>
                <span className={active ? "text-paper/70" : "text-muted"}>{option.hint}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {error ? (
        <p className="mt-4 text-sm font-semibold text-pen" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-7 grid gap-2.5">
        {existing ? (
          <>
            <Button onClick={buildFromForm} disabled={!formChanged}>
              Save plan
            </Button>
            <p className="text-center text-xs text-muted">Saving rebuilds today&apos;s breaks around your new hours.</p>
            <Button
              variant="tertiary"
              onClick={() => {
                if (formChanged && !window.confirm(DISCARD_WARNING)) return;
                setStart(toTimeInput(existing.startMinutes));
                setEnd(toTimeInput(existing.endMinutes));
                setLevel(existing.level);
                setDays(existing.enabledDays);
                setError(null);
                setEditing(false);
              }}
            >
              Cancel
            </Button>
          </>
        ) : (
          <Button onClick={buildFromForm}>Build my workday</Button>
        )}
      </div>
    </div>
  );
}

const LEAVE_WARNING = "You have unsaved changes to your plan. Leave without saving?";
const DISCARD_WARNING = "Discard your unsaved changes to today's plan?";

/**
 * Warns before unsaved plan edits are lost: the browser's own prompt on
 * reload or close, and a confirm on any in-app link while there are changes.
 */
function useUnsavedChangesGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    // Capture phase on the document runs before Next's Link handler.
    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      if (!anchor || anchor.getAttribute("target") === "_blank") return;
      if (window.confirm(LEAVE_WARNING)) return;
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);
}
