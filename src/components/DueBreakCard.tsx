"use client";

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
import { formatMinutes } from "@/lib/dates";
import { saveWorkdayPlan } from "@/lib/storage";
import { BREAK_TYPE_COPY, isMicroBreak, skipBreak, snoozeBreak } from "@/lib/workday";
import type { PlannedBreak, WorkdayPlan } from "@/lib/types";

/**
 * The planned break that is due now, at the top of Today so it is the first
 * thing on a phone screen. It holds the screen's one primary button.
 */
export function DueBreakCard({ plan, entry }: { plan: WorkdayPlan; entry: PlannedBreak }) {
  const router = useRouter();
  const micro = isMicroBreak(entry);
  const title = breakTitle(entry, BREAK_TYPE_COPY[entry.type].label);
  const until = entry.snoozedUntilMinutes ? entry.snoozedUntilMinutes + 15 : entry.endMinutes;

  return (
    <section className="surface-elevated mt-5 px-5 py-5 lg:px-7" aria-labelledby="due-break">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-coral">
        Due now
      </p>
      <h2 id="due-break" className="mt-1.5 font-display text-[1.45rem] font-semibold leading-tight text-ink">
        {micro ? `${title} for a minute` : title}
      </h2>
      <p className="mt-1 text-sm text-ink/60">
        {micro ? "A change of position is enough." : `${entry.durationMin} minutes · ${BREAK_TYPE_COPY[entry.type].blurb}`}{" "}
        Open until {formatMinutes(until)}.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {micro ? (
          <Button block={false} onClick={() => completeMicroBreak(entry, "today")}>
            {microActionLabel(entry)}
          </Button>
        ) : (
          <Button block={false} onClick={() => router.push(startBreakHref(entry, "today"))}>
            {BREAK_ACTION_COPY.start}
          </Button>
        )}
        <Button
          variant="secondary"
          block={false}
          onClick={() => {
            track("planned_break_snoozed", { break_id: entry.id, minutes: 15 });
            saveWorkdayPlan(snoozeBreak(plan, entry.id, 15));
          }}
        >
          {BREAK_ACTION_COPY.snooze}
        </Button>
        <Button
          variant="tertiary"
          block={false}
          onClick={() => {
            track("planned_break_skipped", { break_id: entry.id });
            saveWorkdayPlan(skipBreak(plan, entry.id));
          }}
        >
          {BREAK_ACTION_COPY.skip}
        </Button>
      </div>
    </section>
  );
}
