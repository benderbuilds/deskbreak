import type { BodyArea, PrimaryNeed } from "./types";

/**
 * Content for the public, indexable pages.
 *
 * Every page here exists to answer a search and then hand the reader straight
 * into a guided reset with the right need preselected. That handoff is the point;
 * the article is the part that gets them to trust it.
 */
export type AreaPage = {
  slug: string;
  need: PrimaryNeed;
  bodyAreas: BodyArea[];
  title: string;
  metaTitle: string;
  metaDescription: string;
  intro: string;
  ctaLabel: string;
  /** Exercise ids to describe, in order. Must exist in the catalog. */
  moves: string[];
  notes: string[];
};

export const AREA_PAGES: AreaPage[] = [
  {
    slug: "neck",
    need: "neck_shoulders",
    bodyAreas: ["neck"],
    title: "5 tiny neck resets you can do at your desk",
    metaTitle: "Neck stretches at your desk (2 minutes, no equipment)",
    metaDescription:
      "Five neck stretches you can do in your chair, plus a guided 2-minute neck reset you can start right now.",
    intro:
      "A laptop pulls your head forward, and your neck spends the rest of the day holding it there. These five moves put it back where it belongs. None of them need equipment, a mat, or standing up.",
    ctaLabel: "Try the guided 2-minute Neck Reset",
    moves: [
      "chin-tuck",
      "neck-side-stretch",
      "suboccipital-nod",
      "shoulder-rolls",
      "unshrug",
    ],
    notes: [
      "Go slowly. A neck stretch should feel like length, never like a pinch.",
      "If a move makes anything shoot or tingle down an arm, stop and skip it.",
    ],
  },
  {
    slug: "shoulders",
    need: "neck_shoulders",
    bodyAreas: ["shoulders", "upperBack"],
    title: "Shoulder stretches for people who type all day",
    metaTitle: "Desk shoulder stretches (2 minutes, at your desk)",
    metaDescription:
      "Shoulder and upper-back stretches for desk workers, plus a guided 2-minute reset you can start in your chair.",
    intro:
      "Typing keeps your arms out in front of you and your shoulders quietly rolling forward. These moves open the front and wake up the muscles between your shoulder blades.",
    ctaLabel: "Try the guided 2-minute Shoulder Reset",
    moves: [
      "shoulder-rolls",
      "seated-scap-squeeze",
      "chest-opener",
      "unshrug",
      "upper-trap-release",
    ],
    notes: [
      "Keep your shoulders travelling down and back, not up toward your ears.",
    ],
  },
  {
    slug: "lower-back",
    need: "back_hips",
    bodyAreas: ["core", "hips"],
    title: "Lower back relief without leaving your chair",
    metaTitle: "Lower back stretches at your desk (2 minutes)",
    metaDescription:
      "Seated lower-back stretches for desk workers, plus a guided 2-minute back reset you can start right now.",
    intro:
      "A low back that has not changed position since nine in the morning gets stiff for a boring reason: nothing has moved. These moves move it, gently, without you having to get on the floor.",
    ctaLabel: "Try the guided 2-minute Back Reset",
    moves: [
      "seated-cat-cow",
      "seated-pelvic-tilts",
      "sit-bones-find",
      "seated-figure-4",
      "long-exhale-reset",
    ],
    notes: [
      "Small ranges beat big ones here. You are looking for movement, not a stretch you have to brace for.",
    ],
  },
  {
    slug: "hips",
    need: "back_hips",
    bodyAreas: ["hips"],
    title: "Hip openers for a day spent sitting",
    metaTitle: "Hip stretches for desk workers (2 minutes, no equipment)",
    metaDescription:
      "Hip stretches you can do at your desk, seated or standing, plus a guided 2-minute reset.",
    intro:
      "Sitting keeps your hips in one folded angle for hours. Opening them takes about as long as reading a Slack thread.",
    ctaLabel: "Try the guided 2-minute Hip Reset",
    moves: [
      "seated-figure-4",
      "standing-hip-flexor",
      "standing-glute-squeeze",
      "seated-hip-opener",
      "seated-cat-cow",
    ],
    notes: [
      "For the figure-4, sit tall first and hinge forward from the hip, not the back.",
    ],
  },
  {
    slug: "wrists",
    need: "wrists_hands",
    bodyAreas: ["wrists"],
    title: "Wrist and hand breaks for keyboard hands",
    metaTitle: "Wrist stretches at your desk (2 minutes, no equipment)",
    metaDescription:
      "Wrist and hand stretches for people who type all day, plus a guided 2-minute wrist reset.",
    intro:
      "Your hands have been in roughly one shape since your first meeting. These open them back up, and they take less time than the email you are avoiding.",
    ctaLabel: "Try the guided 2-minute Wrist Reset",
    moves: [
      "wrist-circles",
      "wrist-flexor-stretch",
      "wrist-extensor-stretch",
      "finger-fans",
      "standing-wrist-shake",
    ],
    notes: [
      "Ease into the flexor and extensor stretches. Numbness or pins and needles means back off.",
    ],
  },
  {
    slug: "standing",
    need: "energy",
    bodyAreas: ["posture", "legs"],
    title: "Standing desk exercises that actually fit in a work break",
    metaTitle: "Standing desk exercises (2 minutes, beside your desk)",
    metaDescription:
      "Standing movement breaks for desk workers, plus a guided 2-minute energy reset you can do on your feet.",
    intro:
      "A standing desk is not a movement plan; it is just a different fixed position. These moves use the fact that you are already on your feet.",
    ctaLabel: "Try the guided 2-minute Energy Reset",
    moves: [
      "standing-posture-reset",
      "calf-raise",
      "standing-overhead-reach",
      "standing-hip-flexor",
      "standing-glute-squeeze",
    ],
    notes: [
      "Rest a hand on the desk for the balance-dependent ones. That is not cheating.",
    ],
  },
];

