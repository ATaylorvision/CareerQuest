import { api } from "./api";
import { requireSupabase } from "./supabase";
import { rowToJob, type JobRow, type MatchRow } from "./mapJob";
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
  note?: string;
}

/** Loads the signed in user's matches, joined with the shared listings, as app Job objects. */
export async function loadJobs(): Promise<Job[]> {
  const { data, error } = await requireSupabase()
    .from("job_matches")
    .select("score, breakdown, why, gaps, career_changer_friendly, dismissed, translator, jobs(*)")
    .order("score", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data ?? [])
    .filter((r) => r.jobs)
    .map((r) => rowToJob(r.jobs as unknown as JobRow, r as unknown as MatchRow));
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
  if (found.total === 0) {
    onProgress({ stage: "done", message: found.note ?? "No listings came back." });
    return found;
  }

  const counts = { found: found.total, verified: found.verified, agencies: found.agencies, ghostRisk: found.ghostRisk };
  onProgress({ stage: "score", message: "Scoring each one against your resume", ...counts, scored: 0 });
  let scored = 0;
  await Promise.all(
    chunk(found.ids, 8).map(async (ids) => {
      await api("jobs/match", { ids, mode: "score" });
      scored += ids.length;
      onProgress({ stage: "score", message: `Scored ${scored} of ${found.total}`, ...counts, scored });
    }),
  );

  let jobs = await loadJobs();
  onJobs(jobs);

  onProgress({ stage: "detail", message: "Translating your experience for the best matches", ...counts, scored });
  const top = jobs.filter((j) => found.ids.includes(j.id)).slice(0, enrichTop);
  await Promise.all(top.map((j) => api("jobs/match", { ids: [j.id], mode: "detail" }).catch(() => null)));

  jobs = await loadJobs();
  onJobs(jobs);
  onProgress({ stage: "done", message: "Done", ...counts, scored });
  return found;
}

/** Runs the full analysis for one job (used when a job is opened before it was analyzed). */
export async function enrichJob(id: string): Promise<Job | null> {
  await api("jobs/match", { ids: [id], mode: "detail" });
  const { data } = await requireSupabase()
    .from("job_matches")
    .select("score, breakdown, why, gaps, career_changer_friendly, dismissed, translator, jobs(*)")
    .eq("job_id", id)
    .maybeSingle();
  if (!data?.jobs) return null;
  return rowToJob(data.jobs as unknown as JobRow, data as unknown as MatchRow);
}
