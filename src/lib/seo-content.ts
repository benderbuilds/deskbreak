import type { BodyArea, DurationMinutes, PrimaryNeed } from "./types";

/**
 * Content for the public, indexable pages.
 *
 * Every page here exists to answer a search and then hand the reader straight
 * into a guided reset with the right need preselected. That handoff is the
 * point; the article is the part that gets them to trust it. Ten to thirty
 * excellent pages before any scaling; never hundreds of thin ones.
 */
export type LandingPage = {
  slug: string;
  need: PrimaryNeed;
  durationMinutes: DurationMinutes;
  title: string;
  metaTitle: string;
  metaDescription: string;
  /** The short answer, straight under the H1. */
  answer: string;
  /** Exercise ids to describe, in order. Must exist in the catalog. */
  moves: string[];
  sections: { heading: string; body: string }[];
  ctaTitle: string;
  ctaLabel: string;
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
      "The best desk exercises move the parts of you that sitting keeps still: neck, shoulders, upper back, wrists, hips and legs. A mix of mobility, light activation and standing up beats stretching alone, and three minutes is enough to notice.",
    moves: ["chin-tuck", "shoulder-rolls", "seated-scap-squeeze", "wrist-circles", "seated-thoracic-rotation", "seated-figure-4", "calf-raise", "short-walk"],
    sections: [
      {
        heading: "Why movement breaks matter",
        body: "Sitting is not dangerous in itself. Sitting without moving for hours is what stiffens necks and low backs and drains the afternoon. Interrupting long sits with short bouts of movement is one of the best-evidenced things a desk worker can do, and it works better when it happens often rather than for long.",
      },
      {
        heading: "How often should you move?",
        body: "There is no single right number. Most guidance for office workers points toward a change of position every 30 to 60 minutes and a few short movement breaks across the day. If that sounds like a lot, one reset in the afternoon slump is a real start.",
      },
      {
        heading: "Mobility, activation, and getting up",
        body: "Stretching feels good but changes little on its own. A good desk routine also wakes up muscles that switch off in a chair, like the upper back and glutes, and gets you on your feet for a moment. That is what DeskBreak's Desk Reset does, in order.",
      },
    ],
    ctaTitle: "Try the guided version",
    ctaLabel: "Start the 3-Minute Desk Reset",
    intents: ["desk exercises", "desk exercises while working", "exercises at your desk"],
  },
  {
    slug: "office-workout",
    need: "general",
    durationMinutes: 5,
    title: "5-Minute Office Workout",
    metaTitle: "5-minute office workout (no equipment, at your desk)",
    metaDescription:
      "A five-minute office workout you can do beside your desk in work clothes, with a guided version that starts immediately.",
    answer:
      "An office workout does not need a gym or a change of clothes. Five minutes of mobility, light strength and a short walk, done beside your desk, covers the whole desk chain from neck to calves.",
    moves: ["standing-posture-reset", "shoulder-rolls", "chest-opener", "seated-thoracic-rotation", "standing-hip-flexor", "sit-to-stand-glute", "calf-raise", "short-walk"],
    sections: [
      {
        heading: "What five minutes buys you",
        body: "Two minutes interrupts sitting. Five minutes is long enough to get to the hips and upper back properly and add real leg work like sit-to-stands and calf raises, which are as close to strength training as an office allows.",
      },
      {
        heading: "When to do it",
        body: "Before lunch or in the mid-afternoon slump, when a desk day has had the longest to accumulate. If you only do one, make it the afternoon one.",
      },
      {
        heading: "Office-friendly by design",
        body: "Nothing here needs a mat, the floor, or space beyond a chair and a metre of carpet. Nobody on the next desk will notice, and if they do they will probably join in.",
      },
    ],
    ctaTitle: "Try the guided version",
    ctaLabel: "Start the 3-Minute Desk Reset free",
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
      "A desk workout is a short, structured movement break: loosen what is stiff, switch on what has gone quiet, then stand up and move. Done a few times a day it does more than one long session at the weekend.",
    moves: ["chin-tuck", "seated-scap-squeeze", "wrist-flexor-stretch", "seated-cat-cow", "seated-march", "standing-posture-reset"],
    sections: [
      {
        heading: "The order matters",
        body: "Start gently with the neck and upper back, add a little activation for the shoulder blades, move the wrists, then the spine and hips, then get the legs going. Finishing standing up means you sit back down differently.",
      },
      {
        heading: "Effort level",
        body: "This is not a gym session. Everything should feel like movement, not strain. If a move produces sharp pain, numbness, weakness or dizziness, stop it.",
      },
      {
        heading: "Make it automatic",
        body: "The hard part is remembering. A guided version with a timer removes the planning, and a reminder in the afternoon removes the remembering.",
      },
    ],
    ctaTitle: "Try the guided version",
    ctaLabel: "Start the 3-Minute Desk Reset",
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
      "A screen pulls the head forward and the shoulders up. The fix is not a perfect posture; it is regular movement in the opposite directions, plus a little work for the muscles between the shoulder blades.",
    moves: ["chin-tuck", "neck-side-stretch", "shoulder-rolls", "unshrug", "seated-scap-squeeze", "chest-opener"],
    sections: [
      {
        heading: "Mobility first, then activation",
        body: "Gentle neck movement and shoulder rolls take the joints through ranges a desk never asks for. Then squeezing the shoulder blades wakes up the upper back, which tends to switch off when the arms live in front of the body all day.",
      },
      {
        heading: "Go slowly",
        body: "A neck exercise should feel like length and movement, never a pinch. If anything shoots or tingles into an arm, stop that move and skip it.",
      },
      {
        heading: "Little and often",
        body: "Three minutes twice a day beats fifteen minutes once a week. The muscles that hold a head up for eight hours respond to frequent, small breaks.",
      },
    ],
    ctaTitle: "Try the guided version",
    ctaLabel: "Start the 3-Minute Neck + Shoulder Reset",
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
    moves: ["seated-cat-cow", "seated-pelvic-tilts", "seated-thoracic-rotation", "seated-figure-4", "standing-hip-flexor", "standing-glute-squeeze"],
    sections: [
      {
        heading: "Move the spine in every direction",
        body: "Flexion and extension with cat-cow, rotation with a seated twist, and a little sidebending. The spine likes variety more than it likes any single position.",
      },
      {
        heading: "Do not forget the hips",
        body: "Sitting keeps the hips folded at one angle for hours. Opening them, then waking the glutes with a squeeze or a sit-to-stand, changes what the low back has to do.",
      },
      {
        heading: "Small ranges beat big ones",
        body: "You are looking for movement, not a stretch you have to brace for. Stop if anything is sharp.",
      },
    ],
    ctaTitle: "Try the guided version",
    ctaLabel: "Start the 3-Minute Back + Hip Reset",
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
      "Hands spend the day in roughly one shape. Regular wrist and forearm movement, opening the hand fully, and short breaks from the mouse and keyboard keep them comfortable. None of it takes longer than the email you are avoiding.",
    moves: ["wrist-circles", "wrist-flexor-stretch", "wrist-extensor-stretch", "finger-fans", "shoulder-rolls", "seated-scap-squeeze"],
    sections: [
      {
        heading: "Both sides of the forearm",
        body: "The muscles that grip a mouse and the ones that lift fingers off keys sit on opposite sides of the forearm. A good wrist break lengthens both, gently.",
      },
      {
        heading: "The shoulders carry the hands",
        body: "Wrist discomfort often has company further up. Shoulder rolls and a shoulder-blade squeeze change what the whole arm is doing, which is why they belong in a wrist reset.",
      },
      {
        heading: "Numbness means back off",
        body: "Ease into the stretches. Pins and needles, numbness or sharp pain are reasons to stop that move. DeskBreak is general movement guidance, not a treatment for wrist conditions; persistent symptoms deserve a clinician.",
      },
    ],
    ctaTitle: "Try the guided version",
    ctaLabel: "Start the 3-Minute Wrist + Hand Reset",
    intents: ["wrist exercises desk workers", "wrist pain desk exercises", "typing wrist stretches"],
  },
  {
    slug: "standing-desk-exercises",
    need: "energy",
    durationMinutes: 3,
    title: "Standing Desk Exercises",
    metaTitle: "Standing desk exercises (3 minutes, beside your desk)",
    metaDescription:
      "Standing desk exercises that fit in a work break: calf raises, sit-to-stands, hip openers and more, with a guided 3-minute Energy Reset.",
    answer:
      "A standing desk is not a movement plan; it is a different fixed position. These moves use the fact that you are already on your feet to add real leg and hip work in three minutes.",
    moves: ["standing-posture-reset", "calf-raise", "sit-to-stand-glute", "standing-hip-flexor", "standing-overhead-reach", "standing-glute-squeeze"],
    sections: [
      {
        heading: "Standing still is still still",
        body: "The benefit of a standing desk comes from the position change, not from standing for hours. Shifting weight, calf raises and a short walk are what turn standing into movement.",
      },
      {
        heading: "Use the desk",
        body: "Rest a hand on it for the balance-dependent moves. That is not cheating; it is the point of having a desk right there.",
      },
      {
        heading: "Afternoon energy",
        body: "Larger movement, standing, and a raised heart rate do more for the 3 PM slump than another coffee, and the effect lasts longer.",
      },
    ],
    ctaTitle: "Try the guided version",
    ctaLabel: "Start the 3-Minute Energy Reset",
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
      "Workplace stretching works when it is short enough to actually happen. A three-minute routine that covers the neck, shoulders, back, wrists and hips, done two or three times a day, does more than a long session nobody has time for.",
    moves: ["chin-tuck", "neck-side-stretch", "chest-opener", "wrist-flexor-stretch", "seated-cat-cow", "seated-figure-4", "standing-hip-flexor", "long-exhale-reset"],
    sections: [
      {
        heading: "Stretching plus a little more",
        body: "Stretching feels good and improves how far joints move. Adding light activation and a moment of standing makes the change last into the next hour of work.",
      },
      {
        heading: "Attach it to something that already happens",
        body: "After stand-up. Before lunch. When the afternoon slump arrives. A break attached to an event happens; a break attached to good intentions does not.",
      },
      {
        heading: "Keep the bar low",
        body: "Three minutes, in your clothes, beside your desk. Anything more ambitious is the first thing dropped on a busy day, which is the day you most needed it.",
      },
    ],
    ctaTitle: "Try the guided version",
    ctaLabel: "Start the 3-Minute Desk Reset",
    intents: ["workplace stretching", "stretches at work", "office stretching routine"],
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
  ctaLabel: string;
  moves: string[];
  notes: string[];
};