export type GuidePage = {
  slug: string;
  need: PrimaryNeed;
  title: string;
  metaTitle: string;
  metaDescription: string;
  intro: string;
  ctaLabel: string;
  sections: { heading: string; body: string }[];
};

export const GUIDE_PAGES: GuidePage[] = [
  {
    slug: "2-minute-desk-workout",
    need: "general",
    title: "The 2-minute desk workout",
    metaTitle: "The 2-minute desk workout (no equipment, no changing clothes)",
    metaDescription:
      "A 2-minute desk workout you can do between meetings, and a guided version you can start right now.",
    intro:
      "The best desk workout is the one short enough that you actually do it. Two minutes fits in the gap between a meeting ending and the next thing starting.",
    ctaLabel: "Start the guided 2-minute Desk Reset",
    sections: [
      {
        heading: "Why two minutes",
        body: "Brief movement breaks can help reduce the discomfort that builds up from staying in one position too long. How often you break up sitting matters more than how long each break is, and a two-minute reset is short enough to repeat three times a day without rearranging anything.",
      },
      {
        heading: "What goes in it",
        body: "One move for the neck, one for the shoulders and upper back, one for the spine, one for the hips, and one slow exhale at the end. That order works because it goes top down and finishes somewhere calmer than it started.",
      },
      {
        heading: "When to do it",
        body: "Mid-morning, after lunch, and mid-afternoon. If you only manage one, make it the mid-afternoon one, when a desk day has had the longest to accumulate.",
      },
    ],
  },
  {
    slug: "desk-stretches-between-meetings",
    need: "stress",
    title: "Desk stretches for the gap between meetings",
    metaTitle: "Desk stretches between meetings (2 minutes)",
    metaDescription:
      "What to do with the five minutes between calls, and a guided 2-minute reset to fill it.",
    intro:
      "The gap between two calls is the most reliably wasted part of a desk day. It is also the easiest place to put a movement break, because it is already empty.",
    ctaLabel: "Start the guided 2-minute reset",
    sections: [
      {
        heading: "Stand up first",
        body: "Getting out of the chair changes the angle of everything at once. If you do nothing else in the gap, do that.",
      },
      {
        heading: "Undo the call posture",
        body: "Shoulders down, chin back, chest open. A meeting spent leaning toward a screen leaves all three in the wrong place.",
      },
      {
        heading: "Finish with one long exhale",
        body: "One slow breath out, longer than the breath in, before you rejoin. It costs about eight seconds and you arrive at the next call as a person.",
      },
    ],
  },
  {
    slug: "desk-exercises-for-office-workers",
    need: "general",
    title: "Desk exercises for office workers",
    metaTitle: "Desk exercises for office workers (no equipment)",
    metaDescription:
      "A practical set of desk exercises for office workers, and a guided 2-minute reset to start with.",
    intro:
      "Most desk-exercise advice fails for the same reason: it assumes you will change clothes, find space, or remember. This is the version that survives an actual workday.",
    ctaLabel: "Start the guided 2-minute Desk Reset",
    sections: [
      {
        heading: "Pick by what hurts, not by muscle group",
        body: "You do not need a full-body routine at your desk. You need the four moves that address whatever is currently annoying you, which on most days is a neck, a low back, or a pair of hands.",
      },
      {
        heading: "Attach it to something that already happens",
        body: "After stand-up. Before lunch. When the afternoon slump arrives. A break attached to an event happens; a break attached to good intentions does not.",
      },
      {
        heading: "Keep the bar embarrassingly low",
        body: "Two minutes, in your clothes, beside your desk. Anything more ambitious will be the first thing dropped on a busy day, which is the day you most needed it.",
      },
    ],
  },
];

export function findAreaPage(slug: string): AreaPage | undefined {
  return AREA_PAGES.find((page) => page.slug === slug);
}

export function findGuidePage(slug: string): GuidePage | undefined {
  return GUIDE_PAGES.find((page) => page.slug === slug);
}
