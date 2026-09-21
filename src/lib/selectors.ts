import type { AppState } from "@/store/AppStore";
import { JOBS, jobById, type Job } from "@/data/jobs";
import { visibleFor } from "@/lib/matchRules";
import { GAPS, type Gap } from "@/data/gaps";
import type { Application } from "@/data/applications";
import { NORTHVALE_CHANGES, type TailorChange } from "@/data/resumeStudio";

export const isPro = (s: AppState) => s.billing.tier === "trial" || s.billing.tier === "pro";

export const FREE_LIMITS = { tailoredResumes: 3, coverLetters: 3 };

export function proofScore(apps: Application[]) {
  const submitted = apps.filter((a) => a.receipt && (a.receipt.submittedAt || a.receipt.method !== "manual"));
  const verified = submitted.filter((a) => a.receipt!.confirmation.verified);
  const byMethod = {
    submitted: submitted.filter((a) => a.receipt!.method === "submitted").length,
    prefilled: submitted.filter((a) => a.receipt!.method === "prefilled").length,
    manual: apps.filter((a) => a.receipt?.method === "manual").length,
  };
  const pct = submitted.length ? Math.round((verified.length / submitted.length) * 100) : 0;
  return { pct, verified: verified.length, total: submitted.length, byMethod, unverified: submitted.filter((a) => !a.receipt!.confirmation.verified) };
}

/** Jobs the user has shown interest in: anything in the tracker that is still open. */
export function trackedJobs(s: AppState): Job[] {
  const ids = new Set(s.applications.filter((a) => a.column !== "rejected" && a.column !== "withdrawn").map((a) => a.jobId));
  return JOBS.filter((j) => ids.has(j.id));
}

/** Saved jobs for the roadmap: everything in the tracker that is still open. */
/** How many top matches stand in for the tracker before anything is saved. */
const ROADMAP_FALLBACK = 10;

/**
 * Jobs the roadmap reads gaps from. The tracker is the honest answer once
 * someone has saved anything. Before that, waiting for saves left the page
 * empty exactly when it was most useful, so the strongest current matches
 * stand in. `fromTracker` lets the page say which it is showing.
 */
export function roadmapJobs(s: AppState): { jobs: Job[]; fromTracker: boolean } {
  const tracked = trackedJobs(s);
  if (tracked.length) return { jobs: tracked, fromTracker: true };
  const top = visibleJobs(s)
    .filter((j) => j.gaps.length > 0)
    .sort((a, b) => b.match - a.match)
    .slice(0, ROADMAP_FALLBACK);
  return { jobs: top, fromTracker: false };
}

export function gapAggregate(s: AppState) {
  const { jobs, fromTracker } = roadmapJobs(s);
  const counts = new Map<string, { gap: Gap; jobs: Job[] }>();
  jobs.forEach((j) =>
    j.gaps.forEach((g) => {
      // A gap from the live pipeline carries its own resources. One that matches
      // the built in library is upgraded to the fuller version.
      const e = counts.get(g.id) ?? { gap: GAPS[g.id] ?? g, jobs: [] };
      e.jobs.push(j);
      counts.set(g.id, e);
    }),
  );
  return { total: jobs.length, fromTracker, items: Array.from(counts.values()).sort((a, b) => b.jobs.length - a.jobs.length) };
}

export function streakOf(s: AppState) {
  if (s.streakBrokenDemo) return { current: 0, best: 14, broken: true };
  let n = 0;
  for (const d of s.activity) {
    if (d) n++;
    else break;
  }
  let best = 0;
  let run = 0;
  for (const d of s.activity) {
    run = d ? run + 1 : 0;
    best = Math.max(best, run);
  }
  const live = s.mode === "live";
  return { current: n, best: live ? Math.max(best, n) : Math.max(14, n), broken: n === 0 && (!live || s.activity.some(Boolean)) };
}

export function appForJob(s: AppState, jobId: string) {
  return s.applications.find((a) => a.jobId === jobId);
}

export function visibleJobs(s: AppState) {
  return visibleFor(s);
}

/* ---------------- Studio ---------------- */

const SUMMARY_BY_TARGET: Record<string, string> = {
  supply: "Operations manager with eight years running multi site retail operations, focused on inventory control, vendor coordination, and process improvement. Lean Six Sigma Yellow Belt.",
  program: "Operations leader with eight years running multi site retail operations, including system rollouts, a full store remodel, and weekly reporting to leadership.",
  cs: "Operations manager with eight years in customer facing retail leadership, known for strong satisfaction scores, clear communication, and resolving escalations.",
  health: "Operations manager with eight years running multi site retail teams, with a focus on scheduling, budgets, and consistent service standards.",
  project: "Operations manager with eight years coordinating vendors, schedules, and teams across six retail locations, including a full store remodel delivered on time.",
};

const TOP_BULLET_BY_TARGET: Record<string, { id: string; why: string }> = {
  supply: { id: "r2", why: "inventory and replenishment" },
  program: { id: "r5", why: "rolling out new processes" },
  cs: { id: "r3", why: "managing relationships and escalations" },
  health: { id: "r4", why: "staff supervision" },
  project: { id: "r3", why: "vendor coordination" },
};

/** Changes for any job. Northvale has hand written changes; other roles get reorder and summary changes only. */
export function changesForJob(job: Job): TailorChange[] {
  if (job.id === "j01") return NORTHVALE_CHANGES;
  const base = NORTHVALE_CHANGES;
  const top = TOP_BULLET_BY_TARGET[job.target];
  const topChange = base.find((c) => c.sourceId === top.id);
  const req1 = job.requirements[0]?.toLowerCase() ?? "";
  const out: TailorChange[] = [
    {
      ...base[0],
      id: `${job.id}-c1`,
      tailored: SUMMARY_BY_TARGET[job.target],
      reason: `Rewrote the summary to lead with what ${job.company.name} asks for first: \"${req1}\". Every claim comes from your existing bullets.`,
    },
  ];
  if (topChange) {
    out.push({
      ...topChange,
      id: `${job.id}-c2`,
      type: "reorder",
      tailored: topChange.original,
      reason: `Moved to the top of your regional role because this posting leans on ${top.why}. Wording unchanged.`,
      ats: { keywords: 3 },
    });
  }
  base.slice(2).forEach((c, i) => {
    if (c.sourceId === top.id) return;
    if (i > 4) return;
    out.push({ ...c, id: `${job.id}-${c.id}`, reason: c.reason.replace(/this posting|this job|this role/gi, `the ${job.title} posting`) });
  });
  return out;
}

export function jobOrThrow(id: string) {
  return jobById(id) ?? JOBS[0];
}
