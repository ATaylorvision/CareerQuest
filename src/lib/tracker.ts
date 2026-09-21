import type { Application, Column, EventType, TimelineEvent } from "../data/applications";

/**
 * What the Tracker's numbers mean, in one place.
 *
 * Every figure comes from the applications themselves. Nothing is estimated and
 * nothing is compared with other people, so the only question is whether the
 * definitions are ones a person would agree with. They are written down here so
 * they can be tested.
 */

/** How far an application got. Higher is further. */
export type Stage = 0 | 1 | 2 | 3 | 4;
export const STAGE = { none: 0, applied: 1, answered: 2, interviewed: 3, offered: 4 } as const;

const ANSWERED: EventType[] = ["screen", "interview", "offer", "rejected"];

/** Events that have actually happened. A planned interview is not one yet. */
const happened = (a: Application) => a.events.filter((e) => !e.future);

/**
 * The furthest an application ever got, whatever column it sits in now. A
 * rejection after an interview still counts as an interview, which is what
 * makes the funnel add up.
 */
export function stageReached(a: Application): Stage {
  const ev = new Set(happened(a).map((e) => e.type));
  if (a.column === "offer" || ev.has("offer")) return STAGE.offered;
  if (a.column === "interview" || ev.has("interview")) return STAGE.interviewed;
  if (a.column === "screening" || a.column === "rejected" || ANSWERED.some((t) => ev.has(t))) return STAGE.answered;
  const applied = !!a.receipt?.submittedAt || a.column === "applied";
  return applied ? STAGE.applied : STAGE.none;
}

export interface Nudge {
  id: string;
  jobId: string;
  /** Days since it was sent. */
  days: number;
}

export interface TrackerStats {
  /** Everything on the board. */
  total: number;
  /** Saved and not sent. */
  saved: number;
  /** Sent, wherever it stands now. */
  applied: number;
  /** Got any answer at all, including a no. */
  answered: number;
  interviews: number;
  offers: number;
  /** Sitting in Rejected right now. */
  rejected: number;
  withdrawn: number;
  /** Sent and still waiting to hear. */
  waiting: number;
  /** Still in play: sent, and not rejected or withdrawn. */
  inPlay: number;
  /** Share of sent applications that got any answer. Null until something is sent. */
  answerRate: number | null;
  interviewRate: number | null;
  offerRate: number | null;
  /** Sent 14 or more days ago with no answer. Oldest first. */
  nudges: Nudge[];
  /** Applied, heard back, interviewed, offered, each with its share of the step before. */
  funnel: { key: string; label: string; n: number; ofPrevious: number | null }[];
}

/**
 * Older saved state used one "closed" column for every ending. It is sorted into
 * the two that replaced it by what actually happened: a logged rejection is a
 * rejection, and anything else was a withdrawal or silence.
 */
export function normalizeApplications(apps: Application[]): Application[] {
  return apps.map((a) => {
    if ((a.column as string) !== "closed") return a;
    const rejected = a.events.some((e) => e.type === "rejected" && !e.future);
    return { ...a, column: rejected ? "rejected" : "withdrawn" };
  });
}

const DAY = 86_400_000;
export const NUDGE_AFTER_DAYS = 14;

const pct = (n: number, of: number) => (of > 0 ? Math.round((n / of) * 100) : null);

/** When it was sent, from the receipt, or failing that the first submission event. */
function sentAt(a: Application): number | null {
  const t = a.receipt?.submittedAt ?? happened(a).find((e) => e.type === "submitted")?.at ?? null;
  const ms = t ? new Date(t).getTime() : NaN;
  return Number.isFinite(ms) ? ms : null;
}

export function trackerStats(apps: Application[], now: number = Date.now()): TrackerStats {
  const reached = apps.map(stageReached);
  const count = (min: Stage) => reached.filter((r) => r >= min).length;

  const applied = count(STAGE.applied);
  const answered = count(STAGE.answered);
  const interviews = count(STAGE.interviewed);
  const offers = count(STAGE.offered);

  const waitingApps = apps.filter((a) => a.column === "applied");
  const nudges: Nudge[] = waitingApps
    .map((a) => ({ a, at: sentAt(a) }))
    .filter((x): x is { a: Application; at: number } => x.at !== null && now - x.at >= NUDGE_AFTER_DAYS * DAY)
    .map((x) => ({ id: x.a.id, jobId: x.a.jobId, days: Math.floor((now - x.at) / DAY) }))
    .sort((a, b) => b.days - a.days);

  return {
    total: apps.length,
    saved: apps.filter((a) => a.column === "saved").length,
    applied,
    answered,
    interviews,
    offers,
    rejected: apps.filter((a) => a.column === "rejected").length,
    withdrawn: apps.filter((a) => a.column === "withdrawn").length,
    waiting: waitingApps.length,
    inPlay: apps.filter((a, i) => reached[i] >= STAGE.applied && a.column !== "rejected" && a.column !== "withdrawn").length,
    answerRate: pct(answered, applied),
    interviewRate: pct(interviews, applied),
    offerRate: pct(offers, applied),
    nudges,
    funnel: [
      { key: "applied", label: "Applied", n: applied, ofPrevious: null },
      { key: "answered", label: "Heard back", n: answered, ofPrevious: pct(answered, applied) },
      { key: "interviewed", label: "Interviewed", n: interviews, ofPrevious: pct(interviews, answered) },
      { key: "offered", label: "Offers", n: offers, ofPrevious: pct(offers, interviews) },
    ],
  };
}

/** What someone tells us when they add a job they have already acted on. */
export interface ImportedApplication {
  id: string;
  jobId: string;
  /** Where it stands today. */
  stage: Column;
  /** When they applied. Ignored while the stage is still "saved". */
  appliedOn: Date;
  now?: Date;
}

/**
 * The tracker entry for a job the person added themselves.
 *
 * Everything on it is what they told us, and it says so. There is no
 * confirmation and never a "verified" mark, because CareerQuest did not send it
 * and cannot vouch for it. The receipt carries no resume or letter for the same
 * reason: we did not see what they sent.
 */
export function applicationFromImport(o: ImportedApplication): Application {
  const now = o.now ?? new Date();
  const at = now.toISOString();
  const events: TimelineEvent[] = [{ id: `${o.id}-e0`, type: "saved", at }];
  const add = (type: EventType, when: string, note: string) => events.push({ id: `${o.id}-e${events.length}`, type, at: when, note });

  if (o.stage === "saved") {
    return { id: o.id, jobId: o.jobId, column: "saved", savedAt: at, events, nextStep: "Tailor your resume, then apply." };
  }

  const appliedAt = o.appliedOn.toISOString();
  add("submitted", appliedAt, "Added by you. You applied outside CareerQuest.");
  if (o.stage === "screening") add("screen", at, "You told us a recruiter has been in touch.");
  if (o.stage === "interview") add("interview", at, "You told us you are interviewing.");
  if (o.stage === "offer") add("offer", at, "You told us you have an offer.");
  if (o.stage === "rejected") add("rejected", at, "You told us they said no.");
  if (o.stage === "withdrawn") add("noresponse", at, "You told us you withdrew, or they never replied.");

  return {
    id: o.id,
    jobId: o.jobId,
    column: o.stage,
    savedAt: at,
    events,
    receipt: {
      method: "manual",
      destination: "company",
      destinationLabel: "Applied outside CareerQuest",
      submittedAt: appliedAt,
      resumeVersionId: "",
      coverLetter: "",
      fields: [],
      confirmation: { verified: false },
    },
    nextStep: o.stage === "applied" ? "Most employers respond within 7 to 10 business days." : undefined,
  };
}
