import type { VercelRequest } from "@vercel/node";
import { HttpError, admin, requireUser, type AuthedUser } from "./http.js";

/**
 * Staff accounts. Two ways in, and both are checked on the server only:
 *   1. The email is listed in ADMIN_EMAILS (comma separated). This is the
 *      bootstrap, so the first admin exists before anyone can grant it.
 *   2. profiles.is_admin is true, which only this file ever writes.
 * The browser is never trusted for any part of this.
 */
function allowlist(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export interface AdminUser extends AuthedUser {
  /** True when the account is an admin because of ADMIN_EMAILS, not the database. */
  viaEnv: boolean;
}

/** Throws unless the caller is signed in and an admin. */
export async function requireAdmin(req: VercelRequest): Promise<AdminUser> {
  const user = await requireUser(req);
  const email = (user.email ?? "").toLowerCase();
  const listed = !!email && allowlist().includes(email);

  // An address on the allowlist only counts once its owner has confirmed it.
  // Without this, anyone who signed up claiming a staff address would be let in
  // before proving the address is theirs.
  const viaEnv = listed && user.emailConfirmed;

  const db = admin();
  const { data } = await db.from("profiles").select("is_admin").eq("id", user.id).maybeSingle<{ is_admin: boolean }>();

  if (!viaEnv && !data?.is_admin) {
    // Say plainly when the only thing missing is the confirmation, so a staff
    // member is never left guessing why their own allowlisted address bounced.
    if (listed) throw new HttpError(403, "This address is on the staff list, but it has not been confirmed yet. Confirm your email address, then open this page again.");
    throw new HttpError(403, "This area is for CareerQuest staff.");
  }

  // Someone listed in ADMIN_EMAILS gets the database flag too, so the rest of
  // the app can see it without reading environment variables.
  if (viaEnv && !data?.is_admin) await db.from("profiles").update({ is_admin: true }).eq("id", user.id);

  return { ...user, viaEnv };
}

/** Records an action that changed or removed data. Never throws: the log must not break the action. */
export async function logAction(actor: AdminUser, action: string, target: { id?: string; label?: string; detail?: unknown } = {}): Promise<void> {
  try {
    await admin().from("admin_actions").insert({
      actor_id: actor.id,
      actor_email: actor.email,
      action,
      target_id: target.id ?? null,
      target_label: target.label ?? null,
      detail: (target.detail ?? null) as never,
    });
  } catch (e) {
    console.error("[admin log]", e);
  }
}
