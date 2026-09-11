"use client";

import { useMemo } from "react";
import { shiftDay, todayKey, weekStart } from "@/lib/dates";
import { useAppState } from "@/lib/use-app-state";

const DAY_LETTERS = ["M", "T", "W", "T", "F"];

/** "This week: 9 resets · 4 active workdays · 81% helped" plus a soft M–F row. */
export function WeekSummary({ compact = false }: { compact?: boolean }) {
  const state = useAppState();
  const stats = useMemo(() => {
    const today = todayKey();
    const start = weekStart(today);
    const days = Array.from({ length: 5 }, (_, index) => shiftDay(start, index));
    const week = state.progress.history.filter((session) => {
      const key = session.finishedAt.slice(0, 10);
      return key >= start && key <= shiftDay(start, 6);
    });
    const activeDays = new Set(week.map((session) => session.finishedAt.slice(0, 10)));
    const rated = week.filter((session) => session.perceivedEffect);
    const helped = rated.filter((session) => session.perceivedEffect === "better").length;
    return {
      days,
      today,
      resets: week.length,
      activeDays,
      helpedPct: rated.length ? Math.round((helped / rated.length) * 100) : null,
      helped,
      rated: rated.length,
    };
  }, [state.progress.history]);

  if (!stats.resets && compact) {
    return null;
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink/45">This week</p>
      <dl className={["mt-2 grid gap-3", compact ? "grid-cols-3" : "grid-cols-3"].join(" ")}>
        <Stat value={String(stats.resets)} label={stats.resets === 1 ? "reset" : "resets"} />
        <Stat
          value={String(stats.activeDays.size)}
          label={stats.activeDays.size === 1 ? "active day" : "active days"}
        />
        <Stat
          value={stats.helpedPct === null ? "–" : `${stats.helped}`}
          label={stats.rated ? "helped" : "helped"}
        />
      </dl>
      <ol className="mt-3 flex gap-1.5" aria-label="Weekdays with a reset">
        {stats.days.map((key, index) => {
          const done = stats.activeDays.has(key);
          const isToday = key === stats.today;
          const future = key > stats.today;
          return (
            <li
              key={key}
              className={[
                "grid h-8 flex-1 place-items-center rounded-[10px] text-xs font-semibold",
                done ? "bg-mint text-ink" : isToday ? "border border-coral/60 text-ink/70" : "bg-ink/5 text-ink/35",
                future ? "opacity-50" : "",
              ].join(" ")}
              aria-label={`${["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"][index]}${done ? ", reset done" : ""}`}
            >
              {done ? "✓" : DAY_LETTERS[index]}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <dt className="sr-only">{label}</dt>
      <dd className="font-display text-xl font-semibold leading-none text-ink">
        {value} <span className="font-sans text-xs font-semibold text-ink/50">{label}</span>
      </dd>
    </div>
  );
}
