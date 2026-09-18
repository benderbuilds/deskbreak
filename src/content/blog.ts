import { getProgram } from "@/lib/content";
import { getSource, startRoutineName, type LandingNeed } from "@/lib/seo-content";
import type { DurationMinutes } from "@/lib/types";

/**
 * Evidence posts for /blog.
 *
 * Rules every post follows (see /science#how-we-use-sources):
 * - Every finding cites a source from data/evidence.json with `{cite:id}`.
 *   A citation outside the post's `sources` list fails the build.
 * - Direct quotes come only from a source's verified `quote` field, via a
 *   `quote` block; nothing else goes in quotation marks as a study's words.
 * - The limits a study states stay next to its finding, and each post keeps
 *   the guardrail in its `guardrail` note.
 */
export type BlogBlock =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "list"; items: string[] }
  | { type: "quote"; sourceId: string };

export type BlogCta =
  | { program: string; body: string }
  | { need: LandingNeed; minutes: DurationMinutes; setup?: "seated" | "standing"; body: string };

export type BlogPost = {
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  /** The long-tail search this post answers. */
  query: string;
  published: string;
  /** What the post must not claim. For editors; not rendered. */
  guardrail: string;
  /** Sources cited, in reference-list order. */
  sources: string[];
  painNote?: boolean;
  cta: BlogCta;
  blocks: BlogBlock[];
};

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "how-often-should-you-get-up-from-your-desk",
    title: "How often should you get up from your desk? What the studies actually tested",
    metaTitle: "How often should you get up from your desk? What studies tested",
    metaDescription:
      "No official guideline sets a break interval. Here's what studies of desk workers actually tested, from 2-minute walks every 20 minutes to microbreaks, and how to pick a rhythm you'll keep.",
    query: "how often should you take a break from sitting at work",
    published: "2026-09-18",
    guardrail: "Studies tested every 20-30 min. No official guideline sets an interval.",
    sources: ["who-2020", "dunstan-2012", "mclean-2001", "shrestha-2018"],
    cta: {
      need: "general",
      minutes: 3,
      body: "Six moves, three minutes, from neck to legs. Short enough to repeat later.",
    },
    blocks: [
      {
        type: "p",
        text: "Search for how often you should get up from your desk and you'll find confident numbers: every 30 minutes, every hour, every 20 minutes on the dot. Most are presented as if someone official settled the question. Nobody has. What we do have is a handful of studies that each picked an interval and tested it. That's more useful than a made-up rule, as long as you know what each one measured.",
      },
      { type: "h2", text: "There's no official number" },
      {
        type: "p",
        text: "The World Health Organization's 2020 guidelines are the closest thing to an official answer, and they're careful here. They recommend that adults limit the time they spend sitting and replace some of it with activity of any intensity. But the evidence wasn't strong enough to set a threshold, so there's no guideline that says to stand up every so many minutes {cite:who-2020}.",
      },
      { type: "quote", sourceId: "who-2020" },
      {
        type: "p",
        text: "So when an article tells you the guideline is every 30 minutes, it's describing someone's reading of the research, not the research itself. Fair enough. Let's look at the research.",
      },
      { type: "h2", text: "Every 20 minutes: the lab study" },
      {
        type: "p",
        text: "One of the most cited studies on breaking up sitting brought 19 overweight or obese adults, aged 45 to 65, into a lab and had them sit for five hours on three separate days {cite:dunstan-2012}. On one day they sat without a break. On the others they got up every 20 minutes for a two-minute walk, at either a light or a moderate pace.",
      },
      {
        type: "p",
        text: "After a standard test drink, blood sugar and insulin rose less on the walking days than on the day without breaks. Light walking worked nearly as well as moderate walking.",
      },
      {
        type: "p",
        text: "Keep the limits in view. It was 19 people on single days in a lab. The breaks were walks, not stretches. And the outcome was a blood marker over a few hours, not long-term health. It tells you that frequent short walks can change something measurable within a day. It doesn't tell you that every 20 minutes is the one right number.",
      },
      { type: "h2", text: "Every 20 minutes again: computer workers and discomfort" },
      {
        type: "p",
        text: "A much older field study went into real workplaces instead {cite:mclean-2001}. Computer workers did their usual keyboard work under different microbreak schedules and reported how uncomfortable they felt in the neck, low back, shoulders, and wrists and forearms.",
      },
      { type: "quote", sourceId: "mclean-2001" },
      {
        type: "p",
        text: "The microbreaks reduced discomfort in every area studied, most of all when they came every 20 minutes, and there was no sign that productivity suffered. The study is small and dates from 2001, and the authors didn't claim it prevents injuries. It's still one of the few that compared intervals directly.",
      },
      { type: "h2", text: "Every 30 minutes: cutting total sitting" },
      {
        type: "p",
        text: "A Cochrane review of workplace interventions for sitting less covered a much wider body of research {cite:shrestha-2018}. Most of it was about sit-stand desks, but one study compared breaks of one to two minutes every 30 minutes with two 15-minute breaks a day. The frequent short breaks cut sitting by about 40 minutes a day more. That's a single study, rated low quality, and the outcome was sitting time rather than health. But it points the same way as the others: short and often seems to fit a workday better than long and rare.",
      },
      { type: "h2", text: "So what should you do?" },
      {
        type: "p",
        text: "Put it together and a pattern appears. The studies that tested a rhythm mostly tested something between every 20 and every 30 minutes, with breaks of one to a few minutes. None of them pitted every 20 minutes against every hour in desk workers over months, so treat the interval as a starting point, not a rule.",
      },
      {
        type: "list",
        items: [
          "If you can manage it, a minute or two of movement every 20 to 30 minutes is what most of these studies actually tested.",
          "If that's not realistic, fewer breaks still count. The WHO's point is that some activity is better than none.",
          "Attach breaks to things that already happen: the end of a call, a finished task, a water refill.",
          "Make them different from sitting. Stand up, walk, or move the parts of you that have been still.",
        ],
      },
      {
        type: "p",
        text: "DeskBreak defaults to three minutes for a practical reason: that's long enough to move your neck, shoulders, back, wrists, hips and legs, and short enough that you'll do it again later. How often you take one is up to you, and the studies above are a reasonable guide.",
      },
    ],
  },
  {
    slug: "walking-breaks-blood-sugar-after-lunch",
    title: "Do short walking breaks lower blood sugar after lunch?",
    metaTitle: "Do short walking breaks lower blood sugar after lunch?",
    metaDescription:
      "Lab trials found that 2-minute walks during long sits lowered the rise in blood sugar after a meal. Here's what that research shows, what it doesn't, and how it fits a workday.",
    query: "do walking breaks after eating lower blood sugar at work",
    published: "2026-09-18",
    guardrail: "Moderate, short-term lab effects. Separate lab trials from observational data. No diabetes-prevention claims.",
    sources: ["dunstan-2012", "loh-2020", "healy-2008"],
    cta: {
      program: "walk-break-2min",
      body: "Stand up, walk a lap, come back. It won't measure your blood sugar; it just makes the walk easy to start.",
    },
    blocks: [
      {
        type: "p",
        text: "There's a popular idea that a short walk after lunch keeps your blood sugar steadier through the afternoon. It isn't just folklore: it has been tested, in lab studies and in a larger review. The results are real, and also narrower than the headlines that usually come with them. Here's what they show and what they don't.",
      },
      { type: "h2", text: "The lab trial that started it" },
      {
        type: "p",
        text: "In 2012, researchers had 19 adults aged 45 to 65, all overweight or obese, spend three separate days sitting in a lab {cite:dunstan-2012}. Each day included a standard test drink. On one day participants stayed seated for five hours. On the others they got up every 20 minutes for two minutes of walking, either light or moderate.",
      },
      {
        type: "p",
        text: "Compared with sitting straight through, the walking days produced a smaller rise in blood sugar and insulin after the drink. Light walking did nearly as well as moderate walking.",
      },
      { type: "quote", sourceId: "dunstan-2012" },
      {
        type: "p",
        text: "Notice the words in that conclusion: short bouts, light or moderate walking, overweight or obese adults. That's who was studied and what they did. Each condition was a single day, measured over a few hours.",
      },
      { type: "h2", text: "Does it hold up across studies?" },
      {
        type: "p",
        text: "One lab trial is a start. In 2020, a systematic review gathered 42 studies that interrupted sitting with activity breaks and pooled 37 of them {cite:loh-2020}. Across those trials, breaks lowered the rise in blood sugar, insulin and blood fats after a meal compared with sitting still. The authors described the effect on blood sugar as moderate, and it was larger in people with a higher body mass index.",
      },
      { type: "quote", sourceId: "loh-2020" },
      {
        type: "p",
        text: "Most breaks in those trials were walking or simple resistance exercise, and most were done in labs. The review looked at the hours after a meal, not at anyone's health months or years later.",
      },
      { type: "h2", text: "What about everyday life?" },
      {
        type: "p",
        text: "Lab studies control everything, which is both their strength and their limit. For a view of ordinary life, an earlier study gave activity monitors to 168 Australian adults and counted how often they broke up their sitting {cite:healy-2008}. People who took more breaks had smaller waists and healthier blood markers, even when their total sitting time was the same.",
      },
      { type: "quote", sourceId: "healy-2008" },
      {
        type: "p",
        text: "That's an association in one group of people at one point in time. It can't show that the breaks caused those differences: people who get up often may differ in plenty of other ways. What it does is line up with the lab results in a real-world setting.",
      },
      { type: "h2", text: "Lab trials and real life: why the difference matters" },
      {
        type: "p",
        text: "It's worth being clear about the two kinds of evidence here, because they answer different questions. The lab trials changed one thing, whether people took walking breaks, and measured what happened over the next few hours. That makes them good at showing cause and effect, but only for that short window and those conditions. The monitor study watched people live their normal lives. It's closer to a real workday, but it can only show that two things go together.",
      },
      {
        type: "p",
        text: "When both kinds point the same way, as they do here, that's encouraging. It still doesn't add up to proof of a long-term health benefit from desk breaks, and no study here tested one.",
      },
      { type: "h2", text: "What this means for your lunch break" },
      {
        type: "p",
        text: "Taken together, the evidence supports a modest, specific statement. Getting up for a couple of minutes of walking, regularly, during a long sit after eating lowered the rise in blood sugar and insulin over the next few hours in the adults studied. It doesn't show that walking breaks prevent diabetes, and it isn't a substitute for medical advice if you're managing your blood sugar.",
      },
      {
        type: "list",
        items: [
          "The breaks that were tested were walks, not stretches. If blood sugar is your interest, walk.",
          "Two minutes was enough in the lab. You don't need a full lunchtime workout for this particular effect.",
          "Frequency was part of the design: a walk every 20 minutes over several hours, not one walk at the end.",
          "If you have diabetes or take medication that lowers blood sugar, talk to your clinician before changing your routine.",
        ],
      },
      {
        type: "p",
        text: "None of this needs an app. A lap of the office, a trip to refill your water, or pacing during a phone call all count. DeskBreak's 2-Minute Walk Break just makes the walk easy to start when you've been sitting since lunch.",
      },
    ],
  },
  {
    slug: "sitting-all-day-if-you-work-out",
    title: "Is sitting all day bad if you work out? What data from 1 million people show",
    metaTitle: "Is sitting all day bad if you exercise? What 1 million people show",
    metaDescription:
      "Large studies found that about an hour a day of moderate activity appeared to offset the link between long sitting and early death. Here's what that means if you exercise and sit all day.",
    query: "is sitting 8 hours a day bad if you exercise",
    published: "2026-09-18",
    guardrail: "About 60-75 min/day of moderate activity offset the link. Light activity counts. Associations only; no mortality claims for DeskBreak.",
    sources: ["ekelund-2016", "ekelund-2019", "who-2020"],
    cta: {
      need: "general",
      minutes: 3,
      body: "The small piece: three minutes out of the chair, a few times a day. Not a replacement for the rest.",
    },
    blocks: [
      {
        type: "p",
        text: "You run three mornings a week, or lift, or cycle to work. Then you sit for nine hours. Does the exercise cancel out the sitting? It's one of the most common questions about desk work, and there's unusually large data to answer it, with one important catch: it's all observational. These studies show links, not cause and effect.",
      },
      { type: "h2", text: "One million adults" },
      {
        type: "p",
        text: "In 2016, researchers pooled data from 16 studies covering more than a million adults, lining up how each one measured sitting and physical activity {cite:ekelund-2016}. They then compared death rates during follow-up between people who sat more or less and moved more or less.",
      },
      {
        type: "p",
        text: "Among the least active people, sitting more than eight hours a day was linked to a clearly higher risk of dying during the study period. Among the most active quarter, it wasn't. For them, sitting more than eight hours a day made no meaningful difference compared with sitting less than four.",
      },
      { type: "quote", sourceId: "ekelund-2016" },
      { type: "h2", text: "The catch: how much activity" },
      {
        type: "p",
        text: "That most active group was doing a lot: roughly 60 to 75 minutes a day of moderate activity, like brisk walking or cycling. That's well above the minimum in most guidelines. In the less active groups, long sitting was still linked to higher risk, and most of all in the least active.",
      },
      {
        type: "p",
        text: "So the honest answer to whether exercise cancels out sitting is this: a lot of daily activity appears to, less activity appears to partly, and none doesn't. A few workouts a week put most people somewhere in the middle.",
      },
      { type: "h2", text: "Does light activity count?" },
      {
        type: "p",
        text: "The 2016 analysis relied mostly on questionnaires, and people are not good at remembering how much they sit and move. A 2019 follow-up used wearable activity monitors instead, covering about 36,000 adults with an average age of 63 {cite:ekelund-2019}.",
      },
      {
        type: "p",
        text: "More activity of any intensity, including light activity like slow walking and moving about the house, was linked to lower risk of early death, and so was less sedentary time. The biggest differences were between the least active people and everyone else.",
      },
      { type: "quote", sourceId: "ekelund-2019" },
      {
        type: "p",
        text: "Again, these are associations in middle-aged and older adults. They don't show that adding any particular break adds years to anyone's life. They do suggest that light movement isn't nothing.",
      },
      { type: "h2", text: "What the guidelines say" },
      {
        type: "p",
        text: "The World Health Organization's 2020 guidelines reflect both findings {cite:who-2020}. For adults they recommend 150 to 300 minutes a week of moderate activity, or 75 to 150 minutes of vigorous activity, plus muscle strengthening. They also recommend limiting sitting and replacing some of it with activity of any intensity, while noting the evidence wasn't strong enough to set a sitting limit.",
      },
      { type: "quote", sourceId: "who-2020" },
      { type: "h2", text: "How to read these numbers" },
      {
        type: "p",
        text: "Studies like these follow people for years and count deaths, which is why they need such huge numbers of participants. They can adjust for things like age, smoking and body weight, but they can't rule out every difference between people who sit a lot and people who don't. That's why the careful wording matters: sitting is linked to risk, activity appears to offset the link. Neither study shows what would happen if one person changed their habits.",
      },
      {
        type: "p",
        text: "They're still the best large-scale evidence we have on this question, and their message is fairly consistent: move more overall, and don't let your working day be one long unbroken sit.",
      },
      { type: "h2", text: "Where desk breaks fit" },
      {
        type: "p",
        text: "Short breaks at your desk won't add up to an hour a day of moderate activity, and nobody should tell you they will. What they can do is put some light movement into the long seated stretches of a workday, which is the part of the picture your morning run doesn't touch.",
      },
      {
        type: "list",
        items: [
          "Keep your regular exercise. In these studies, it's doing the heavy lifting.",
          "Break up long sits anyway. Light activity and less sedentary time were both linked to better outcomes.",
          "If you don't exercise yet, start anywhere. Some activity is better than none, and a walk at lunch counts.",
        ],
      },
      {
        type: "p",
        text: "DeskBreak is the small piece: a three-minute reset that gets you out of the chair a few times a day. It sits alongside regular exercise; it doesn't replace it.",
      },
    ],
  },
  {
    slug: "neck-pain-computer-work-stretch-or-strengthen",
    title: "Neck pain from computer work: stretch, strengthen, or both?",
    metaTitle: "Neck pain from computer work: stretch, strengthen, or both?",
    metaDescription:
      "What trials of office workers found about stretching and strengthening for neck pain, including the 2-minutes-a-day band study, and when to see a clinician instead.",
    query: "best exercises for neck pain from computer work",
    published: "2026-09-18",
    guardrail: "Strengthening has the better evidence; stretching helped in one office trial. See a clinician if persistent. Andersen used elastic bands.",
    sources: ["louw-2017", "andersen-2011", "shariat-2018"],
    painNote: true,
    cta: {
      need: "neck_shoulders",
      minutes: 3,
      body: "Gentle neck movement plus light shoulder-blade work, no equipment. For people without a current injury.",
    },
    blocks: [
      {
        type: "p",
        text: "If your neck aches by mid-afternoon, the internet offers two sets of advice. One says stretch: chin tucks, side bends, shoulder rolls. The other says strengthen: the muscles holding your head up need work. Both camps have some research behind them. Here's what three studies of working adults found, and what it suggests for a desk day.",
      },
      {
        type: "p",
        text: "First, a line we'll repeat at the end. This is about the everyday stiffness and aching that come with screen work. If your neck pain is new and severe, follows an injury, spreads into an arm, or comes with numbness, tingling or weakness, see a clinician rather than a blog.",
      },
      { type: "h2", text: "The review: strengthening has the stronger case" },
      {
        type: "p",
        text: "A 2017 systematic review gathered eight randomised trials of exercise for office workers with neck pain {cite:louw-2017}. Pooling the results, strengthening exercise reduced pain compared with no exercise, by an amount the authors judged large enough to matter. Only one trial tested stretching, so the review couldn't say much about it either way; the authors called for more research on stretching and endurance exercise.",
      },
      { type: "quote", sourceId: "louw-2017" },
      {
        type: "p",
        text: "One detail the conclusion glosses over: the pooled results didn't show a clear improvement in quality of life. The solid finding is about pain.",
      },
      { type: "h2", text: "Two minutes a day, with a band" },
      {
        type: "p",
        text: "One of the most practical trials in this area was published in 2011 {cite:andersen-2011}. It recruited 198 working adults, most of them women, who had frequent neck and shoulder pain. They did either 2 or 12 minutes a day of progressive shoulder exercise with an elastic band, five days a week for ten weeks, or were in a control group.",
      },
      {
        type: "p",
        text: "Both exercise groups ended up with lower pain intensity than the control group, and the two-minute group did almost as well as the 12-minute group.",
      },
      { type: "quote", sourceId: "andersen-2011" },
      {
        type: "p",
        text: "Two details matter. The exercise used elastic bands, with the resistance increased over time, so it isn't the same as no-equipment desk moves. And the trial measured how intense the pain was, not how often it happened.",
      },
      { type: "h2", text: "Stretching helped too, in one trial" },
      {
        type: "p",
        text: "Stretching isn't off the table. A 2018 trial in Malaysia followed 142 office workers who already had neck, shoulder or low back discomfort, comparing a stretching programme and workstation changes in a four-group design {cite:shariat-2018}. Over six months, pain scores for the neck, shoulders and low back fell more with stretching than in the control group, and only the exercise group kept improving between months four and six.",
      },
      {
        type: "p",
        text: "The authors concluded that therapists should include stretching rather than rely on workstation changes alone. It's one trial, in people who already had symptoms, with a supervised programme. That makes it evidence that stretching can help, not that it beats everything else.",
      },
      { type: "h2", text: "What the trials have in common" },
      {
        type: "p",
        text: "Look past the headlines and these three studies share a few features. The people in them already had neck or shoulder symptoms. The exercise was regular, most days of the week, for weeks or months. And it was structured: a set programme, often with someone checking in, rather than a stretch whenever people remembered.",
      },
      {
        type: "p",
        text: "That matters when you apply them to yourself. A single stretch when your neck already hurts isn't what was tested. A small amount of exercise done consistently over weeks is.",
      },
      { type: "h2", text: "So: stretch, strengthen, or both?" },
      {
        type: "p",
        text: "Both, with a lean toward strengthening. The best-studied option for neck pain in office workers is strengthening the neck and shoulder muscles, even in small daily doses. Stretching has less research behind it but some encouraging results. And across these trials, doing something regularly beat doing nothing.",
      },
      {
        type: "list",
        items: [
          "Include some light strengthening for the upper back and shoulders. A resistance band makes it closer to what was studied.",
          "Keep stretches gentle. You're looking for length, never a pinch.",
          "Small daily amounts added up in the band trial. Showing up mattered more than session length.",
          "Stop any move that sends symptoms down an arm, and check with a physical therapist or doctor if pain lasts more than a couple of weeks.",
        ],
      },
      {
        type: "p",
        text: "DeskBreak's Neck + Shoulder Reset mixes gentle neck movement with light shoulder-blade work, without equipment. It's a lighter version of the ideas above for people without a current injury, not a treatment for neck pain.",
      },
    ],
  },
  {
    slug: "micro-breaks-afternoon-slump",
    title: "Micro-breaks for the afternoon slump: energy, fatigue and stress",
    metaTitle: "Do short breaks reduce fatigue at work? Micro-break research",
    metaDescription:
      "A meta-analysis found micro-breaks gave a small lift in energy and a small drop in fatigue, without hurting output. Here's what short breaks can and can't do for the afternoon slump.",
    query: "do short breaks reduce fatigue at work",
    published: "2026-09-18",
    guardrail: "Small effects on energy and fatigue; breathwork modestly lowers stress as a practice; breaks don't hurt output. No 'boosts productivity'.",
    sources: ["albulescu-2022", "waongenngarm-2018", "fincham-2023"],
    cta: {
      need: "energy",
      minutes: 3,
      setup: "standing",
      body: "Three minutes on your feet: calf raises, sit-to-stands, and some hip and shoulder movement.",
    },
    blocks: [
      {
        type: "p",
        text: "Around three o'clock, a lot of desk workers hit the same wall. Eyes heavy, attention thin, the next email somehow harder than the last. One response is another coffee. Another is a short break. The research on short breaks is more modest than the productivity blogs suggest, but it's real, and it's worth knowing what it does and doesn't show.",
      },
      { type: "h2", text: "Micro-breaks and energy" },
      {
        type: "p",
        text: "A 2022 meta-analysis gathered 22 samples covering 2,335 people, workers and students, and asked what breaks of ten minutes or less actually do {cite:albulescu-2022}. Across studies, micro-breaks gave a small boost to vigour, the feeling of having energy, and a small reduction in fatigue. Small is a statistical term here: the effects were real but modest. The kind of thing you'd notice, not the kind that transforms your day.",
      },
      { type: "quote", sourceId: "albulescu-2022" },
      {
        type: "p",
        text: "The second half of that sentence matters as much as the first. On performance, the picture was weaker. Across all tasks, micro-breaks didn't significantly improve performance, with some benefit only on less demanding tasks. So the honest pitch for a break is that you may feel a bit better, not that you'll get more done.",
      },
      { type: "h2", text: "But do breaks cost you work?" },
      {
        type: "p",
        text: "If you worry that stopping costs output, there's evidence on that too. A 2018 systematic review of 11 trials in office workers looked at breaks and productivity {cite:waongenngarm-2018}.",
      },
      { type: "quote", sourceId: "waongenngarm-2018" },
      {
        type: "p",
        text: "The same review found moderate-quality evidence that active breaks with a change of posture helped with discomfort. Evidence on low back pain specifically was weaker and conflicting. So a break that gets you out of your seat looks like a fair trade: probably no cost to your work, and possibly a more comfortable afternoon.",
      },
      { type: "h2", text: "Where breathing fits" },
      {
        type: "p",
        text: "Some breaks are about slowing down rather than moving. A 2023 meta-analysis of randomised trials looked at breathwork, meaning structured practices like slow or paced breathing, and self-reported stress {cite:fincham-2023}. Breathwork was linked to modestly lower stress than control conditions, with similar effects for anxiety and low mood.",
      },
      { type: "quote", sourceId: "fincham-2023" },
      {
        type: "p",
        text: "Two cautions. The trials tested structured practices, often over weeks, not a single breath between meetings. And most of the studies carried some risk of bias. A slow breath before a call is a pleasant thing to do; it isn't a stress treatment, and we won't pretend it is.",
      },
      { type: "h2", text: "Why a small effect is still worth having" },
      {
        type: "p",
        text: "It's easy to read small and conclude it isn't worth bothering. But a micro-break costs a few minutes and nothing else. A small lift in energy for something that cheap and low-risk is a reasonable deal, as long as nobody promises you more than that.",
      },
      {
        type: "p",
        text: "The research also doesn't tell you which kind of micro-break works best. The studies in the meta-analysis used a mix of activities, from movement to relaxation. So pick one you'll actually take.",
      },
      { type: "h2", text: "What a good afternoon micro-break looks like" },
      {
        type: "list",
        items: [
          "Short enough to start without thinking about it: two or three minutes.",
          "Out of your chair if you can. Active breaks with a change of posture have the best support for desk discomfort.",
          "Away from the screen, even briefly.",
          "Finished with something calm, like a slow breath, if you're heading into a call.",
        ],
      },
      { type: "h2", text: "Putting it together" },
      {
        type: "list",
        items: [
          "A short break can give a small lift in energy and a small drop in fatigue.",
          "It probably won't make you more productive, and it probably won't make you less.",
          "Active breaks that change your position have the best support for desk discomfort.",
          "Breathing practices have modest evidence when done as a regular practice.",
        ],
      },
      {
        type: "p",
        text: "What the evidence does support is that a few minutes of standing movement is a reasonable thing to try when the afternoon drags, and that it's unlikely to cost you anything.",
      },
      {
        type: "p",
        text: "DeskBreak's Energy Reset is three minutes on your feet beside your desk, built for exactly that moment. If it helps, keep it. If it doesn't, you've lost three minutes and learned something about your afternoons.",
      },
    ],
  },
  {
    slug: "does-the-20-20-20-rule-work",
    title: "Does the 20-20-20 rule work? A small study put it to the test",
    metaTitle: "Does the 20-20-20 rule actually work for eye strain?",
    metaDescription:
      "In a small 2023 study, screen users reminded to follow the 20-20-20 rule reported less eye strain, but only while the reminders ran. Here's what it found and what it means.",
    query: "does the 20-20-20 rule actually work for eye strain",
    published: "2026-09-18",
    guardrail: "Symptoms improved while reminders ran and faded after. No claims about vision or dry-eye treatment.",
    sources: ["talens-estarelles-2023", "stephenson-2017"],
    cta: {
      program: "eye-break-1min",
      body: "A distance look, some slow blinks, a moment away from the screen. For comfort, not a treatment for eye conditions.",
    },
    blocks: [
      {
        type: "p",
        text: "The 20-20-20 rule is simple: every 20 minutes, look at something 20 feet (about 6 metres) away for 20 seconds. It's widely recommended to people who spend long hours at screens. What's surprising is how little it had been directly tested, until a small study in 2023.",
      },
      { type: "h2", text: "The study" },
      {
        type: "p",
        text: "Researchers recruited 29 computer users who already had symptoms of digital eye strain {cite:talens-estarelles-2023}. For two weeks, software on their computers reminded them to follow the rule. Then the reminders stopped for a week. The team measured eye strain and dry eye symptoms with questionnaires, and also measured the eyes themselves: the tear film, the surface of the eye, and how well the two eyes worked together.",
      },
      {
        type: "p",
        text: "While the reminders were running, participants took more breaks, and their eye strain and dry eye symptoms went down. One week after the reminders stopped, the improvement was gone.",
      },
      { type: "quote", sourceId: "talens-estarelles-2023" },
      {
        type: "p",
        text: "The objective measurements didn't change: not the tear film, not the eye's surface. People felt better, but their eyes didn't measurably change in two weeks.",
      },
      { type: "h2", text: "What it tells us, and what it doesn't" },
      {
        type: "p",
        text: "This is a small study with no control group, over a short period. Without a control group, some of the improvement could come from simply paying more attention to your eyes. So it's a promising early result rather than proof.",
      },
      {
        type: "p",
        text: "It doesn't show that breaks treat dry eye or improve vision, and it isn't a reason to skip an eye test. If your eyes are persistently sore or dry, or your vision has changed, see an optometrist or doctor.",
      },
      { type: "h2", text: "The part about reminders" },
      {
        type: "p",
        text: "The most interesting result for anyone trying to build a habit is the last one. Symptoms improved while reminders ran and came back once they stopped. The rule helped, in the sense that people felt better, only as long as something prompted them to follow it.",
      },
      {
        type: "p",
        text: "That matches research on sitting. A 2017 review of 17 trials looked at apps, prompting software and wearables designed to reduce sitting {cite:stephenson-2017}. On average they cut sitting by about 40 minutes a day in the short term. Beyond six months, the effect had nearly vanished.",
      },
      { type: "quote", sourceId: "stephenson-2017" },
      {
        type: "p",
        text: "Reminders work while they're working. The lesson isn't that reminders are pointless. It's that the behaviour tends to lapse without them, so a reminder you're happy to keep getting beats one you'll mute in a week.",
      },
      { type: "h2", text: "Why the numbers are 20, 20 and 20" },
      {
        type: "p",
        text: "The rule's appeal is that it's easy to remember, not that each number was worked out precisely. The 2023 study tested the rule as usually stated, so that's what we know about. Nobody has shown that 25 minutes, 15 feet or 30 seconds would be better or worse.",
      },
      {
        type: "p",
        text: "In a real office, 20 feet is roughly the far side of a room, the end of a corridor, or anything outside a window. If you can't see that far from your desk, looking as far away as you can is a sensible approximation, and a short walk gets you the distance view for free.",
      },
      { type: "h2", text: "How to use the rule" },
      {
        type: "list",
        items: [
          "Every 20 minutes or so, look at something far away: out of a window, down a corridor. Around 6 metres is enough.",
          "Hold it for about 20 seconds, and let yourself blink.",
          "Use a reminder. The study suggests the rule helps while you're prompted to follow it.",
          "Pair it with a movement break when you can. Standing up and walking away from the screen changes where you're looking anyway.",
        ],
      },
      {
        type: "p",
        text: "DeskBreak's 1-Minute Eye Break is a guided version: a look into the distance, a few slow blinks, and a moment away from the screen. It's for comfort during screen work, not a treatment for any eye condition.",
      },
      {
        type: "p",
        text: "If you try the rule, give it the same test the researchers did: notice how your eyes feel at the end of the day for a couple of weeks with reminders, then without. It's a small experiment, and yours is the result that counts for you.",
      },
    ],
  },
  {
    slug: "are-standing-desks-worth-it",
    title: "Are standing desks worth it? What trials say about sitting less at work",
    metaTitle: "Are standing desks worth it? What trials say about sitting less",
    metaDescription:
      "Trials show sit-stand desks help office workers sit about an hour a day less. Whether that improves health is unproven. Here's the evidence and how to use a standing desk well.",
    query: "do standing desks actually reduce sitting time",
    published: "2026-09-18",
    guardrail: "Desks reduce sitting by about 1 h/day. Health benefits unproven. Moving still matters.",
    sources: ["shrestha-2018", "edwardson-2022", "buckley-2015"],
    cta: {
      need: "general",
      minutes: 3,
      setup: "standing",
      body: "Built for the desk-up moments: a few minutes of leg and hip movement, using the desk for balance.",
    },
    blocks: [
      {
        type: "p",
        text: "Standing desks went from novelty to office standard in about a decade, and they're usually sold on health grounds. So what do trials actually show? The short version: standing desks reliably help people sit less. Whether that leads to better health is a separate, and much less settled, question.",
      },
      { type: "h2", text: "Do they reduce sitting? Yes" },
      {
        type: "p",
        text: "A 2018 Cochrane review looked at 34 studies of workplace interventions for sitting less, with about 3,400 participants {cite:shrestha-2018}. Sit-stand desks cut workplace sitting by around 100 minutes a day in the short term and by about an hour a day at medium-term follow-up. The authors rated the evidence as low quality, largely because the studies were small or had design limitations.",
      },
      { type: "quote", sourceId: "shrestha-2018" },
      {
        type: "p",
        text: "The review also found early, low-quality evidence for other approaches. In one study, breaks of one to two minutes every half hour reduced sitting more than two long breaks a day. In another, computer prompts plus information reduced sitting at medium-term follow-up.",
      },
      { type: "h2", text: "A bigger trial, a year long" },
      {
        type: "p",
        text: "A 2022 trial published in the BMJ gave firmer numbers {cite:edwardson-2022}. It followed 756 desk-based local government employees in the UK for twelve months, in three groups: a workplace programme to sit less plus a height-adjustable desk, the programme alone, or no change.",
      },
      {
        type: "p",
        text: "At twelve months, the group with the desk sat about an hour a day less than the control group. The programme without a desk cut about 22 minutes a day.",
      },
      { type: "quote", sourceId: "edwardson-2022" },
      {
        type: "p",
        text: "Both groups also reported small improvements in stress, wellbeing and vigour. The benefits were small and mainly psychological. That's the gap in the evidence: sitting less is clearly achievable, but these trials haven't shown a longer-term health payoff.",
      },
      { type: "h2", text: "What experts recommend" },
      {
        type: "p",
        text: "An expert statement from 2015 recommended that desk workers build up to two hours a day of standing and light activity during working hours, eventually reaching four {cite:buckley-2015}. It named several ways to get there, and a sit-stand desk is only one of them.",
      },
      { type: "quote", sourceId: "buckley-2015" },
      {
        type: "p",
        text: "The authors were clear that their recommendations rest largely on observational and short-term studies. It's expert opinion informed by evidence, not proof from long-term trials, and it isn't an official health guideline.",
      },
      { type: "h2", text: "What these trials didn't test" },
      {
        type: "p",
        text: "It's worth noticing what the trials measured: time spent sitting, plus some questionnaires about how people felt. They didn't test whether standing desks change back pain, heart health or weight over years. And the biggest results came with support around the desk: a programme, goals, prompts. A desk delivered on its own and left in the sitting position is a different thing.",
      },
      {
        type: "p",
        text: "Standing for long stretches also isn't the goal in any of these recommendations. The expert statement talks about standing and light activity, and the trials were about breaking up sitting, not replacing it with hours of standing still.",
      },
      { type: "h2", text: "So, are they worth it?" },
      {
        type: "p",
        text: "If your goal is to sit less, a standing desk is one of the best-tested ways to do it, especially with some structure around it. If your goal is a specific health outcome, the trials haven't shown that yet. Either way, how you use the desk matters.",
      },
      {
        type: "list",
        items: [
          "Use it to change position, not to stand still for hours. Standing still is still one fixed position.",
          "Alternate. Sit a while, stand a while, and move in between.",
          "Add movement. Calf raises, weight shifts and a short walk turn standing into activity.",
          "No standing desk? Short, frequent breaks also cut sitting in the Cochrane review, though that evidence is thin.",
        ],
      },
      {
        type: "p",
        text: "DeskBreak's standing reset is designed for the desk-up moments: a few minutes of leg, hip and shoulder movement, with the desk right there for balance. Raise the desk, do the reset, and decide whether to keep standing or sit back down. Either is fine, as long as the choice changes through the day.",
      },
    ],
  },
  {
    slug: "do-break-reminder-apps-work",
    title: "Do break reminder apps work? Why prompts help and then fade",
    metaTitle: "Do break reminder apps work? What the trials found",
    metaDescription:
      "Reviews found that apps and prompts helped people sit about 40 minutes a day less in the short term, fading over months. An honest look, from people who build one.",
    query: "do break reminder apps work",
    published: "2026-09-18",
    guardrail: "About 40 min/day less sitting short-term, fading over time. No lasting-habit or health claims. Waongenngarm 2021 used a purpose-built device.",
    sources: ["stephenson-2017", "shrestha-2018", "waongenngarm-2021"],
    cta: {
      need: "general",
      minutes: 3,
      body: "A break that's ready to go when the reminder comes. Three minutes, then back to work.",
    },
    blocks: [
      {
        type: "p",
        text: "We build a break reminder app, so we have an obvious interest in the answer to this one. Here's the research anyway, including the parts that aren't flattering. The short version: reminders help people move more while they're running, and the effect fades over months.",
      },
      { type: "h2", text: "The short-term effect is real" },
      {
        type: "p",
        text: "A 2017 review looked at 17 randomised trials of technology designed to reduce sitting, pooling 15 of them: apps, prompting software on computers, and wearables {cite:stephenson-2017}. On average, people using them sat about 41 minutes a day less than comparison groups. Prompts and cues, reminders in plain English, were among the most common techniques used.",
      },
      { type: "h2", text: "Then it fades" },
      {
        type: "p",
        text: "The same review split results by how long people were followed. In the short term, the reduction was about 42 minutes a day. Beyond six months, it was under two minutes.",
      },
      { type: "quote", sourceId: "stephenson-2017" },
      {
        type: "p",
        text: "There's another caveat: 16 of the 17 studies were at high or unclear risk of bias. The short-term effect is fairly consistent, but the evidence behind it isn't strong.",
      },
      { type: "h2", text: "What else the research shows" },
      {
        type: "p",
        text: "A Cochrane review of workplace interventions tells a similar story {cite:shrestha-2018}. In one study, computer prompts combined with information reduced sitting by around 55 minutes a day at medium-term follow-up. In another, short breaks every half hour reduced sitting more than two long breaks. Both were single studies, and the evidence was rated low quality.",
      },
      {
        type: "p",
        text: "The most interesting trial for reminder design wasn't about sitting time at all. In Bangkok, researchers followed 193 office workers at high risk of neck and low back pain for six months {cite:waongenngarm-2021}. One group was prompted to take active breaks, another to shift their sitting posture, and a third got no prompts. Both prompted groups reported new neck pain less often: 17% in each, compared with 44% of the control group. New low back pain showed a similar pattern.",
      },
      { type: "quote", sourceId: "waongenngarm-2021" },
      {
        type: "p",
        text: "It's one trial, using a purpose-built device rather than an app, with wide confidence intervals. It doesn't show that any app prevents neck pain, ours included. It does show that regular prompts to move, kept up for six months, changed something people reported.",
      },
      { type: "h2", text: "What a reminder can't do" },
      {
        type: "p",
        text: "A reminder can make a break more likely. It can't make the break worthwhile, fit it into a packed day, or make you want to take it. The fade in these studies probably reflects all of that: people stop responding to prompts that feel like interruptions, and eventually switch them off.",
      },
      {
        type: "p",
        text: "There's also the question of what the break is. Most trials measured sitting time, which a reminder to stand up can change. The Bangkok trial prompted active breaks and posture shifts. Nobody has tested whether a particular sequence of desk exercises, delivered by an app, changes anything over months.",
      },
      { type: "h2", text: "What this means for how reminders should work" },
      {
        type: "p",
        text: "If reminders help while they run and fade when they stop, the real design problem is keeping them running. A reminder has to earn its place every time it appears.",
      },
      {
        type: "list",
        items: [
          "Easy to act on. A prompt that opens a ready-to-go break is easier to follow than one that just says to move more.",
          "Short. Two or three minutes fits between tasks; fifteen doesn't.",
          "Varied. The same routine every time is the one you'll start skipping.",
          "Easy to adjust. A reminder that lands in the middle of a meeting is the one you'll turn off.",
        ],
      },
      { type: "h2", text: "If you use a reminder app" },
      {
        type: "list",
        items: [
          "Set the interval to something you'll actually respond to. A reminder you ignore is worse than a less frequent one you follow.",
          "Link it to your calendar or your natural stopping points if the app allows it.",
          "Change the routine now and then, so the break stays worth taking.",
          "Notice when you start dismissing it, and adjust rather than switch it off.",
        ],
      },
      {
        type: "p",
        text: "That's the approach DeskBreak takes, but we'd be overselling if we said it solves the fade. Nobody has shown that yet, including us. The best we can say is that a reminder you're still using in six months is the one with a chance to matter.",
      },
    ],
  },
];

