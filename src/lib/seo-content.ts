import evidenceJson from "../../data/evidence.json";
import { getPrograms } from "./content";
import type { BodyArea, DurationMinutes, PrimaryNeed } from "./types";

/**
 * Content for the public, indexable pages.
 *
 * Every page here exists to answer a search and then hand the reader straight
 * into a guided reset with the right need preselected. That handoff is the
 * point; the article is the part that gets them to trust it. Ten to thirty
 * excellent pages before any scaling; never hundreds of thin ones.
 *
 * Copy rules (from the claims audit and the PT review): no "relief", "reduces
 * pain", "prevents", "fix/correct posture" or clinical language; no comparing
 * desk breaks with weekly exercise or coffee; keep the qualifiers ("in a lab
 * trial", "small", "in one trial") that make a finding accurate. Body text may
 * cite with `{cite:source-id}` and link with `[text](/path)`; see RichText.
 */

/* ---------------------------------------------------------------- *
 * Sources. Read straight from data/evidence.json so a citation can
 * never drift from the reference list on /science.
 * ---------------------------------------------------------------- */

export type Source = {
  id: string;
  title: string;
  source: string;
  year: number;
  url: string;
  summary: string;
  doi: string;
  authors?: string;
  citation?: string;
  quote?: string;
  quoteLocation?: string;
  verified: boolean;
};

const SOURCES = new Map(
  (evidenceJson as unknown as { references: Source[] }).references.map((source) => [source.id, source]),
);

/** Every reference, in the order data/evidence.json lists them. */
export function allSources(): Source[] {
  return [...SOURCES.values()];
}

/** Throws on an unknown id, so a typo in a citation fails the build. */
export function getSource(id: string): Source {
  const source = SOURCES.get(id);
  if (!source) throw new Error(`Unknown evidence source: ${id}`);
  return source;
}

/** "Dunstan et al., 2012". Every library source has three or more authors. */
export function shortCitation(id: string): string {
  const source = getSource(id);
  const first = source.authors?.split(",")[0]?.trim();
  return first ? `${first} et al., ${source.year}` : `${source.source}, ${source.year}`;
}

/** Five findings for the landing page. Qualifiers are load-bearing; keep them. */
export const PROOF_CALLOUTS: { text: string; sourceId: string }[] = [
  {
    text: "2-minute walks every 20 minutes lowered post-meal blood sugar in a lab trial.",
    sourceId: "dunstan-2012",
  },
  {
    text: "Short breaks, small lift: micro-breaks boosted energy and eased fatigue across 22 studies.",
    sourceId: "albulescu-2022",
  },
  {
    text: "Breaks didn’t cost productivity. Trials in office workers found moderate-quality evidence of no harm to output.",
    sourceId: "waongenngarm-2018",
  },
  {
    text: "In a 6-month trial, office workers who took active breaks reported new neck pain less often: 17% vs 44%.",
    sourceId: "waongenngarm-2021",
  },
  {
    text: "The WHO’s 2020 guidelines recommend adults limit time spent sitting, and say “some physical activity is better than none”.",
    sourceId: "who-2020",
  },
];

/**
 * Moves where the move itself, or a close analogue, was studied. Only these
 * cite a study on their move page; everything else links to /science.
 */
export const MOVE_STUDIES: Record<string, string[]> = {
  "short-walk": ["dunstan-2012"],
  "walk-to-water-march": ["dunstan-2012"],
  "screen-distance-blink": ["talens-estarelles-2023"],
};

/* ---------------------------------------------------------------- *
 * Intent pages.
 * ---------------------------------------------------------------- */

/**
 * "posture" is a target the engine is adding. Until PrimaryNeed carries it,
 * /app/start falls back to a general reset for that link.
 */
export type LandingNeed = PrimaryNeed | "posture";

const NEED_ROUTINE_LABEL: Record<LandingNeed, string> = {
  general: "Desk Reset",
  neck_shoulders: "Neck + Shoulder Reset",
  back_hips: "Back + Hip Reset",
  wrists_hands: "Wrist + Hand Reset",
  energy: "Energy Reset",
  stress: "Calm Reset",
  posture: "Posture Reset",
};

