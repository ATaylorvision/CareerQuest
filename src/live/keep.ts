import { JOBS } from "@/data/jobs";
import type { AppState } from "@/store/AppStore";
import { contextFor, splitMatches } from "@/lib/matchRules";
import { supabase } from "./supabase";

const saving = new Set<string>();

/**
 * Marks every listing that now passes the match rules as shown to this person,
 * so it stays in their matches for good. Safe to call as often as you like.
 */
export async function keepShown(state: AppState): Promise<void> {
  if (state.mode !== "live" || !supabase) return;
  const fresh = JOBS.filter((j) => j.live && !j.imported && !j.kept && !saving.has(j.id));
  if (!fresh.length) return;
  const ids = splitMatches(fresh, contextFor(state)).shown.map((j) => j.id);
  if (!ids.length) return;
  ids.forEach((id) => saving.add(id));
  const set = new Set(ids);
  for (const j of JOBS) if (set.has(j.id)) j.kept = true;
  const { error } = await supabase.from("job_matches").update({ kept: true }).in("job_id", ids);
  if (error) ids.forEach((id) => saving.delete(id));
}
