// End to end backend test with a throwaway account and a fictional resume.
// Run with the dev server up:  node scripts/e2e-backend.mjs
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import PDFDocument from "pdfkit";

config({ path: ".env.local", quiet: true });
const BASE = process.env.E2E_BASE || "http://127.0.0.1:5173";
const admin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });

const stamp = Date.now();
const email = `cq-e2e-${stamp}@example.com`;
const password = `Test-${stamp}-pw!`;
const step = (n, msg) => console.log(`\n[${n}] ${msg}`);
const ms = (t0) => `${((Date.now() - t0) / 1000).toFixed(1)}s`;

function makePdf() {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ margin: 54 });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.fontSize(20).text("Renee Castillo");
    doc.fontSize(10).text("Providence, RI | (401) 555-0148 | renee.castillo@example.com").moveDown();
    doc.fontSize(11).text("SUMMARY", { underline: true });
    doc.text("Retail operations manager with eight years of experience running high volume stores and multi store regions. Known for tight inventory control and fixing broken processes.").moveDown();
    doc.text("EXPERIENCE", { underline: true });
    doc.text("Regional Operations Manager, Harbor & Pine Home, Providence, RI    Mar 2022 to May 2026");
    for (const b of [
      "Oversaw day to day operations for 6 stores across Rhode Island and southeastern Massachusetts with combined annual revenue of $38M.",
      "Managed weekly inventory counts and replenishment orders for 6 locations, cutting stockouts by 22% in 2024.",
      "Worked with 14 vendors on delivery schedules and damaged goods claims, recovering $210K in credits over two years.",
      "Led a team of 6 store managers and about 120 hourly associates.",
      "Rolled out a new Kronos scheduling process that reduced overtime spending by 18%.",
    ])
      doc.text(`- ${b}`, { indent: 12 });
    doc.moveDown().text("Store Operations Manager, Harbor & Pine Home, Warwick, RI    Jun 2018 to Mar 2022");
    for (const b of ["Ran receiving, stockroom, and floor operations for a $7.5M store.", "Reduced shrink from 2.1% to 1.3% by redesigning receiving checks and cycle counts.", "Hired and trained 40+ associates, 5 of whom were promoted."])
      doc.text(`- ${b}`, { indent: 12 });
    doc.moveDown().text("EDUCATION", { underline: true });
    doc.text("B.A. Communications, University of Rhode Island, 2013");
    doc.moveDown().text("CERTIFICATIONS", { underline: true });
    doc.text("Lean Six Sigma Yellow Belt, 2021");
    doc.moveDown().text("SKILLS", { underline: true });
    doc.text("Inventory management, Vendor management, Labor scheduling (Kronos), Advanced Excel, Oracle Retail, P&L review");
    doc.end();
  });
}

async function call(token, path, payload) {
  const t0 = Date.now();
  const r = await fetch(`${BASE}/api/${path}`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify(payload ?? {}) });
  const text = await r.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  if (!r.ok) throw new Error(`${path} -> HTTP ${r.status}: ${typeof json === "string" ? json.slice(0, 200) : JSON.stringify(json)}`);
  return { json, took: ms(t0) };
}