/** Free resets are 2 or 3 minutes; a longer page starts the free 3-minute one. */
export function startMinutes(durationMinutes: DurationMinutes): DurationMinutes {
  return durationMinutes <= 3 ? durationMinutes : 3;
}

/**
 * The name of the routine a CTA actually starts, so the card title and the
 * button always say the same thing as the workout screen.
 */
export function startRoutineName(need: LandingNeed, minutes: DurationMinutes, setup?: "seated" | "standing"): string {
  const program = getPrograms().find(
    (entry) =>
      entry.access === "free" &&
      entry.primaryNeed === need &&
      entry.durationMin === minutes &&
      (!setup || entry.setup === setup),
  );
  if (program && /^\d+-Minute /.test(program.name)) return program.name;
  return `${minutes}-Minute ${NEED_ROUTINE_LABEL[need]}`;
}

/** Shown on pages written for pain searches. Treatment framing stays off the page. */
export const PAIN_NOTE =
  "DeskBreak is general movement for people without a current injury. It isn't treatment. Keep every move small and comfortable, and skip any that makes symptoms worse. If pain is new, sharp or spreading, comes with numbness, tingling or weakness, or lasts more than a couple of weeks, check with a physical therapist or doctor before continuing.";

export type LandingPage = {
  slug: string;
  need: LandingNeed;
  /** Length of the routine the article describes. */
  durationMinutes: DurationMinutes;
  /** Position the CTA asks for, when the page is about one. */
  setup?: "seated" | "standing";
  title: string;
  metaTitle: string;
  metaDescription: string;
  /** The short answer, straight under the H1. */
  answer: string;
  /** Heading over the list of moves. */
  movesHeading: string;
  /** Exercise ids to describe, in order. Must exist in the catalog. */
  moves: string[];
  sections: { heading: string; body: string }[];
  ctaTitle: string;
  /** Pages for pain searches carry a visible "If you have pain" box. */
  painNote?: boolean;
  /** Search queries this page is written for. */
  intents: string[];
};

