// Verifies /api/admin against the running dev server with a throwaway staff
// account, then deletes it. Run from the project root with the dev server up.
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local", quiet: true });
const BASE = process.env.E2E_BASE || "http://127.0.0.1:5173";
const db = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });

const stamp = Date.now();
const mk = (tag) => ({ email: `cq-admin-${tag}-${stamp}@example.com`, password: `Test-${stamp}-pw!` });
const staff = mk("staff");
const plain = mk("plain");
const made = [];

let pass = 0;
let fail = 0;
const ok = (name, cond, extra = "") => {
  if (cond) {
    pass++;
    console.log(`  PASS  ${name}${extra ? ` — ${extra}` : ""}`);
  } else {
    fail++;
    console.log(`  FAIL  ${name}${extra ? ` — ${extra}` : ""}`);
  }
};

async function signUp({ email, password }) {
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(`create ${email}: ${error.message}`);
  made.push(data.user.id);
  const { data: s, error: e2 } = await anon.auth.signInWithPassword({ email, password });
  if (e2) throw new Error(`sign in ${email}: ${e2.message}`);
  return { id: data.user.id, token: s.session.access_token };
}

async function call(token, action, payload = {}) {
  const r = await fetch(`${BASE}/api/admin`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ action, ...payload }),
  });
  let json = null;
  try {
    json = JSON.parse(await r.text());
  } catch {
    /* not json */
  }
  return { status: r.status, json };
}

try {
  console.log("\n[1] Creating a throwaway staff account and a plain one");
  const s = await signUp(staff);
  const p = await signUp(plain);
  await db.from("profiles").update({ is_admin: true }).eq("id", s.id);
  console.log(`  staff ${staff.email}`);
  console.log(`  plain ${plain.email}`);

  console.log("\n[2] Access control");
  ok("a plain account is refused", (await call(p.token, "whoami")).status === 403);
  ok("no token is refused", (await fetch(`${BASE}/api/admin`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })).status === 401);
  ok("GET is refused", (await fetch(`${BASE}/api/admin`, { method: "GET" })).status === 405);
  const who = await call(s.token, "whoami");
  ok("a staff account is let in", who.status === 200 && who.json?.admin === true, who.json?.email);
  ok("an unknown action is rejected", (await call(s.token, "nonsense")).status === 400);

  console.log("\n[3] Read actions");
  const ov = await call(s.token, "overview", { days: 30 });
  ok("overview", ov.status === 200 && typeof ov.json?.totals?.users === "number", `${ov.json?.totals?.users} users, ${ov.json?.totals?.jobs} jobs, ${ov.json?.signups?.length} days charted`);
  const us = await call(s.token, "users", { page: 0 });
  ok("users", us.status === 200 && Array.isArray(us.json?.rows), `${us.json?.total} total, page of ${us.json?.rows?.length}`);
  const search = await call(s.token, "users", { q: "cq-admin-staff" });
  ok("user search", search.status === 200 && search.json?.rows?.length === 1, `found ${search.json?.rows?.[0]?.email}`);
  const det = await call(s.token, "user", { userId: p.id });
  ok("user detail", det.status === 200 && det.json?.profile?.id === p.id, `${det.json?.applications?.length} applications, ${det.json?.matches?.length} matches`);
  const jb = await call(s.token, "jobs", { page: 0 });
  ok("job cache", jb.status === 200 && Array.isArray(jb.json?.rows), `${jb.json?.total} cached, first: ${jb.json?.rows?.[0]?.title}`);
  const jq = await call(s.token, "jobs", { q: "manager" });
  ok("job search", jq.status === 200, `${jq.json?.total} match "manager"`);
  const ap = await call(s.token, "applications", { page: 0 });
  ok("applications", ap.status === 200 && Array.isArray(ap.json?.rows), `${ap.json?.total} total`);
  const he = await call(s.token, "health");
  ok("health", he.status === 200 && Array.isArray(he.json?.checks), he.json?.checks?.map((c) => `${c.name}:${c.skipped ? "off" : c.ok ? "ok" : "FAIL"}`).join(" "));

  console.log("\n[4] Write actions");
  const tier = await call(s.token, "setTier", { userId: p.id, tier: "pro" });
  const after = await call(s.token, "user", { userId: p.id });
  ok("change a plan", tier.status === 200 && after.json?.profile?.plan_tier === "pro");
  ok("a made up plan is rejected", (await call(s.token, "setTier", { userId: p.id, tier: "platinum" })).status === 400);
  ok("reset onboarding", (await call(s.token, "resetOnboarding", { userId: p.id })).status === 200);
  ok("grant admin", (await call(s.token, "setAdmin", { userId: p.id, value: true })).status === 200);
  ok("revoke admin", (await call(s.token, "setAdmin", { userId: p.id, value: false })).status === 200);
  ok("cannot demote yourself", (await call(s.token, "setAdmin", { userId: s.id, value: false })).status === 400);
  ok("delete needs the confirm word", (await call(s.token, "deleteUser", { userId: p.id, confirm: "yes" })).status === 400);
  ok("cannot delete yourself", (await call(s.token, "deleteUser", { userId: s.id, confirm: "DELETE" })).status === 400);

  console.log("\n[5] Audit log");
  const log = await call(s.token, "log", { page: 0 });
  const actions = (log.json?.rows ?? []).map((r) => r.action);
  ok("actions were recorded", log.status === 200 && actions.includes("plan.change") && actions.includes("admin.grant"), actions.slice(0, 6).join(", "));
  ok("the log names who did it", log.json?.rows?.[0]?.actor_email === staff.email);

  console.log("\n[6] Deleting a user for real");
  const del = await call(s.token, "deleteUser", { userId: p.id, confirm: "DELETE" });
  ok("delete works", del.status === 200 && del.json?.deleted === true);
  ok("the account is gone", (await call(s.token, "user", { userId: p.id })).status === 404);
} catch (e) {
  fail++;
  console.error("\nThrew:", e.message);
} finally {
  console.log("\n[cleanup] removing throwaway accounts");
  for (const id of made) await db.auth.admin.deleteUser(id).catch(() => {});
  await db.from("admin_actions").delete().like("actor_email", "cq-admin-%");
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
}
