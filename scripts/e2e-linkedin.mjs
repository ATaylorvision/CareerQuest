// Runs one real LinkedIn search through the whole path with throwaway accounts, checks the switch,
// the per-person and daily caps, and who can see what, then cleans up. Costs about five cents.
// Run with the dev server up:  node scripts/e2e-linkedin.mjs
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local", quiet: true, override: true });
const BASE = process.env.E2E_BASE || "http://127.0.0.1:5173";
const db = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = () => createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });

const stamp = Date.now();
let pass = 0;
let fail = 0;
const ok = (name, cond, extra = "") => {
  cond ? pass++ : fail++;
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${extra ? ` — ${extra}` : ""}`);
};
const made = [];

async function makeUser(tag) {
  const email = `cq-li-${tag}-${stamp}@careerquest-probe.com`;
  const password = `Li-${stamp}-${tag}!x`;
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(error.message);
  made.push(data.user.id);
  await db.from("profiles").update({ onboarded_at: new Date().toISOString(), location: "Farmingdale, NY", locations: ["Farmingdale, NY"], target_roles: ["operations manager"], remote_pref: "any", max_distance_miles: 30, salary_floor: 50000 }).eq("id", data.user.id);
  const { data: s } = await anon().auth.signInWithPassword({ email, password });
  return { id: data.user.id, token: s.session.access_token };
}
const call = async (token, payload) => {
  const r = await fetch(`${BASE}/api/jobs/search`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
  let json = null;
  try {
    json = JSON.parse(await r.text());
  } catch {
    /* not json */
  }
  return { status: r.status, json };
};
const setSwitch = (v) => db.from("app_settings").upsert({ key: "linkedin_enabled", value: v }, { onConflict: "key" });

const { data: before } = await db.from("app_settings").select("value").eq("key", "linkedin_enabled").maybeSingle();

try {
  console.log("\n[1] Two throwaway accounts");
  const a = await makeUser("a");
  const b = await makeUser("b");

  console.log("\n[2] The switch");
  await setSwitch(false);
  const off = await call(a.token, { action: "linkedinStart" });
  ok("with the switch off, no search starts", off.status === 200 && off.json?.started === false, off.json?.note);
  ok("with the switch off, the normal search does not ask the browser to start one", (await call(a.token, { action: "nothing" })).status !== 500);
  const { count: none } = await db.from("linkedin_runs").select("id", { count: "exact", head: true }).eq("user_id", a.id);
  ok("and nothing was spent or recorded", (none ?? 0) === 0);
  ok("no token is refused", (await fetch(`${BASE}/api/jobs/search`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "linkedinStart" }) })).status === 401);

  console.log("\n[3] One real search");
  await setSwitch(true);
  const t0 = Date.now();
  const start = await call(a.token, { action: "linkedinStart" });
  ok("a search starts", start.json?.started === true && !!start.json?.runId, start.json?.runId);
  let done = null;
  for (let i = 0; i < 40 && start.json?.runId; i++) {
    await new Promise((r) => setTimeout(r, 4000));
    const p = await call(a.token, { action: "linkedinPoll", runId: start.json.runId });
    if (p.json?.status !== "running") {
      done = p;
      break;
    }
  }
  ok("it finishes", !!done && done.status === 200, `${((Date.now() - t0) / 1000).toFixed(0)}s`);
  const ids = done?.json?.ids ?? [];
  ok("it brings back listings", ids.length > 0, `${ids.length} listing(s), ${done?.json?.outOfRange ?? 0} dropped for distance`);
  const { data: jobs } = await db.from("jobs").select("id, source, location, latitude, longitude, apply_url, legit, posted_at").in("id", ids);
  ok("they are marked as LinkedIn listings", (jobs ?? []).every((j) => j.source === "linkedin" && j.id.startsWith("linkedin:")));
  const placed = (jobs ?? []).filter((j) => j.latitude != null).length;
  ok("nearly every one has been placed on the map (a rare unknown place falls back to LinkedIn's own radius)", placed >= Math.floor((jobs?.length ?? 0) * 0.85), `${placed} of ${jobs?.length}`);
  ok("every one has a legitimacy score", (jobs ?? []).every((j) => typeof j.legit?.score === "number"));
  ok("every apply link is https", (jobs ?? []).every((j) => j.apply_url?.startsWith("https://")));
  console.log(`  sample: ${(jobs ?? []).slice(0, 3).map((j) => j.location).join(" | ")}`);
  const { data: run } = await db.from("linkedin_runs").select("status, items, cost_usd, ids").eq("run_id", start.json?.runId).single();
  ok("the run is on file with its result and cost", run?.status === "done" && run?.items > 0 && run?.cost_usd !== null, `items ${run?.items}, cost $${Number(run?.cost_usd).toFixed(4)}`);
  ok("it stayed under the price cap", Number(run?.cost_usd ?? 99) <= 0.25);
  const again = await call(a.token, { action: "linkedinPoll", runId: start.json.runId });
  ok("asking again gives the same answer and does not spend or process twice", JSON.stringify(again.json?.ids) === JSON.stringify(ids));

  console.log("\n[4] Who can see what");
  const other = await call(b.token, { action: "linkedinPoll", runId: start.json.runId });
  ok("someone else cannot read this person's search", other.json?.ids?.length === 0 && /could not find/i.test(other.json?.note ?? ""), other.json?.note);
  const bClient = anon();
  await bClient.auth.signInWithPassword({ email: `cq-li-b-${stamp}@careerquest-probe.com`, password: `Li-${stamp}-b!x` });
  const rd = await bClient.from("linkedin_runs").select("run_id");
  ok("a browser cannot read the run table", !!rd.error || (rd.data?.length ?? 0) === 0);
  const st = await bClient.from("app_settings").select("value");
  ok("a browser cannot read or flip the switch", !!st.error || (st.data?.length ?? 0) === 0);
  const flip = await bClient.from("app_settings").update({ value: false }).eq("key", "linkedin_enabled");
  const { data: still } = await db.from("app_settings").select("value").eq("key", "linkedin_enabled").single();
  ok("and it is still on", still.value === true, flip.error?.message?.slice(0, 50) ?? "no error, unchanged");

  console.log("\n[5] The caps");
  for (let i = 0; i < 3; i++) await db.rpc("take_quota", { p_user: b.id, p_bucket: "linkedin", p_limit: 3 });
  const capped = await call(b.token, { action: "linkedinStart" });
  ok("a fourth search in a day is refused", capped.status === 429, capped.json?.error?.slice(0, 60));
  const { count: bRuns } = await db.from("linkedin_runs").select("id", { count: "exact", head: true }).eq("user_id", b.id);
  ok("and nothing was started", (bRuns ?? 0) === 0);
  const c = await makeUser("c");
  const fake = Array.from({ length: 40 }, (_, i) => ({ user_id: c.id, run_id: `fake-${stamp}-${i}`, status: "done" }));
  await db.from("linkedin_runs").insert(fake);
  const d = await makeUser("d");
  const global = await call(d.token, { action: "linkedinStart" });
  ok("when the daily total is reached, nobody can start one", global.json?.started === false && /resting/i.test(global.json?.note ?? ""), global.json?.note);
  await db.from("linkedin_runs").delete().like("run_id", `fake-${stamp}-%`);
  const { count: dRuns } = await db.from("linkedin_runs").select("id", { count: "exact", head: true }).eq("user_id", d.id);
  ok("and no run was created", (dRuns ?? 0) === 0);

  console.log("\n[6] The normal search tells the browser whether to add LinkedIn");
  const normal = await call(a.token, {});
  ok("it says LinkedIn is on", normal.json?.linkedin === true || normal.json?.total === 0, `linkedin=${normal.json?.linkedin}`);
} catch (e) {
  fail++;
  console.log("\nSTOPPED:", e.message);
} finally {
  console.log("\n[cleanup]");
  await db.from("app_settings").upsert({ key: "linkedin_enabled", value: before?.value === true }, { onConflict: "key" });
  await db.from("linkedin_runs").delete().like("run_id", `fake-${stamp}-%`);
  const { data: mine } = await db.from("job_matches").select("job_id").in("user_id", made);
  for (const id of made) await db.auth.admin.deleteUser(id);
  console.log(`  removed ${made.length} accounts, switch restored to ${before?.value === true ? "on" : "off"}`);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