export const LANDING_PAGES: LandingPage[] = [
  {
    slug: "desk-exercises",
    need: "general",
    durationMinutes: 3,
    title: "Desk Exercises You Can Do While Working",
    metaTitle: "Desk exercises you can do while working (guided, 3 minutes)",
    metaDescription:
      "Desk exercises for the neck, shoulders, back, wrists, hips and legs, plus a guided 3-minute Desk Reset you can start right now. No equipment, no signup.",
    answer:
      "The best desk exercises move the parts of you that sitting keeps still: neck, shoulders, upper back, wrists, hips and legs. A mix of mobility, light strengthening and standing up covers more than stretching alone, and three minutes is short enough to fit into a workday.",
    movesHeading: "Best desk exercises",
    moves: ["chin-tuck", "shoulder-rolls", "seated-scap-squeeze", "wrist-circles", "seated-thoracic-rotation", "seated-figure-4", "calf-raise", "short-walk"],
    sections: [
      {
        heading: "Why movement breaks matter",
        body: "Sitting is not dangerous in itself, but hours without moving can leave you feeling stiff and flat by the afternoon. Research on breaking up long sits with short bouts of movement is growing, and studies have found benefits from breaks taken often, not just from long workouts {cite:dunstan-2012,waongenngarm-2018}.",
      },
      {
        heading: "How often should you move?",
        body: "Official guidance doesn't set an exact number {cite:who-2020}. Studies of desk workers have often tested breaks every 20 to 30 minutes {cite:dunstan-2012,mclean-2001,shrestha-2018}. If that sounds like a lot, one reset in the afternoon slump is a real start. There's more in [how often should you get up from your desk?](/blog/how-often-should-you-get-up-from-your-desk)",
      },
      {
        heading: "Mobility, activation, and getting up",
        body: "Stretching feels good and can ease discomfort {cite:shariat-2018}. Adding some strengthening and getting on your feet covers more ground. A good desk routine also wakes up muscles that do little in a chair, like the upper back and glutes, and gets you standing for a moment. That is what DeskBreak's Desk Reset does, in order.",
      },
    ],
    ctaTitle: "Try the guided version",
    intents: ["desk exercises", "desk exercises while working", "exercises at your desk"],
  },
  {
    slug: "office-workout",
    need: "general",
    durationMinutes: 5,
    title: "5-Minute Office Workout",
    metaTitle: "5-minute office workout (no equipment, at your desk)",
    metaDescription:
      "A five-minute office workout you can do beside your desk in work clothes. Start with the free guided 3-minute version right now.",
    answer:
      "An office workout does not need a gym or a change of clothes. Five minutes of mobility, light strength and a short walk, done beside your desk, covers the whole desk chain from neck to calves. The guided free version is three minutes; the full five-minute workout is in Pro.",
    movesHeading: "The 5-minute office workout, move by move",
    moves: ["standing-posture-reset", "shoulder-rolls", "chest-opener", "seated-thoracic-rotation", "standing-hip-flexor", "sit-to-stand-glute", "calf-raise", "short-walk"],
    sections: [
      {
        heading: "What five minutes buys you",
        body: "Two minutes interrupts sitting {cite:dunstan-2012}. Five minutes is long enough to get to the hips and upper back properly and add some leg work like sit-to-stands and calf raises, which are as close to strength training as an office allows.",
      },
      {
        heading: "When to do it",
        body: "Before lunch or in the mid-afternoon slump, when you've been at the desk longest. If you only do one, make it the afternoon one.",
      },
      {
        heading: "Office-friendly by design",
        body: "Nothing here needs a mat, the floor, or space beyond a chair and a metre of carpet. Nobody on the next desk will notice, and if they do they will probably join in.",
      },
    ],
    ctaTitle: "Try the guided version",
    intents: ["office workout", "5 minute office workout", "workout at the office"],
  },
  {
    slug: "desk-workout",
    need: "general",
    durationMinutes: 3,
    title: "Desk Workout for Computer Workers",
    metaTitle: "Desk workout for computer workers (3 minutes, guided)",
    metaDescription:
      "A desk workout built for people who sit at a computer all day: mobility, activation and movement in three minutes, with a guided reset you can start now.",
    answer:
      "A desk workout is a short, structured movement break: loosen what is stiff, switch on what has gone quiet, then stand up and move. Short breaks you actually take add up, and they're easier to repeat than a long session.",
    movesHeading: "Desk workout moves for computer workers",
    moves: ["chin-tuck", "seated-scap-squeeze", "wrist-flexor-stretch", "seated-cat-cow", "seated-march", "standing-posture-reset"],
    sections: [
      {
        heading: "The order matters",
        body: "Start gently with the neck and upper back, add a little activation for the shoulder blades, move the wrists, then the spine and hips, then get the legs going. Finishing standing up means you sit back down in a different position.",
      },
      {
        heading: "Effort level",
        body: "This is not a gym session, and it doesn't replace one. Everything should feel like movement, not strain. If a move produces sharp pain, numbness, weakness or dizziness, stop it.",
      },
      {
        heading: "Make it automatic",
        body: "The hard part is remembering. A guided version with a timer removes the planning, and a reminder in the afternoon removes the remembering.",
      },
    ],
    ctaTitle: "Try the guided version",
    intents: ["desk workout", "workout at your desk", "computer worker exercises"],
  },
  {
    slug: "neck-shoulder-exercises",
    need: "neck_shoulders",
    durationMinutes: 3,
    title: "Neck and Shoulder Exercises for Desk Workers",
    metaTitle: "Neck and shoulder exercises for desk workers (guided, 3 minutes)",
    metaDescription:
      "Neck and shoulder exercises you can do in your chair, plus a guided 3-minute Neck + Shoulder Reset that starts right now.",
    answer:
      "A screen tends to pull the head forward and the shoulders up. Chasing a perfect posture isn't the answer. Moving often, plus a little strengthening for the upper back, is what the research points to {cite:louw-2017}.",
    movesHeading: "Best neck and shoulder exercises",
    moves: ["chin-tuck", "neck-side-stretch", "shoulder-rolls", "unshrug", "seated-scap-squeeze", "chest-opener"],
    sections: [
      {
        heading: "Mobility first, then activation",
        body: "Gentle neck movement and shoulder rolls take the joints through ranges a desk rarely asks for. Then squeezing the shoulder blades gives the upper back some work, which it doesn't get much of when the arms live in front of the body all day.",
      },
      {
        heading: "Go slowly",
        body: "A neck exercise should feel like length and movement, never a pinch. If anything shoots or tingles into an arm, stop that move and skip it.",
      },
      {
        heading: "Little and often",
        body: "Small amounts add up: in one trial, 2 minutes a day of shoulder exercise with an elastic band reduced neck and shoulder pain about as much as 12 minutes a day {cite:andersen-2011}. DeskBreak's no-equipment moves are a lighter version of that idea, and short breaks are easier to repeat.",
      },
    ],
    ctaTitle: "Try the guided version",
    painNote: true,
    intents: ["neck stretches desk worker", "neck and shoulder exercises", "neck exercises at desk"],
  },
  {
    slug: "back-stretches-desk-workers",
    need: "back_hips",
    durationMinutes: 3,
    title: "Back Stretches for Desk Workers",
    metaTitle: "Back stretches for desk workers (seated, 3 minutes, guided)",
    metaDescription:
      "Back and hip stretches for people who sit all day, plus a guided 3-minute Back + Hip Reset you can start without leaving your chair.",
    answer:
      "A back that has not changed position since nine in the morning gets stiff for a boring reason: nothing has moved. These moves take the spine and hips through their range without you getting on the floor, and get you standing for a moment.",
    movesHeading: "Best back and hip stretches",
    moves: ["seated-cat-cow", "seated-pelvic-tilts", "seated-thoracic-rotation", "seated-figure-4", "standing-hip-flexor", "standing-glute-squeeze"],
    sections: [
      {
        heading: "Move the spine in every direction",
        body: "Flexion and extension with cat-cow, rotation with a seated twist, and a little sidebending. The spine likes variety more than it likes any single position.",
      },
      {
        heading: "Do not forget the hips",
        body: "Sitting keeps the hips folded at one angle for hours. Opening them, then waking the glutes with a squeeze or a sit-to-stand, gives the whole area a change of position.",
      },
      {
        heading: "Small ranges beat big ones",
        body: "You are looking for movement, not a stretch you have to brace for. Stop if anything is sharp.",
      },
    ],
    ctaTitle: "Try the guided version",
    painNote: true,
    intents: ["back stretches desk workers", "lower back stretches at desk", "sitting back pain exercises"],
  },
  {
    slug: "wrist-exercises-desk-workers",
    need: "wrists_hands",
    durationMinutes: 3,
    title: "Wrist Exercises for Computer Work",
    metaTitle: "Wrist exercises for computer work (3 minutes, guided)",
    metaDescription:
      "Wrist, forearm and hand exercises for people who type all day, plus a guided 3-minute Wrist + Hand Reset.",
    answer:
      "Hands spend the day in roughly one shape. Regular wrist and forearm movement, opening the hand fully, and short breaks from the mouse and keyboard can help keep them comfortable {cite:mclean-2001}. None of it takes longer than the email you are avoiding.",
    movesHeading: "Best wrist and hand exercises",
    moves: ["wrist-circles", "wrist-flexor-stretch", "wrist-extensor-stretch", "finger-fans", "shoulder-rolls", "seated-scap-squeeze"],
    sections: [
      {
        heading: "Both sides of the forearm",
        body: "The muscles that grip a mouse and the ones that lift fingers off keys sit on opposite sides of the forearm. A good wrist break lengthens both, gently.",
      },
      {
        heading: "The shoulders carry the hands",
        body: "The whole arm works together. Shoulder rolls and a shoulder-blade squeeze change what the whole arm is doing, which is why they belong in a wrist reset.",
      },
      {
        heading: "Numbness means back off",
        body: "Ease into the stretches. Pins and needles, numbness or sharp pain are reasons to stop that move. DeskBreak is general movement guidance, not a treatment for wrist conditions; persistent symptoms deserve a clinician.",
      },
    ],
    ctaTitle: "Try the guided version",
    painNote: true,
    intents: ["wrist exercises desk workers", "wrist pain desk exercises", "typing wrist stretches"],
  },
  {
    slug: "standing-desk-exercises",
    need: "energy",
    durationMinutes: 3,
    setup: "standing",
    title: "Standing Desk Exercises",
    metaTitle: "Standing desk exercises (3 minutes, beside your desk)",
    metaDescription:
      "Standing desk exercises that fit in a work break: calf raises, sit-to-stands, hip openers and more, with a guided 3-minute Energy Reset.",
    answer:
      "A standing desk helps you sit less {cite:edwardson-2022}, but standing still is still one fixed position. These moves use the fact that you are already on your feet to add some leg and hip work in three minutes.",
    movesHeading: "Best standing desk exercises",
    moves: ["standing-posture-reset", "calf-raise", "sit-to-stand-glute", "standing-hip-flexor", "standing-overhead-reach", "standing-glute-squeeze"],
    sections: [
      {
        heading: "Standing still is still still",
        body: "A standing desk works best as a way to change position, not as a new place to stand still for hours. Shifting weight, calf raises and a short walk are what turn standing into movement.",
      },
      {
        heading: "Use the desk",
        body: "Rest a hand on it for the balance-dependent moves. That is not cheating; it is the point of having a desk right there.",
      },
      {
        heading: "Afternoon energy",
        body: "A few minutes of standing movement can help you feel more alert. Short movement breaks gave a small boost to energy and reduced fatigue in studies of micro-breaks {cite:albulescu-2022}.",
      },
    ],
    ctaTitle: "Try the guided version",
    intents: ["standing desk exercises", "standing desk stretches", "exercises at standing desk"],
  },
  {
    slug: "workplace-stretching",
    need: "general",
    durationMinutes: 3,
    title: "Workplace Stretching That Actually Fits a Workday",
    metaTitle: "Workplace stretching routine (3 minutes, guided, no equipment)",
    metaDescription:
      "A workplace stretching routine built around what a workday allows: in your clothes, beside your desk, three minutes, guided.",
    answer:
      "Workplace stretching works when it is short enough to actually happen. A three-minute routine that covers the neck, shoulders, back, wrists and hips, done two or three times a day, is easier to stick with than a long session nobody has time for.",
    movesHeading: "Workplace stretches, in order",
    moves: ["chin-tuck", "neck-side-stretch", "chest-opener", "wrist-flexor-stretch", "seated-cat-cow", "seated-figure-4", "standing-hip-flexor", "long-exhale-reset"],
    sections: [
      {
        heading: "Stretching plus a little more",
        body: "Stretching is pleasant, and trials in office workers have found it can reduce discomfort {cite:shariat-2018}. Adding light activation and a moment of standing means you sit back down in a different position.",
      },
      {
        heading: "Attach it to something that already happens",
        body: "After stand-up. Before lunch. When the afternoon slump arrives. A break attached to something that already happens is much easier to remember.",
      },
      {
        heading: "Keep the bar low",
        body: "Three minutes, in your clothes, beside your desk. Anything more ambitious is the first thing dropped on a busy day, which is the day you most needed it.",
      },
    ],
    ctaTitle: "Try the guided version",
    intents: ["workplace stretching", "stretches at work", "office stretching routine"],
  },
  {
    slug: "posture-reset",
    need: "posture",
    durationMinutes: 3,
    title: "Posture Reset: Change Positions, Not Chase a Perfect One",
    metaTitle: "Posture reset for desk workers (3 minutes, guided)",
    metaDescription:
      "There is no single correct way to sit. A guided 3-minute posture reset that gets you out of the position you've been in, and into a few different ones.",
    answer:
      "The best posture is the next one. There is little evidence that one 'correct' sitting posture prevents pain; in trials with office workers, active breaks that involved changing position were linked to less reported discomfort {cite:waongenngarm-2018,waongenngarm-2021}. A posture reset is three minutes of doing exactly that.",
    movesHeading: "Posture reset moves",
    moves: ["sit-bones-find", "chin-tuck", "seated-cat-cow", "seated-thoracic-rotation", "stand-and-shift", "standing-posture-reset"],
    sections: [
      {
        heading: "Why not just sit up straight?",
        body: "Sitting up straight is fine. So is leaning back, perching forward, or standing for a while. The trouble is staying in any one of them for hours. DeskBreak never tells you to hold a pose; it tells you to sit differently, and to get up. [How DeskBreak uses the research](/science).",
      },
      {
        heading: "What a posture reset does",
        body: "It walks you through a few different positions: finding your sit bones, sliding the chin back, rounding and arching the spine, turning through the upper back, then standing and shifting your weight. When you sit back down, you sit down somewhere new.",
      },
      {
        heading: "How often",
        body: "Official guidance doesn't set an interval {cite:who-2020}. Studies of desk workers have often tested breaks every 20 to 30 minutes {cite:mclean-2001,shrestha-2018}. Start with the number you'll actually do, and add more once it's a habit.",
      },
    ],
    ctaTitle: "Try the guided version",
    intents: ["posture reset", "posture exercises at desk", "sitting posture desk worker"],
  },
];