const CITE = /\{cite:([a-z0-9,-]+)\}/g;

// Content bugs should fail the build: unknown sources, citations missing from
// a post's reference list, or a reference list entry that is never used.
for (const post of BLOG_POSTS) {
  const cited = new Set<string>();
  for (const block of post.blocks) {
    const texts = block.type === "list" ? block.items : block.type === "quote" ? [] : [block.text];
    for (const text of texts) for (const match of text.matchAll(CITE)) match[1].split(",").forEach((id) => cited.add(id));
    if (block.type === "quote") {
      cited.add(block.sourceId);
      if (!getSource(block.sourceId).quote) throw new Error(`${post.slug}: ${block.sourceId} has no verified quote`);
    }
  }
  for (const id of cited) {
    getSource(id);
    if (!post.sources.includes(id)) throw new Error(`${post.slug}: cites ${id} but does not list it in sources`);
  }
  for (const id of post.sources) {
    if (!cited.has(id)) throw new Error(`${post.slug}: lists ${id} but never cites it`);
    if (!getSource(id).verified) throw new Error(`${post.slug}: ${id} is not a verified library source`);
  }
  if ("program" in post.cta && !getProgram(post.cta.program)) throw new Error(`${post.slug}: unknown program ${post.cta.program}`);
}

export function findBlogPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((post) => post.slug === slug);
}

/** The routine a post's CTA starts, by the name the workout screen shows. */
export function blogCtaRoutine(cta: BlogCta): string {
  if ("program" in cta) return getProgram(cta.program)?.name ?? "reset";
  return startRoutineName(cta.need, cta.minutes, cta.setup);
}

/** Words in a post, for reading time. */
export function blogWordCount(post: BlogPost): number {
  const text = post.blocks
    .map((block) => (block.type === "list" ? block.items.join(" ") : block.type === "quote" ? getSource(block.sourceId).quote ?? "" : block.text))
    .join(" ")
    .replace(CITE, "");
  return text.split(/\s+/).filter(Boolean).length;
}
