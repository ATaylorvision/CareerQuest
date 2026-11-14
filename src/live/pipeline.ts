import { api } from "./api";
import { requireSupabase } from "./supabase";
import { NO_MATCH, rowToJob, type JobRow, type MatchRow } from "./mapJob";
import type { Job } from "@/data/jobs";

export type Stage = "search" | "score" | "detail" | "done";

export interface Progress {
  stage: Stage;
  message: string;
  found?: number;
  verified?: number;
  agencies?: number;
  ghostRisk?: number;
  scored?: number;
}

interface SearchResult {
  ids: string[];
  total: number;
  verified: number;
  agencies: number;
  ghostRisk: number;
  /** Listings we found and then dropped for sitting outside the commute radius. */
  outOfRange?: number;
  note?: string;
  sourceErrors?: string[];
  /** True when staff have switched LinkedIn search on, so a second search should run beside this one. */
  linkedin?: boolean;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Gives up on a call that is taking too long, so one stuck request cannot hold up the whole page. */
const within = <T,>(p: Promise<T>, ms: number): Promise<T | null> => Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))]);

/**
 * LinkedIn is a two step job: start the scraper, then come back for what it found. The
 * scraper takes a while, so it is started first and collected last, and scoring the
 * other results happens while it works. Neither step ever throws: if LinkedIn is slow,
 * off, or out of its daily allowance, the person simply keeps the results they have.
 */
async function startLinkedIn(): Promise<string | null> {
  try {
    const started = await api<{ started: boolean; runId?: string }>("jobs/search", { action: "linkedinStart" });
    return started.started && started.runId ? started.runId : null;
  } catch {
    return null;
  }
}

async function collectLinkedIn(runId: string | null): Promise<string[]> {
  if (!runId) return [];
  try {
    for (let i = 0; i < 25; i++) {
      const r = await api<{ status?: string; ids?: string[] }>("jobs/search", { action: "linkedinPoll", runId });
      if (r.status !== "running") return r.ids ?? [];
      await sleep(4000);
    }
  } catch {
    /* a bonus, never a reason for the search to fail */
  }
  return [];
}

/** Loads the signed in user's matches, joined with the shared listings, as app Job objects. */
export async function loadJobs(): Promise<Job[]> {
  const { data, error } = await requireSupabase()
    .from("job_matches")
    .select("score, breakdown, why, gaps, career_changer_friendly, dismissed, translator, first_shown_at, distance_miles, kept, jobs(*)")
    .order("first_shown_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data ?? [])
    .filter((r) => r.jobs)
    .map((r) => rowToJob(r.jobs as unknown as JobRow, r as unknown as MatchRow));
}

/**
 * Every listing in the shared cache that has no score for this person yet. This is what lets someone browse
 * the whole board and find jobs we did not think to call a match. Their own imported jobs are never in it.
 */
export async function loadMoreJobs(exclude: Set<string>): Promise<Job[]> {
  const { data, error } = await requireSupabase().from("jobs").select("*").is("owner_id", null).order("first_seen_at", { ascending: false }).limit(600);
  if (error) throw new Error(error.message);
  return (data ?? []).filter((r) => !exclude.has(r.id as string)).map((r) => rowToJob(r as unknown as JobRow, NO_MATCH, true));
}

const chunk = <T,>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

/**
 * Finds real listings, scores every one against the user's resume, then runs the full
 * analysis on the best few. Calls onProgress as it goes and onJobs each time the list improves.
 */
export async function runPipeline(opts: { onProgress: (p: Progress) => void; onJobs: (jobs: Job[]) => void; enrichTop?: number }): Promise<SearchResult> {
  const { onProgress, onJobs, enrichTop = 4 } = opts;

  onProgress({ stage: "search", message: "Searching live listings and checking each company's own careers page" });
  const found = await api<SearchResult>("jobs/search");
  onProgress({ stage: "search", message: `Found ${found.total} real listings`, found: found.total, verified: found.verified, agencies: found.agencies, ghostRisk: found.ghostRisk });
  if (found.total === 0 && !found.linkedin) {
    onProgress({ stage: "done", message: found.note ?? "No listings came back." });
    return found;
  }

  const counts = { found: found.total, verified: found.verified, agencies: found.agencies, ghostRisk: found.ghostRisk };
  // Started now so it works while the first results are being scored.
  const linkedinRun = found.linkedin ? startLinkedIn() : Promise.resolve(null);
  onProgress({ stage: "score", message: "Scoring each one against your resume", ...counts, scored: 0 });
  let scored = 0;
  await Promise.all(
    chunk(found.ids, 8).map(async (ids) => {
      await within(api("jobs/match", { ids, mode: "score" }).catch(() => null), 75_000);
      scored += ids.length;
      onProgress({ stage: "score", message: `Scored ${scored} of ${found.total}`, ...counts, scored });
    }),
  );

  let jobs = await loadJobs();
  // If scoring failed, still show what was found, unscored, so the person is never left with an empty page.
  if (found.ids.length && !jobs.some((j) => found.ids.includes(j.id))) {
    const { data } = await requireSupabase().from("jobs").select("*").in("id", found.ids);
    jobs = [...(data ?? []).map((r) => rowToJob(r as unknown as JobRow, NO_MATCH, true)), ...jobs];
  }
  onJobs(jobs);

  // LinkedIn runs after the first results are already on screen, so nobody waits on it.
  let fromLinkedIn: string[] = [];
  if (found.linkedin) {
    onProgress({ stage: "search", message: "Also checking LinkedIn", ...counts, scored });
    fromLinkedIn = await collectLinkedIn(await linkedinRun);
    if (fromLinkedIn.length) {
      onProgress({ stage: "score", message: `Scoring ${fromLinkedIn.length} more from LinkedIn`, ...counts, scored });
      await Promise.all(chunk(fromLinkedIn, 8).map((ids) => within(api("jobs/match", { ids, mode: "score" }).catch(() => null), 75_000)));
      jobs = await loadJobs();
      onJobs(jobs);
    }
  }

  onProgress({ stage: "detail", message: "Translating your experience for the best matches", ...counts, scored });
  const seenIds = [...found.ids, ...fromLinkedIn];
  const top = jobs.filter((j) => seenIds.includes(j.id)).slice(0, enrichTop);
  await Promise.all(top.map((j) => api("jobs/match", { ids: [j.id], mode: "detail" }).catch(() => null)));

  jobs = await loadJobs();
  onJobs(jobs);
  onProgress({ stage: "done", message: "Done", ...counts, scored });
  return { ...found, total: found.total + fromLinkedIn.length };
}

/** Runs the full analysis for one job (used when a job is opened before it was analyzed). */
export async function enrichJob(id: string): Promise<Job | null> {
  await api("jobs/match", { ids: [id], mode: "detail" });
  const { data } = await requireSupabase()
    .from("job_matches")
    .select("score, breakdown, why, gaps, career_changer_friendly, dismissed, translator, first_shown_at, distance_miles, kept, jobs(*)")
    .eq("job_id", id)
    .maybeSingle();
  if (!data?.jobs) return null;
  return rowToJob(data.jobs as unknown as JobRow, data as unknown as MatchRow);
}