export function findLandingPage(slug: string): LandingPage | undefined {
  return LANDING_PAGES.find((page) => page.slug === slug);
}

/* ---------------------------------------------------------------- *
 * V2 pages, kept live: they are indexed and still hand off correctly.
 * ---------------------------------------------------------------- */

export type AreaPage = {
  slug: string;
  need: PrimaryNeed;
  bodyAreas: BodyArea[];
  title: string;
  metaTitle: string;
  metaDescription: string;
  intro: string;
  /** Position the CTA asks for, when the page is about one. */
  setup?: "seated" | "standing";
  painNote?: boolean;
  moves: string[];
  notes: string[];
};

export const AREA_PAGES: AreaPage[] = [
  {
    slug: "neck",
    need: "neck_shoulders",
    painNote: true,
    bodyAreas: ["neck"],
    title: "5 tiny neck resets you can do at your desk",
    metaTitle: "Neck stretches at your desk (3 minutes, no equipment)",
    metaDescription:
      "Five neck stretches you can do in your chair, plus a guided 3-minute neck reset you can start right now.",
    intro:
      "A laptop pulls your head forward, and your neck spends the rest of the day holding it there. These five moves give your neck some different positions. None of them need equipment, a mat, or standing up.",
    moves: ["chin-tuck", "neck-side-stretch", "suboccipital-nod", "shoulder-rolls", "unshrug"],
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
    metaTitle: "Desk shoulder stretches (3 minutes, at your desk)",
    metaDescription:
      "Shoulder and upper-back stretches for desk workers, plus a guided 3-minute reset you can start in your chair.",
    intro:
      "Typing keeps your arms out in front of you and your shoulders quietly rolling forward. These moves open the front and wake up the muscles between your shoulder blades.",
    moves: ["shoulder-rolls", "seated-scap-squeeze", "chest-opener", "unshrug", "upper-trap-release"],
    notes: ["Keep your shoulders travelling down and back, not up toward your ears."],
  },
  {
    slug: "lower-back",
    need: "back_hips",
    painNote: true,
    bodyAreas: ["core", "hips"],
    title: "Lower back movement without leaving your chair",
    metaTitle: "Lower back stretches at your desk (3 minutes)",
    metaDescription:
      "Seated lower-back stretches for desk workers, plus a guided 3-minute back reset you can start right now.",
    intro:
      "A low back that has not changed position since nine in the morning gets stiff for a boring reason: nothing has moved. These moves move it, gently, without you having to get on the floor.",
    moves: ["seated-cat-cow", "seated-pelvic-tilts", "sit-bones-find", "seated-figure-4", "long-exhale-reset"],
    notes: ["Small ranges beat big ones here. You are looking for movement, not a stretch you have to brace for."],
  },
  {
    slug: "hips",
    need: "back_hips",
    bodyAreas: ["hips"],
    title: "Hip openers for a day spent sitting",
    metaTitle: "Hip stretches for desk workers (3 minutes, no equipment)",
    metaDescription: "Hip stretches you can do at your desk, seated or standing, plus a guided 3-minute reset.",
    intro:
      "Sitting keeps your hips in one folded angle for hours. Opening them takes about as long as reading a Slack thread.",
    moves: ["seated-figure-4", "standing-hip-flexor", "standing-glute-squeeze", "seated-hip-opener", "seated-cat-cow"],
    notes: ["For the figure-4, sit tall first and hinge forward from the hip, not the back."],
  },
  {
    slug: "wrists",
    need: "wrists_hands",
    painNote: true,
    bodyAreas: ["wrists"],
    title: "Wrist and hand breaks for keyboard hands",
    metaTitle: "Wrist stretches at your desk (3 minutes, no equipment)",
    metaDescription: "Wrist and hand stretches for people who type all day, plus a guided 3-minute wrist reset.",
    intro:
      "Your hands have been in roughly one shape since your first meeting. These open them back up, and they take less time than the email you are avoiding.",
    moves: ["wrist-circles", "wrist-flexor-stretch", "wrist-extensor-stretch", "finger-fans", "standing-wrist-shake"],
    notes: ["Ease into the flexor and extensor stretches. Numbness or pins and needles means back off."],
  },
  {
    slug: "standing",
    need: "energy",
    setup: "standing",
    bodyAreas: ["posture", "legs"],
    title: "Standing desk exercises that actually fit in a work break",
    metaTitle: "Standing desk exercises (3 minutes, beside your desk)",
    metaDescription:
      "Standing movement breaks for desk workers, plus a guided 3-minute energy reset you can do on your feet.",
    intro:
      "A standing desk helps you sit less, but standing still is still one fixed position. These moves use the fact that you are already on your feet.",
    moves: ["standing-posture-reset", "calf-raise", "standing-overhead-reach", "standing-hip-flexor", "standing-glute-squeeze"],
    notes: ["Rest a hand on the desk for the balance-dependent ones. That is not cheating."],
  },
];

