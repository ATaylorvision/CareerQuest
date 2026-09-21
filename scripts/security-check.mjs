// Security check. Creates two throwaway accounts with real rows, then tries to
// reach one account's data as the other, by every route the browser has.
// Run with the dev server up:  node scripts/security-check.mjs
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local", quiet: true });
const BASE = process.env.E2E_BASE || "http://127.0.0.1:5173";
const URL = process.env.VITE_SUPABASE_URL;
const ANON = process.env.VITE_SUPABASE_ANON_KEY;
const admin = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

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

const stamp = Date.now();
const made = [];

/** A browser-like client signed in as one person. This is all an attacker has. */
async function makeUser(tag) {
  const email = `cq-sec-${tag}-${stamp}@careerquest-probe.com`;
  const password = `Sec-${stamp}-${tag}!x`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(error.message);
  made.push(data.user.id);
  const client = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data: s, error: e2 } = await client.auth.signInWithPassword({ email, password });
  if (e2) throw new Error(e2.message);
  return { id: data.user.id, email, client, token: s.session.access_token };
}

const apiAs = async (token, path, payload) => {
  const r = await fetch(`${BASE}/api/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(payload ?? {}),
  });
  let json = null;
  try {
    json = JSON.parse(await r.text());
  } catch {
    /* not json */
  }
  return { status: r.status, json };
};

try {
  console.log("\n[1] Two throwaway accounts, each with real data");
  const a = await makeUser("a");
  const b = await makeUser("b");

  // Give A a resume, a saved application with a timeline, a letter and a version.
  await admin.from("resumes").insert({ user_id: a.id, file_name: "a-private.pdf", is_base: true, parsed: { summary: "SECRET-A-SUMMARY", roles: [], skills: [], education: [], certifications: [] } });
  const { data: job } = await admin.from("jobs").select("id").limit(1).maybeSingle();
  const { data: appRow } = await admin.from("applications").insert({ user_id: a.id, job_id: job.id, status: "applied", cover_letter: "SECRET-A-LETTER" }).select("id").single();
  await admin.from("application_events").insert({ application_id: appRow.id, user_id: a.id, type: "submitted", note: "SECRET-A-EVENT" });
  await admin.from("cover_letters").insert({ user_id: a.id, job_id: job.id, content: "SECRET-A-COVER" });
  await admin.from("resume_versions").insert({ user_id: a.id, job_id: job.id, name: "SECRET-A-VERSION", content: {} });
  await admin.from("user_state").insert({ user_id: a.id, state: { note: "SECRET-A-STATE" } });
  await admin.from("practice_attempts").insert({ user_id: a.id, question: "q", answer: "SECRET-A-ANSWER" });
  console.log(`  account A ${a.email}`);
  console.log(`  account B ${b.email}`);

  console.log("\n[2] B reads A's tables directly (this is what a hostile browser would do)");
  const tables = ["resumes", "applications", "application_events", "cover_letters", "resume_versions", "user_state", "practice_attempts", "profiles", "job_matches"];
  for (const t of tables) {
    const { data } = await b.client.from(t).select("*");
    const rows = data ?? [];
    const leaked = rows.some((r) => (r.user_id ?? r.id) === a.id);
    ok(`B cannot read A's ${t}`, !leaked, `B sees ${rows.length} row(s), none belonging to A`);
  }

  console.log("\n[3] B writes into A's account");
  const w1 = await b.client.from("applications").insert({ user_id: a.id, job_id: job.id, status: "offer" });
  ok("B cannot insert a row owned by A", !!w1.error, w1.error?.message?.slice(0, 60) ?? "INSERT SUCCEEDED");
  const w2 = await b.client.from("applications").update({ status: "closed" }).eq("user_id", a.id);
  const { data: stillApplied } = await admin.from("applications").select("status").eq("user_id", a.id).single();
  ok("B cannot change A's application status", stillApplied.status === "applied", `status is still "${stillApplied.status}"`);
  const w3 = await b.client.from("resumes").delete().eq("user_id", a.id);
  const { count: aResumes } = await admin.from("resumes").select("*", { count: "exact", head: true }).eq("user_id", a.id);
  ok("B cannot delete A's resume", aResumes === 1, `A still has ${aResumes} resume(s)`);

  console.log("\n[4] Privilege escalation");
  // Each result is re-read from the database AFTER the attempt. Reading once up
  // front tests stale data and passes even while the column is writable.
  const readProfile = async () => (await admin.from("profiles").select("is_admin, plan_tier, add_ons, subscription_status").eq("id", b.id).single()).data;

  await b.client.from("profiles").update({ is_admin: true }).eq("id", b.id);
  ok("a user cannot make themselves an admin", (await readProfile()).is_admin === false, `is_admin is ${(await readProfile()).is_admin}`);

  await b.client.from("profiles").update({ plan_tier: "pro" }).eq("id", b.id);
  ok("a user cannot give themselves Pro", (await readProfile()).plan_tier === "free", `plan_tier is ${(await readProfile()).plan_tier}`);

  await b.client.from("profiles").update({ add_ons: { connections: true } }).eq("id", b.id);
  ok("a user cannot grant themselves an add on", !(await readProfile()).add_ons?.connections, `add_ons is ${JSON.stringify((await readProfile()).add_ons)}`);

  await b.client.from("profiles").update({ subscription_status: "active" }).eq("id", b.id);
  ok("a user cannot fake a subscription", (await readProfile()).subscription_status === null, `subscription_status is ${(await readProfile()).subscription_status}`);

  await b.client.from("profiles").update({ full_name: "Renamed By Owner" }).eq("id", b.id);
  const { data: renamed } = await admin.from("profiles").select("full_name").eq("id", b.id).single();
  ok("a user CAN still edit their own safe fields", renamed.full_name === "Renamed By Owner", `full_name is "${renamed.full_name}"`);

  // Seed a real counter first, otherwise "nothing changed" proves nothing.
  const month = `${new Date().toISOString().slice(0, 7)}-01`;
  await admin.from("usage_counters").upsert({ user_id: b.id, month, cover_letters: 3 }, { onConflict: "user_id,month" });
  await b.client.from("usage_counters").update({ cover_letters: 0 }).eq("user_id", b.id);
  const { data: counters } = await admin.from("usage_counters").select("cover_letters").eq("user_id", b.id).eq("month", month).single();
  ok("a user cannot rewrite their own usage", counters.cover_letters === 3, `cover_letters is still ${counters.cover_letters}`);
  const insUsage = await b.client.from("usage_counters").insert({ user_id: b.id, month: "2020-01-01", cover_letters: 0 });
  ok("a user cannot insert a usage row", !!insUsage.error, insUsage.error?.message?.slice(0, 60) ?? "INSERT SUCCEEDED");


  console.log("\n[5] The admin API");
  ok("a normal account is refused", (await apiAs(b.token, "admin", { action: "overview" })).status === 403);
  ok("no token is refused", (await apiAs(null, "admin", { action: "overview" })).status === 401);
  ok("a forged bearer token is refused", (await apiAs("not.a.real.token", "admin", { action: "overview" })).status === 401);

  console.log("\n[6] Studio endpoints cannot act for someone else");
  ok("no token is refused", (await apiAs(null, "studio", { action: "tailor", jobId: job.id })).status === 401);
  // B asks to tailor using A's job. It must run against B's own resume, and B has none.
  const cross = await apiAs(b.token, "studio", { action: "tailor", jobId: job.id });
  ok("studio reads only the caller's own resume", cross.status === 400, cross.json?.error?.slice(0, 70));

  console.log("\n[7] Private files");
  const { data: signed, error: sErr } = await b.client.storage.from("resumes").createSignedUrl(`${a.id}/anything.pdf`, 60);
  ok("B cannot get a link to A's resume file", !!sErr || !signed, sErr?.message?.slice(0, 50) ?? "no url issued");
  const { data: listed } = await b.client.storage.from("resumes").list(a.id);
  ok("B cannot list A's resume folder", !listed || listed.length === 0, `${listed?.length ?? 0} file(s) visible`);

  console.log("\n[8] Search filter cannot be used to widen a query");
  const inject = await apiAs(b.token, "admin", { action: "users", q: "a,b)or(1.eq.1" });
  ok("admin search injection is still refused for non staff", inject.status === 403);

  console.log("\n[9] The shared job cache is readable but not writable");
  const { data: jobsRead } = await b.client.from("jobs").select("id").limit(1);
  ok("a signed in user can read cached jobs", (jobsRead?.length ?? 0) === 1);
  const jw = await b.client.from("jobs").update({ title: "HACKED" }).eq("id", job.id);
  const { data: jobNow } = await admin.from("jobs").select("title").eq("id", job.id).single();
  ok("a user cannot edit the shared job cache", jobNow.title !== "HACKED", `title is "${jobNow.title.slice(0, 40)}"`);

  console.log("\n[10] A's own data survives a fresh sign in");
  // Sign A in again from scratch, the way a returning visit works, and read
  // back the records the tracker depends on.
  const aAgain = createClient(URL, ANON, { auth: { persistSession: false } });
  await aAgain.auth.signInWithPassword({ email: a.email, password: `Sec-${stamp}-a!x` });
  const { data: myApps } = await aAgain.from("applications").select("job_id, status, cover_letter").eq("job_id", job.id);
  ok("A still sees their application", myApps?.length === 1, `status "${myApps?.[0]?.status}"`);
  ok("A still sees their own letter", myApps?.[0]?.cover_letter === "SECRET-A-LETTER");
  const { data: myEvents } = await aAgain.from("application_events").select("type, note");
  ok("A still sees their timeline", (myEvents?.length ?? 0) >= 1, `${myEvents?.length} event(s)`);

  // A status change must stick across a reconnect, which is what tracking means.
  await aAgain.from("applications").update({ status: "interview" }).eq("job_id", job.id);
  const third = createClient(URL, ANON, { auth: { persistSession: false } });
  await third.auth.signInWithPassword({ email: a.email, password: `Sec-${stamp}-a!x` });
  const { data: afterMove } = await third.from("applications").select("status").eq("job_id", job.id).single();
  ok("a status change persists to the next session", afterMove.status === "interview", `status is "${afterMove.status}"`);

  const { data: myResume } = await aAgain.from("resumes").select("parsed").eq("is_base", true).maybeSingle();
  ok("A still sees their own resume", myResume?.parsed?.summary === "SECRET-A-SUMMARY");

  console.log("\n[11] Paid endpoints cannot be run without limit");
  // resume/parse allows 10 a day. An empty body is refused before any AI call,
  // so this costs nothing while still proving the counter bites.
  const codes = [];
  for (let i = 0; i < 12; i++) codes.push((await apiAs(b.token, "resume/parse", {})).status);
  ok("the 11th upload in a day is refused", codes[9] === 400 && codes[10] === 429, `statuses: ${codes.join(" ")}`);
  const stranger = await makeUser("c");
  ok("one person's limit does not touch another's", (await apiAs(stranger.token, "resume/parse", {})).status === 400);
  const direct = await b.client.rpc("take_quota", { p_user: b.id, p_bucket: "x", p_limit: 5 });
  ok("a browser cannot call the quota function itself", !!direct.error, direct.error?.message?.slice(0, 50));
  const { error: cannotWrite } = await b.client.from("api_usage").insert({ user_id: b.id, bucket: "resume-parse", n: 0 });
  ok("a browser cannot write its own usage row", !!cannotWrite, cannotWrite?.message?.slice(0, 50));

  console.log("\n[12] Signed out means no data at all");
  const anon = createClient(URL, ANON, { auth: { persistSession: false } });
  let anonLeak = 0;
  for (const t of tables) {
    const { data } = await anon.from(t).select("*").limit(1);
    if ((data?.length ?? 0) > 0) anonLeak++;
  }
  ok("an anonymous visitor reads nothing", anonLeak === 0, `${anonLeak} table(s) exposed`);
} catch (e) {
  fail++;
  console.error("\nThrew:", e.message);
} finally {
  console.log("\n[cleanup] removing throwaway accounts");
  for (const id of made) await admin.auth.admin.deleteUser(id).catch(() => {});
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
}