let userId;
try {
  step(1, "create throwaway user");
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: "Renee Castillo" } });
  if (error) throw error;
  userId = data.user.id;
  const { data: sess, error: e2 } = await anon.auth.signInWithPassword({ email, password });
  if (e2) throw e2;
  const token = sess.session.access_token;
  const { data: prof } = await admin.from("profiles").select("id, plan_tier").eq("id", userId).single();
  console.log("   profile auto created:", !!prof, "| tier:", prof?.plan_tier);

  step(2, "unauthenticated call must be rejected");
  const bad = await fetch(`${BASE}/api/resume/parse`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  console.log("   status without token:", bad.status);

  step(3, "parse a PDF resume with Claude");
  const pdf = await makePdf();
  const parsed = await call(token, "resume/parse", { fileName: "Renee_Castillo_Resume.pdf", mime: "application/pdf", data: pdf.toString("base64") });
  const r = parsed.json.resume;
  console.log(`   ${parsed.took} | ${r.name} | ${parsed.json.stats.roles} roles, ${parsed.json.stats.bullets} bullets, ${parsed.json.stats.skills} skills | field: ${r.current_field}`);
  console.log("   first bullet:", r.roles[0]?.bullets[0]?.text);
  console.log("   certifications:", r.certifications.join("; "));

  step(4, "save preferences on the profile");
  await admin.from("profiles").update({ situation: "laidoff", prev_field: r.current_field, target_field: "supply", target_roles: ["operations manager", "supply chain analyst"], locations: ["Providence, RI", "Boston, MA"], remote_pref: "any", salary_floor: 65000 }).eq("id", userId);

  step(5, "search real listings and check company careers pages");
  const s = await call(token, "jobs/search", {});
  console.log(`   ${s.took} | ${s.json.total} listings | verified live: ${s.json.verified} | agency: ${s.json.agencies} | ghost risk: ${s.json.ghostRisk}`);
  const { data: rows } = await admin.from("jobs").select("id, title, company, company_site_status, ats_provider, legit").in("id", s.json.ids).limit(40);
  const byStatus = rows.reduce((a, j) => ((a[j.company_site_status] = (a[j.company_site_status] || 0) + 1), a), {});
  console.log("   company site status:", JSON.stringify(byStatus), "| badges:", JSON.stringify(rows.reduce((a, j) => ((a[j.legit.badge] = (a[j.legit.badge] || 0) + 1), a), {})));
  for (const j of rows.filter((j) => j.ats_provider).slice(0, 3)) console.log(`   direct: ${j.title} @ ${j.company} via ${j.ats_provider} -> ${j.legit.badge} ${j.legit.score}`);

  step(6, "score every listing (2 parallel batches of 15)");
  const t6 = Date.now();
  const batches = [s.json.ids.slice(0, 15), s.json.ids.slice(15, 30)].filter((c) => c.length);
  const scored = await Promise.all(batches.map((c) => call(token, "jobs/match", { ids: c, mode: "score" })));
  console.log("   " + ms(t6) + " | scored " + scored.reduce((n, x) => n + x.json.scored, 0));
  const { data: matches } = await admin.from("job_matches").select("score, breakdown, why, career_changer_friendly, translator, jobs(title, company)").eq("user_id", userId).order("score", { ascending: false });
  for (const x of matches.slice(0, 8)) console.log("   " + String(x.score).padStart(3) + "  " + x.jobs.title + " @ " + x.jobs.company + "  [ccf:" + x.career_changer_friendly + ", " + x.translator.field + "]");
  console.log("   lowest:", matches[matches.length - 1].score, "| top why:", matches[0].why);

  step("6b", "full analysis of the top 2 jobs");
  const t6b = Date.now();
  const topIds = (await admin.from("job_matches").select("job_id").eq("user_id", userId).order("score", { ascending: false }).limit(2)).data.map((x) => x.job_id);
  const det = await call(token, "jobs/match", { ids: topIds, mode: "detail" });
  console.log("   " + ms(t6b) + " | enriched " + det.json.enriched);
  const { data: fullRows } = await admin.from("job_matches").select("why, gaps, translator, jobs(title, company)").eq("user_id", userId).in("job_id", topIds);
  const top = fullRows[0];
  console.log("   " + top.jobs.title + " @ " + top.jobs.company);
  console.log("   story:", top.translator.story);
  console.log("   translations:", JSON.stringify(top.translator.translations).slice(0, 380));
  console.log("   requirements:", top.translator.requirements.map((q) => q.status + ": " + q.text.slice(0, 40)).join(" | "));
  console.log("   gaps:", top.gaps.map((g) => g.id + "(" + g.severity + ")").join(", "));

  step(7, "translator");
  const tr = await call(token, "translate", { target: "program" });
  console.log(`   ${tr.took} | ${tr.json.rows.length} rows | first:`, JSON.stringify(tr.json.rows[0]));

  step(8, "verify on company site");
  const withBoard = rows.find((j) => j.company_site_status === "confirmed") ?? rows.find((j) => j.ats_provider) ?? rows[0];
  const v = await call(token, "jobs/verify", { jobId: withBoard.id });
  console.log(`   ${v.took} | ${v.json.status} | ${v.json.message}`);

  step(9, "streaming chat");
  const t0 = Date.now();
  const cr = await fetch(`${BASE}/api/chat`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ messages: [{ role: "user", content: "In two sentences, am I a real candidate for the top match, and what is my biggest gap?" }] }) });
  const reader = cr.body.getReader();
  const dec = new TextDecoder();
  let full = "";
  let chunks = 0;
  let firstAt = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!firstAt) firstAt = Date.now() - t0;
    chunks++;
    full += dec.decode(value);
  }
  console.log(`   status ${cr.status} | first chunk ${firstAt}ms | ${chunks} chunks | total ${ms(t0)}`);
  console.log("   reply:", full.replace(/\n+/g, " ").slice(0, 500));
  console.log("   contains em dash:", /—/.test(full), "| exclamation:", /!/.test(full));

  step(10, "RLS: another user cannot see this user's data");
  const email2 = `cq-e2e-b-${stamp}@example.com`;
  const { data: u2 } = await admin.auth.admin.createUser({ email: email2, password, email_confirm: true });
  const other = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  await other.auth.signInWithPassword({ email: email2, password });
  const peek = await other.from("resumes").select("id");
  const peek2 = await other.from("job_matches").select("job_id");
  const jobsVisible = await other.from("jobs").select("id").limit(1);
  console.log(`   other user sees resumes: ${peek.data?.length}, matches: ${peek2.data?.length}, shared jobs cache readable: ${jobsVisible.data?.length === 1}`);
  await admin.auth.admin.deleteUser(u2.user.id);

  console.log("\nALL STEPS COMPLETED");
} catch (e) {
  console.error("\nFAILED:", e.message ?? e);
  process.exitCode = 1;
} finally {
  if (userId) {
    await admin.auth.admin.deleteUser(userId);
    console.log("cleanup: test user deleted");
  }
}