export type GuidePage = {
  slug: string;
  need: PrimaryNeed;
  title: string;
  metaTitle: string;
  metaDescription: string;
  intro: string;
  /** Length of the free reset the CTA starts. */
  minutes: 2 | 3;
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
    minutes: 2,
    sections: [
      {
        heading: "Why two minutes",
        body: "Brief movement breaks can help reduce the discomfort that builds up from staying in one position too long {cite:waongenngarm-2018,mclean-2001}. Short breaks taken often are the pattern most studies have tested, and a two-minute reset is short enough to repeat three times a day without rearranging anything.",
      },
      {
        heading: "What goes in it",
        body: "One move for the neck, one for the shoulders and upper back, one for the spine, one for the hips, and a moment standing at the end. That order works because it goes top down and finishes somewhere different from where it started.",
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
    metaDescription: "What to do with the five minutes between calls, and a guided reset to fill it.",
    intro:
      "The gap between two calls is the most reliably wasted part of a desk day. It is also the easiest place to put a movement break, because it is already empty.",
    minutes: 2,
    sections: [
      {
        heading: "Stand up first",
        body: "Getting out of the chair changes the angle of everything at once. If you do nothing else in the gap, do that.",
      },
      {
        heading: "Undo the call posture",
        body: "Shoulders down, chin back, chest open. A meeting spent leaning toward a screen keeps all three in one position for an hour, so move them the other way for a moment.",
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
      "A practical set of desk exercises for office workers, and a guided 3-minute reset to start with.",
    intro:
      "Most desk-exercise advice fails for the same reason: it assumes you will change clothes, find space, or remember. This is the version that survives an actual workday.",
    minutes: 3,
    sections: [
      {
        heading: "Pick by what bothers you, not by muscle group",
        body: "You do not need a full-body routine at your desk. You need the four moves that address whatever is currently annoying you, which on most days is a neck, a low back, or a pair of hands.",
      },
      {
        heading: "Attach it to something that already happens",
        body: "After stand-up. Before lunch. When the afternoon slump arrives. A break attached to something that already happens is much easier to remember.",
      },
      {
        heading: "Keep the bar embarrassingly low",
        body: "Three minutes, in your clothes, beside your desk. Anything more ambitious will be the first thing dropped on a busy day, which is the day you most needed it.",
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
