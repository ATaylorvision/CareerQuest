import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
config({ path: ".env.local", quiet: true });
const BASE = "http://127.0.0.1:5173";
const admin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const email = `cq-speed-${Date.now()}@example.com`, password = "TestPass-2026-xyz";
const { data: cu } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
const uid = cu.user.id;
try {
  const { data: s } = await anon.auth.signInWithPassword({ email, password });
  const token = s.session.access_token;
  const call = async (p, b) => { const r = await fetch(`${BASE}/api/${p}`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify(b) }); const j = await r.json(); if (!r.ok) throw new Error(p + JSON.stringify(j)); return j; };
  const txt = "Renee Castillo\nProvidence, RI\nRegional Operations Manager, Harbor & Pine Home, Mar 2022 to May 2026\n- Oversaw operations for 6 stores with $38M revenue.\n- Managed weekly inventory counts and replenishment for 6 locations, cutting stockouts by 22%.\n- Worked with 14 vendors on delivery schedules and claims, recovering $210K.\n- Led 6 store managers and about 120 associates.\nSkills: Inventory management, Vendor management, Excel";
  await call("resume/parse", { fileName: "r.txt", mime: "text/plain", data: Buffer.from(txt).toString("base64") });
  await admin.from("profiles").update({ target_roles: ["operations manager", "supply chain analyst"], locations: ["Providence, RI", "Boston, MA"], remote_pref: "any" }).eq("id", uid);
  const t0 = Date.now();
  const found = await call("jobs/search", {});
  const chunks = []; for (let i = 0; i < found.ids.length; i += 8) chunks.push(found.ids.slice(i, i + 8));
  await Promise.all(chunks.map((ids) => call("jobs/match", { ids, mode: "score" })));
  const n = (await admin.from("job_matches").select("*", { count: "exact", head: true }).eq("user_id", uid)).count;
  console.log(`search + score: ${((Date.now() - t0) / 1000).toFixed(1)}s | ${n} of ${found.total} scored`);
} finally { await admin.auth.admin.deleteUser(uid); }
