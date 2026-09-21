import { HttpError, admin, body, route } from "./_lib/http.js";
import { logAction, requireAdmin, type AdminUser } from "./_lib/admin.js";

/**
 * The whole admin panel is this one endpoint, switched on `action`.
 * Everything here runs with the service role, so the caller is checked
 * first, on every single call, by requireAdmin.
 */

const PAGE = 25;
const dayKey = (d: string | Date) => new Date(d).toLocaleDateString("en-CA");

interface Payload {
  action?: string;
  q?: string;
  page?: number;
  userId?: string;
  tier?: string;
  value?: boolean;
  confirm?: string;
  days?: number;
}

/** Fills in every day between two dates so a chart has no holes. */
function series(rows: { created_at: string }[], days: number): { date: string; n: number }[] {
  const byDay = new Map<string, number>();
  for (const r of rows) {
    const k = dayKey(r.created_at);
    byDay.set(k, (byDay.get(k) ?? 0) + 1);
  }
  const out: { date: string; n: number }[] = [];
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const k = dayKey(d);
    out.push({ date: k, n: byDay.get(k) ?? 0 });
  }
  return out;
}

/** Emails for a set of user ids, so lists can show who a row belongs to. */
async function emailsFor(ids: string[]): Promise<Record<string, { email: string; name: string }>> {
  const unique = [...new Set(ids)].filter(Boolean);
  if (!unique.length) return {};
  const { data } = await admin().from("profiles").select("id, email, full_name").in("id", unique);
  const map: Record<string, { email: string; name: string }> = {};
  for (const r of data ?? []) map[r.id as string] = { email: (r.email as string) ?? "", name: (r.full_name as string) ?? "" };
  return map;
}

const tally = (rows: Record<string, unknown>[] | null, key: string) => {
  const m: Record<string, number> = {};
  for (const r of rows ?? []) {
    const k = String(r[key] ?? "unknown");
    m[k] = (m[k] ?? 0) + 1;
  }
  return m;
};

async function overview(days: number) {
  const db = admin();
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const head = { count: "exact" as const, head: true };

  const [users, usersNew, onboarded, pro, jobs, matches, apps, appsWeek, resumes, chats, signupRows, appRows, tierRows, statusRows] = await Promise.all([
    db.from("profiles").select("*", head),
    db.from("profiles").select("*", head).gte("created_at", weekAgo),
    db.from("profiles").select("*", head).not("onboarded_at", "is", null),
    db.from("profiles").select("*", head).in("plan_tier", ["pro", "trial"]),
    db.from("jobs").select("*", head).is("owner_id", null),
    db.from("job_matches").select("*", head),
    db.from("applications").select("*", head),
    db.from("applications").select("*", head).gte("created_at", weekAgo),
    db.from("resumes").select("*", head),
    db.from("chat_messages").select("*", head),
    db.from("profiles").select("created_at").gte("created_at", since),
    db.from("applications").select("created_at").gte("created_at", since),
    db.from("profiles").select("plan_tier"),
    db.from("applications").select("status, confirmation"),
  ]);

  const rows = (statusRows.data ?? []) as { status: string; confirmation: { verified?: boolean } | null }[];
  const verified = rows.filter((r) => r.confirmation?.verified).length;

  return {
    totals: {
      users: users.count ?? 0,
      usersNew: usersNew.count ?? 0,
      onboarded: onboarded.count ?? 0,
      pro: pro.count ?? 0,
      jobs: jobs.count ?? 0,
      matches: matches.count ?? 0,
      apps: apps.count ?? 0,
      appsWeek: appsWeek.count ?? 0,
      verified,
      resumes: resumes.count ?? 0,
      chats: chats.count ?? 0,
    },
    signups: series((signupRows.data ?? []) as { created_at: string }[], days),
    applications: series((appRows.data ?? []) as { created_at: string }[], days),
    tiers: tally(tierRows.data as never, "plan_tier"),
    statuses: tally(statusRows.data as never, "status"),
    days,
  };
}

