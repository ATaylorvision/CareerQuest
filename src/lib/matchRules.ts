import type { Job } from "@/data/jobs";
import { JOBS } from "@/data/jobs";
import type { AppState } from "@/store/AppStore";

/**
 * What decides whether a listing appears on the Matches page.
 *
 * All of this runs quietly. The person sees jobs that fit them, and is never
 * asked to tune filters for legitimacy, freshness or distance. The only thing
 * they can choose is whether to also see weaker matches.
 */

/** Below this a listing is a weak match, and is held back unless the person asks to see those too. */
export const MIN_SCORE = 60;
/** Older than this and a listing is probably filled, so it is not shown. */
export const MAX_AGE_DAYS = 30;
/** The commute slider tops out here, meaning distance is not a limit. */
const ANY_DISTANCE = 100;

export type Exclusion = "applied" | "dismissed" | "not-real" | "old" | "far" | "remote" | "pay" | "dealbreaker" | "required" | "weak";

interface Context {
  applied: Set<string>;
  dismissed: Set<string>;
  legitThreshold: number;
  floor: number;
  maxMiles: number;
  remote: AppState["prefs"]["remote"];
  wantsRemote: boolean;
  places: string[];
  dealbreakers: string[];
}

export function contextFor(s: Pick<AppState, "applications" | "dismissedJobIds" | "legitThreshold" | "prefs" | "profile">): Context {
  return {
    // A job you have applied to is done with. Saving one for later does not count.
    applied: new Set(s.applications.filter((a) => a.receipt?.submittedAt || a.column !== "saved").map((a) => a.jobId)),
    dismissed: new Set(s.dismissedJobIds),
    legitThreshold: s.legitThreshold,
    floor: s.prefs.salaryFloor,
    maxMiles: s.prefs.maxDistanceMiles,
    remote: s.prefs.remote,
    wantsRemote: s.prefs.remote === "remote" || s.prefs.remote === "any" || s.prefs.locations.some((l) => /^remote/i.test(l)),
    places: [s.profile.location, ...s.prefs.locations].filter((l) => l && !/^remote/i.test(l)),
    dealbreakers: s.prefs.dealbreakers,
  };
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

/** "Commission only pay" becomes "commission only", so the test is on the thing that matters. */
const TAIL = new Set(["pay", "shifts", "shift", "work", "jobs", "job", "roles", "role", "hours", "positions", "position"]);
export function dealbreakerPhrase(d: string): string {
  const words = norm(d).split(" ").filter(Boolean);
  while (words.length > 1 && TAIL.has(words[words.length - 1])) words.pop();
  return words.join(" ");
}

/** Does the listing name one of the places the person works? Only used when there are no coordinates. */
function namesPlace(location: string, places: string[]): boolean {
  const l = norm(location);
  if (!l) return false;
  const jobState = location.match(/,\s*([A-Za-z]{2})\s*$/)?.[1]?.toLowerCase();
  return places.some((p) => {
    const [cityRaw, stateRaw] = p.split(",").map((x) => x.trim());
    const city = norm(cityRaw ?? "");
    const st = (stateRaw ?? "").match(/^[A-Za-z]{2}\b/)?.[0]?.toLowerCase();
    if (city.length < 3 || !l.includes(city)) return false;
    // When both sides name a state they have to be the same one, so Austin, TX is not Austin, MN.
    return !st || !jobState || st === jobState;
  });
}

export function whyExcluded(job: Job, c: Context): Exclusion | null {
  if (c.applied.has(job.id)) return "applied";
  if (c.dismissed.has(job.id)) return "dismissed";
  if (job.legit.score < c.legitThreshold || job.legit.badge === "ghost") return "not-real";
  if (job.postedDaysAgo > MAX_AGE_DAYS) return "old";

  // Where. A listing that does not say is treated as onsite, because that is what it is until it says otherwise.
  const remote = job.mode === "Remote";
  if (remote) {
    if (!c.wantsRemote) return "remote";
  } else {
    if (c.remote === "remote") return "remote";
    if (c.maxMiles < ANY_DISTANCE) {
      if (job.distanceMiles != null) {
        if (job.distanceMiles > c.maxMiles) return "far";
      } else if (!namesPlace(job.location, c.places)) {
        return "far";
      }
    }
  }

  // Pay. A listing that does not say what it pays stays, and is marked as unlisted.
  if (job.salary && job.salary[1] < c.floor) return "pay";

  const text = norm(`${job.title} ${job.descriptionText ?? job.summary}`);
  for (const d of c.dealbreakers) {
    const phrase = dealbreakerPhrase(d);
    if (phrase.length >= 4 && text.includes(phrase)) return "dealbreaker";
  }

  // A requirement the analysis found we cannot meet is a reason not to show it, not a reason to show it low.
  if (job.gaps.some((g) => g.severity === "dealbreaker")) return "required";

  if (job.match < MIN_SCORE) return "weak";
  return null;
}

export interface Split {
  shown: Job[];
  weaker: Job[];
  /** How many were left out, by reason. */
  left: Partial<Record<Exclusion, number>>;
}

/** Newest to the person first, which is when it was first shown to them and not when the employer posted it. */
export const byShown = (a: Job, b: Job) => (b.shownAt ?? "").localeCompare(a.shownAt ?? "") || b.match - a.match;

export function splitMatches(jobs: Job[], c: Context): Split {
  const out: Split = { shown: [], weaker: [], left: {} };
  for (const j of jobs) {
    if (j.imported) continue;
    const why = whyExcluded(j, c);
    if (why === null) out.shown.push(j);
    else if (why === "weak") out.weaker.push(j);
    else out.left[why] = (out.left[why] ?? 0) + 1;
  }
  return out;
}

/**
 * What the person is shown as their matches, best placed first. The sample account keeps the simple
 * rules, because its listings are examples and not a search result.
 */
export function visibleFor(s: AppState): Job[] {
  if (s.mode === "live") return splitMatches(JOBS, contextFor(s)).shown.sort(byShown);
  const applied = new Set(s.applications.filter((a) => a.receipt?.submittedAt || a.column !== "saved").map((a) => a.jobId));
  return JOBS.filter((j) => !j.imported && !s.dismissedJobIds.includes(j.id) && !applied.has(j.id) && j.legit.score >= s.legitThreshold);
}
