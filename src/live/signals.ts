import type { Job } from "@/data/jobs";
import { supabase } from "./supabase";

export type SignalKind = "open" | "save" | "apply" | "dismiss" | "checkfit";

const opened = new Set<string>();

/**
 * Notes what someone does with a listing. When they open, save or apply to something we did not call a match,
 * they are telling us what they actually want, and the next scoring reads that. Private to the person.
 */
export async function recordSignal(job: Job, kind: SignalKind): Promise<void> {
  if (!supabase || !job.live || job.imported) return;
  if (kind === "open") {
    if (opened.has(job.id)) return;
    opened.add(job.id);
  }
  try {
    const uid = (await supabase.auth.getUser()).data.user?.id;
    if (!uid) return;
    await supabase.from("match_signals").insert({ user_id: uid, job_id: job.id, kind, was_match: !job.unscored && job.match >= 60, score_then: job.unscored ? null : job.match });
  } catch {
    /* learning is a bonus and must never get in the way */
  }
}