async function listUsers(q: string, page: number) {
  let query = admin()
    .from("profiles")
    .select("id, email, full_name, location, situation, target_field, plan_tier, subscription_status, onboarded_at, created_at, is_admin, intensity", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(page * PAGE, page * PAGE + PAGE - 1);
  if (q) query = query.or(`email.ilike.%${q}%,full_name.ilike.%${q}%`);
  const { data, count, error } = await query;
  if (error) throw new HttpError(500, "We could not load the user list.");
  return { rows: data ?? [], total: count ?? 0, page, pageSize: PAGE };
}

async function userDetail(userId: string) {
  if (!userId) throw new HttpError(400, "Which user?");
  const db = admin();
  const [profile, apps, matches, resumes, letters, versions, events] = await Promise.all([
    db.from("profiles").select("*").eq("id", userId).maybeSingle(),
    db
      .from("applications")
      .select("id, status, method, created_at, submitted_at, confirmation, jobs(title, company, location, apply_url)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50),
    db.from("job_matches").select("score, why, computed_at, jobs(title, company, legit)").eq("user_id", userId).order("score", { ascending: false }).limit(20),
    db.from("resumes").select("id, file_name, mime_type, is_base, created_at").eq("user_id", userId).order("created_at", { ascending: false }),
    db.from("cover_letters").select("id", { count: "exact", head: true }).eq("user_id", userId),
    db.from("resume_versions").select("id", { count: "exact", head: true }).eq("user_id", userId),
    db.from("application_events").select("type, note, occurred_at").eq("user_id", userId).order("occurred_at", { ascending: false }).limit(20),
  ]);
  if (!profile.data) throw new HttpError(404, "That account no longer exists.");

  // The resume itself is the user's private document. Staff see that one exists
  // and what it is called. The parsed contents are deliberately not returned.
  return {
    profile: profile.data,
    applications: apps.data ?? [],
    matches: matches.data ?? [],
    resumes: resumes.data ?? [],
    counts: { letters: letters.count ?? 0, versions: versions.count ?? 0 },
    events: events.data ?? [],
  };
}

async function listJobs(q: string, page: number) {
  let query = admin()
    .from("jobs")
    .select(
      "id, source, title, company, location, remote_type, salary_min, salary_max, apply_url, employer_posted, posted_at, first_seen_at, repost_count, ats_provider, company_site_status, legit",
      { count: "exact" },
    )
    .is("owner_id", null)
    .order("first_seen_at", { ascending: false })
    .range(page * PAGE, page * PAGE + PAGE - 1);
  if (q) query = query.or(`title.ilike.%${q}%,company.ilike.%${q}%`);
  const { data, count, error } = await query;
  if (error) throw new HttpError(500, "We could not load the job cache.");
  return { rows: data ?? [], total: count ?? 0, page, pageSize: PAGE };
}

async function listApplications(page: number) {
  const { data, count, error } = await admin()
    .from("applications")
    .select("id, user_id, status, method, destination_label, created_at, submitted_at, confirmation, jobs(title, company, location)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(page * PAGE, page * PAGE + PAGE - 1);
  if (error) throw new HttpError(500, "We could not load applications.");
  const who = await emailsFor((data ?? []).map((r) => r.user_id as string));
  return { rows: (data ?? []).map((r) => ({ ...r, user: who[r.user_id as string] ?? null })), total: count ?? 0, page, pageSize: PAGE };
}

type Check = { name: string; ok: boolean; status: number; ms: number; skipped?: boolean; note?: string };

/**
 * Calls a service and reports whether it answered. `verdict` lets a service
 * explain a reply that is not a plain 2xx, because a refusal can still mean
 * the key is perfectly good.
 */
async function ping(name: string, run: () => Promise<Response>, verdict?: (r: Response, text: string) => { ok: boolean; note?: string } | null): Promise<Check> {
  const t0 = Date.now();
  try {
    const r = await run();
    const ms = Date.now() - t0;
    if (verdict) {
      const text = await r.text().catch(() => "");
      const v = verdict(r, text);
      if (v) return { name, ok: v.ok, status: r.status, ms, note: v.note };
    }
    return { name, ok: r.ok, status: r.status, ms };
  } catch {
    return { name, ok: false, status: 0, ms: Date.now() - t0, note: "No reply at all." };
  }
}

/** Configured services, plus a live ping of each one. Never returns a key. */
async function health() {
  const has = (...keys: string[]) => keys.every((k) => !!process.env[k]?.trim());
  const services: Record<string, boolean> = {
    supabase: has("VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"),
    anthropic: has("ANTHROPIC_API_KEY"),
    adzuna: has("ADZUNA_APP_ID", "ADZUNA_APP_KEY"),
    jsearch: has("RAPIDAPI_KEY"),
    stripe: has("STRIPE_SECRET_KEY"),
    resend: has("RESEND_API_KEY"),
  };
  const skip = (name: string): Check => ({ name, ok: false, status: 0, ms: 0, skipped: true });
  const timeout = () => AbortSignal.timeout(8000);

  const checks = await Promise.all([
    ping("Database", async () => {
      const { error } = await admin().from("jobs").select("id", { count: "exact", head: true });
      return new Response(null, { status: error ? 500 : 200 });
    }),
    services.adzuna
      ? ping("Adzuna", () =>
          fetch(`https://api.adzuna.com/v1/api/jobs/us/search/1?app_id=${process.env.ADZUNA_APP_ID}&app_key=${process.env.ADZUNA_APP_KEY}&results_per_page=1`, { signal: timeout() }),
        )
      : Promise.resolve(skip("Adzuna")),
    services.jsearch
      ? ping(
          "JSearch",
          () =>
            fetch("https://jsearch.p.rapidapi.com/search?query=test&num_pages=1", {
              headers: { "X-RapidAPI-Key": process.env.RAPIDAPI_KEY ?? "", "X-RapidAPI-Host": "jsearch.p.rapidapi.com" },
              signal: timeout(),
            }),
          // RapidAPI answers an unsubscribed key with 404 "endpoint does not exist",
          // which is about the subscription, not the key being wrong.
          (r, text) =>
            r.status === 404 || r.status === 403
              ? { ok: false, note: "The RapidAPI key is not subscribed to JSearch, so this source is off. Adzuna still works." }
              : r.ok
                ? null
                : { ok: false, note: text.slice(0, 140) },
        )
      : Promise.resolve(skip("JSearch")),
    services.anthropic
      ? ping("Anthropic", () =>
          fetch("https://api.anthropic.com/v1/models?limit=1", {
            headers: { "x-api-key": process.env.ANTHROPIC_API_KEY ?? "", "anthropic-version": "2023-06-01" },
            signal: timeout(),
          }),
        )
      : Promise.resolve(skip("Anthropic")),
    services.resend
      ? ping(
          "Resend",
          () => fetch("https://api.resend.com/domains", { headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}` }, signal: timeout() }),
          // A send-only key is refused by every read endpoint. That key is fine:
          // Resend is telling us it is real and scoped to sending, which is all we need.
          (r, text) =>
            r.status === 401 && text.includes("restricted_api_key")
              ? { ok: true, note: "Send only key. It cannot read the account, which is all CareerQuest needs." }
              : r.status === 401
                ? { ok: false, note: "Resend rejected the key." }
                : null,
        )
      : Promise.resolve(skip("Resend")),
  ]);

  const { data: freshest } = await admin().from("jobs").select("first_seen_at").order("first_seen_at", { ascending: false }).limit(1).maybeSingle();
  return {
    services,
    checks,
    lastJobPulledAt: (freshest?.first_seen_at as string) ?? null,
    region: process.env.VERCEL_REGION ?? "local",
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
  };
}

async function auditLog(page: number) {
  const { data, count } = await admin()
    .from("admin_actions")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(page * PAGE, page * PAGE + PAGE - 1);
  return { rows: data ?? [], total: count ?? 0, page, pageSize: PAGE };
}

/* ---------------- actions that change things ---------------- */

const TIERS = ["free", "trial", "pro"];

async function setTier(actor: AdminUser, userId: string, tier: string) {
  if (!userId) throw new HttpError(400, "Which user?");
  if (!TIERS.includes(tier)) throw new HttpError(400, "That is not a plan we offer.");
  const db = admin();
  const { data: before } = await db.from("profiles").select("email, plan_tier").eq("id", userId).maybeSingle();
  if (!before) throw new HttpError(404, "That account no longer exists.");
  const { error } = await db.from("profiles").update({ plan_tier: tier, updated_at: new Date().toISOString() }).eq("id", userId);
  if (error) throw new HttpError(500, "We could not change that plan.");
  await logAction(actor, "plan.change", { id: userId, label: (before.email as string) ?? userId, detail: { from: before.plan_tier, to: tier } });
  return { ok: true, tier };
}

async function setAdminFlag(actor: AdminUser, userId: string, value: boolean) {
  if (!userId) throw new HttpError(400, "Which user?");
  if (userId === actor.id && !value) throw new HttpError(400, "You cannot remove your own admin access. Ask another admin to do it.");
  const db = admin();
  const { data: before } = await db.from("profiles").select("email").eq("id", userId).maybeSingle();
  if (!before) throw new HttpError(404, "That account no longer exists.");
  const { error } = await db.from("profiles").update({ is_admin: value }).eq("id", userId);
  if (error) throw new HttpError(500, "We could not change that.");
  await logAction(actor, value ? "admin.grant" : "admin.revoke", { id: userId, label: (before.email as string) ?? userId });
  return { ok: true, is_admin: value };
}

async function resetOnboarding(actor: AdminUser, userId: string) {
  if (!userId) throw new HttpError(400, "Which user?");
  const db = admin();
  const { data: before } = await db.from("profiles").select("email").eq("id", userId).maybeSingle();
  if (!before) throw new HttpError(404, "That account no longer exists.");
  const { error } = await db.from("profiles").update({ onboarded_at: null, onboarding_step: 0 }).eq("id", userId);
  if (error) throw new HttpError(500, "We could not reset that.");
  await logAction(actor, "onboarding.reset", { id: userId, label: (before.email as string) ?? userId });
  return { ok: true };
}

/** The same permanent deletion a user can run on themselves, done on their behalf. */
async function deleteUser(actor: AdminUser, userId: string, confirm: string) {
  if (!userId) throw new HttpError(400, "Which user?");
  if (userId === actor.id) throw new HttpError(400, "Use Settings to delete your own account.");
  if (confirm !== "DELETE") throw new HttpError(400, "Type DELETE to confirm.");
  const db = admin();
  const { data: before } = await db.from("profiles").select("email").eq("id", userId).maybeSingle();

  for (const bucket of ["resumes", "confirmations"]) {
    const { data } = await db.storage.from(bucket).list(userId, { limit: 1000 });
    if (data?.length) await db.storage.from(bucket).remove(data.map((f) => `${userId}/${f.name}`));
  }
  await db.from("applications").delete().eq("user_id", userId);
  await db.from("jobs").delete().eq("owner_id", userId);
  const { error } = await db.auth.admin.deleteUser(userId);
  if (error) throw new HttpError(500, "We could not delete that account. Please try again.");
  await logAction(actor, "account.delete", { id: userId, label: (before?.email as string) ?? userId });
  return { deleted: true };
}

export default route(async (req) => {
  const actor = await requireAdmin(req);
  const p = body<Payload>(req);
  const page = Math.max(0, Number(p.page ?? 0) || 0);
  // Commas and parentheses are the separators in a PostgREST "or" filter, so they go.
  const q = (p.q ?? "").trim().replace(/[%,()]/g, "").slice(0, 80);

  switch (p.action) {
    case "whoami":
      return { admin: true, id: actor.id, email: actor.email, viaEnv: actor.viaEnv };
    case "overview":
      return overview(Math.min(90, Math.max(7, Number(p.days ?? 30) || 30)));
    case "users":
      return listUsers(q, page);
    case "user":
      return userDetail(p.userId ?? "");
    case "jobs":
      return listJobs(q, page);
    case "applications":
      return listApplications(page);
    case "health":
      return health();
    case "log":
      return auditLog(page);
    case "setTier":
      return setTier(actor, p.userId ?? "", p.tier ?? "");
    case "setAdmin":
      return setAdminFlag(actor, p.userId ?? "", !!p.value);
    case "resetOnboarding":
      return resetOnboarding(actor, p.userId ?? "");
    case "deleteUser":
      return deleteUser(actor, p.userId ?? "", p.confirm ?? "");
    default:
      throw new HttpError(400, "Unknown admin action.");
  }
});
