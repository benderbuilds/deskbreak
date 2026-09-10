export const FIRST_WIN_PROGRAM_ID = "desk-reset-2min";

export const HOME_START_NUDGE = "Meeting gap? Hit reset before Slack wins.";

export const ANNUAL_PRICE_USD = 47.99;
export const MONTHLY_COMPARE_USD = 8.99;
export const ANNUAL_PER_MONTH = 4;

export const GOAL_COPY: Record<
  "neck" | "energy" | "consistent",
  { label: string; homeLine: string }
> = {
  neck: {
    label: "Less neck pain",
    homeLine: "Today’s job: unstick the neck without leaving the chair.",
  },
  energy: {
    label: "More energy",
    homeLine: "Two minutes to come back online between blocks.",
  },
  consistent: {
    label: "Stay consistent",
    homeLine: "Show up for the tiny reset. That’s the whole game.",
  },
};

export const SETUP_COPY: Record<"seated" | "standing", { label: string; hint: string }> =
  {
    seated: {
      label: "Mostly seated",
      hint: "Chair-first moves. Stand only if you want to.",
    },
    standing: {
      label: "Standing desk",
      hint: "We’ll mix seated and stand-at-desk work.",
    },
  };

export const REMINDER_HOURS: Record<"off" | "midday" | "afternoon", number | null> = {
  off: null,
  midday: 12,
  afternoon: 15,
};