export const AREA_PAGES: AreaPage[] = [
  {
    slug: "neck",
    need: "neck_shoulders",
    bodyAreas: ["neck"],
    title: "5 tiny neck resets you can do at your desk",
    metaTitle: "Neck stretches at your desk (3 minutes, no equipment)",
    metaDescription:
      "Five neck stretches you can do in your chair, plus a guided 3-minute neck reset you can start right now.",
    intro:
      "A laptop pulls your head forward, and your neck spends the rest of the day holding it there. These five moves put it back where it belongs. None of them need equipment, a mat, or standing up.",
    ctaLabel: "Try the guided 3-minute Neck + Shoulder Reset",
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
    ctaLabel: "Try the guided 3-minute Neck + Shoulder Reset",
    moves: ["shoulder-rolls", "seated-scap-squeeze", "chest-opener", "unshrug", "upper-trap-release"],
    notes: ["Keep your shoulders travelling down and back, not up toward your ears."],
  },
  {
    slug: "lower-back",
    need: "back_hips",
    bodyAreas: ["core", "hips"],
    title: "Lower back relief without leaving your chair",
    metaTitle: "Lower back stretches at your desk (3 minutes)",
    metaDescription:
      "Seated lower-back stretches for desk workers, plus a guided 3-minute back reset you can start right now.",
    intro:
      "A low back that has not changed position since nine in the morning gets stiff for a boring reason: nothing has moved. These moves move it, gently, without you having to get on the floor.",
    ctaLabel: "Try the guided 3-minute Back + Hip Reset",
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
    ctaLabel: "Try the guided 3-minute Back + Hip Reset",
    moves: ["seated-figure-4", "standing-hip-flexor", "standing-glute-squeeze", "seated-hip-opener", "seated-cat-cow"],
    notes: ["For the figure-4, sit tall first and hinge forward from the hip, not the back."],
  },
  {
    slug: "wrists",
    need: "wrists_hands",
    bodyAreas: ["wrists"],
    title: "Wrist and hand breaks for keyboard hands",
    metaTitle: "Wrist stretches at your desk (3 minutes, no equipment)",
    metaDescription: "Wrist and hand stretches for people who type all day, plus a guided 3-minute wrist reset.",
    intro:
      "Your hands have been in roughly one shape since your first meeting. These open them back up, and they take less time than the email you are avoiding.",
    ctaLabel: "Try the guided 3-minute Wrist + Hand Reset",
    moves: ["wrist-circles", "wrist-flexor-stretch", "wrist-extensor-stretch", "finger-fans", "standing-wrist-shake"],
    notes: ["Ease into the flexor and extensor stretches. Numbness or pins and needles means back off."],
  },
  {
    slug: "standing",
    need: "energy",
    bodyAreas: ["posture", "legs"],
    title: "Standing desk exercises that actually fit in a work break",
    metaTitle: "Standing desk exercises (3 minutes, beside your desk)",
    metaDescription:
      "Standing movement breaks for desk workers, plus a guided 3-minute energy reset you can do on your feet.",
    intro:
      "A standing desk is not a movement plan; it is just a different fixed position. These moves use the fact that you are already on your feet.",
    ctaLabel: "Try the guided 3-minute Energy Reset",
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
    ctaLabel: "Start the guided Desk Reset",
    sections: [
      {
        heading: "Why two minutes",
        body: "Brief movement breaks can help reduce the discomfort that builds up from staying in one position too long. How often you break up sitting matters more than how long each break is, and a two-minute reset is short enough to repeat three times a day without rearranging anything.",
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
    ctaLabel: "Start the guided reset",
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
      "A practical set of desk exercises for office workers, and a guided 3-minute reset to start with.",
    intro:
      "Most desk-exercise advice fails for the same reason: it assumes you will change clothes, find space, or remember. This is the version that survives an actual workday.",
    ctaLabel: "Start the guided Desk Reset",
    sections: [
      {
        heading: "Pick by what bothers you, not by muscle group",
        body: "You do not need a full-body routine at your desk. You need the four moves that address whatever is currently annoying you, which on most days is a neck, a low back, or a pair of hands.",
      },
      {
        heading: "Attach it to something that already happens",
        body: "After stand-up. Before lunch. When the afternoon slump arrives. A break attached to an event happens; a break attached to good intentions does not.",
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
