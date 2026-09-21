import { supabase } from "./supabase";
import type { Application } from "@/data/applications";

/**
 * Writes the working state out to its own tables.
 *
 * The app keeps a fast copy of everything in `user_state`, which is what the
 * screens read. That blob is invisible to anything else though, so the records
 * that matter, applications and their timeline, are also written as real rows.
 * That is what makes them durable, queryable, and visible in the admin portal.
 *
 * These never throw. A failed sync must not lose the user's work, so the local
 * copy stays and the error is logged.
 */

async function uid(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

const STATUS: Record<string, string> = {
  saved: "saved",
  applied: "applied",
  screening: "screening",
  interview: "interview",
  offer: "offer",
  rejected: "rejected",
  withdrawn: "withdrawn",
};

/** Upserts one application and replaces its timeline. */
export async function saveApplication(app: Application): Promise<void> {
  if (!supabase) return;
  try {
    const user_id = await uid();
    if (!user_id) return;
    const r = app.receipt;

    const { data: row, error } = await supabase
      .from("applications")
      .upsert(
        {
          user_id,
          job_id: app.jobId,
          status: STATUS[app.column] ?? "saved",
          method: r?.method ?? null,
          destination: r?.destination ?? null,
          destination_label: r?.destinationLabel ?? null,
          submitted_at: r?.submittedAt ?? null,
          cover_letter: r?.coverLetter ?? null,
          fields: r?.fields ?? null,
          confirmation: r?.confirmation ?? { verified: false },
          next_step: app.nextStep ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,job_id" },
      )
      .select("id")
      .single();

    if (error || !row) {
      console.error("Could not save that application:", error?.message);
      return;
    }

    // The timeline is small and fully derived, so replacing it is simpler and
    // safer than trying to diff events that have no stable server id.
    await supabase.from("application_events").delete().eq("application_id", row.id);
    if (app.events.length) {
      await supabase.from("application_events").insert(
        app.events.map((e) => ({
          application_id: row.id,
          user_id,
          type: e.type,
          note: e.note ?? null,
          occurred_at: e.at,
          is_future: !!e.future,
        })),
      );
    }
  } catch (e) {
    console.error("Could not save that application:", e);
  }
}

/** Keeps the stored status in step when a card moves in the tracker. */
export async function saveApplicationStatus(jobId: string, column: string): Promise<void> {
  if (!supabase) return;
  try {
    const user_id = await uid();
    if (!user_id) return;
    await supabase
      .from("applications")
      .update({ status: STATUS[column] ?? "saved", updated_at: new Date().toISOString() })
      .eq("user_id", user_id)
      .eq("job_id", jobId);
  } catch (e) {
    console.error("Could not update that application:", e);
  }
}

/** Takes an application out of the database when the person removes its card. */
export async function removeApplication(jobId: string): Promise<void> {
  if (!supabase) return;
  try {
    const user_id = await uid();
    if (!user_id) return;
    // The timeline goes with it, by the database's own cascade.
    await supabase.from("applications").delete().eq("user_id", user_id).eq("job_id", jobId);
  } catch (e) {
    console.error("Could not remove that application:", e);
  }
}
