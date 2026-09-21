// Exercises the Resume Studio, Cover Letter and Interview Prep endpoints against
// a throwaway account with a real parsed resume, then deletes it.
// Run with the dev server up:  node scripts/e2e-studio.mjs
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local", quiet: true });
const BASE = process.env.E2E_BASE || "http://127.0.0.1:5173";
const db = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });

const stamp = Date.now();
const email = `cq-studio-${stamp}@careerquest-probe.com`;
const password = `Test-${stamp}-pw!`;

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

// A fictional resume, so nothing real is sent anywhere.
const RESUME = {
  name: "Dana Whitfield",
  email: "dana.whitfield@example.com",
  phone: "(555) 555-0147",
  location: "Providence, RI",
  summary: "Retail operations manager with seven years running high volume stores, known for inventory accuracy and fixing broken processes.",
  roles: [
    {
      id: "role-1",
      title: "Store Operations Manager",
      company: "Bayside Home Goods",
      location: "Providence, RI",
      start: "Mar 2021",
      end: "Aug 2026",
      bullets: [
        { id: "b1", text: "Ran receiving, stockroom and floor operations for a store doing $9M a year." },
        { id: "b2", text: "Cut shrink from 2.4% to 1.1% by redesigning receiving checks and cycle counts." },
        { id: "b3", text: "Led a team of 28 associates and 4 supervisors across two shifts." },
        { id: "b4", text: "Built weekly Excel reports on sales, labour and shrink for the district manager." },
      ],
    },
  ],
  education: ["B.A. Communications, University of Rhode Island, 2015"],
  certifications: ["Lean Six Sigma Yellow Belt, 2022"],
  skills: ["Inventory control", "Team leadership", "Excel", "Vendor management"],
};

let userId = null;

async function call(token, payload) {
  const r = await fetch(`${BASE}/api/studio`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
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
  console.log("\n[1] Setting up a throwaway account with a resume and a real cached job");
  const created = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw new Error(created.error.message);
  userId = created.data.user.id;
  const { data: session } = await anon.auth.signInWithPassword({ email, password });
  const token = session.session.access_token;

  await db.from("resumes").insert({ user_id: userId, file_name: "dana.pdf", is_base: true, parsed: RESUME });

  // Use a real listing already in the shared cache.
  const { data: job } = await db.from("jobs").select("id, title, company").not("description", "is", null).limit(1).maybeSingle();
  if (!job) throw new Error("No cached job with a description. Run a search first.");
  console.log(`  job: ${job.title} at ${job.company}`);

  console.log("\n[2] Access control");
  ok("no token is refused", (await fetch(`${BASE}/api/studio`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })).status === 401);
  ok("unknown action is rejected", (await call(token, { action: "nope" })).status === 400);

  console.log("\n[3] Resume Studio");
  const t0 = Date.now();
  const tailored = await call(token, { action: "tailor", jobId: job.id });
  ok("tailor returns changes", tailored.status === 200 && Array.isArray(tailored.json?.changes) && tailored.json.changes.length > 0, `${tailored.json?.changes?.length} changes in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  const resumeCorpus = JSON.stringify(RESUME).toLowerCase().replace(/,/g, "");
  const changes = tailored.json?.changes ?? [];
  const invented = changes.filter((c) => {
    const nums = (c.tailored ?? "").toLowerCase().replace(/,/g, "").match(/\d+(?:\.\d+)?/g) ?? [];
    return nums.some((n) => !resumeCorpus.includes(n));
  });
  ok("no change invents a number", invented.length === 0, invented.length ? invented[0].tailored.slice(0, 80) : "every number traces to the resume");
  ok("every change cites a source line", changes.every((c) => !!c.sourceId));
  ok("only Truth Mode change types", changes.every((c) => ["reorder", "reword", "emphasize", "format"].includes(c.type)));

  console.log("\n[4] Cover Letter Studio");
  const letter = await call(token, { action: "letter", jobId: job.id, tone: "warm", addressGaps: [] });
  ok("letter returns paragraphs", letter.status === 200 && letter.json?.paragraphs?.length > 0, `${letter.json?.paragraphs?.length} paragraphs`);
  ok("letter has a greeting", !!letter.json?.greeting, letter.json?.greeting);
  const body = (letter.json?.paragraphs ?? []).map((p) => p.text).join(" ");
  ok("letter has no placeholder brackets", !/\[[A-Za-z ]+\]/.test(body));

  console.log("\n[5] Interview Prep");
  const qs = await call(token, { action: "questions", jobId: job.id });
  ok("questions returned", qs.status === 200 && qs.json?.questions?.length > 0, `${qs.json?.questions?.length} questions`);
  ok("each question explains itself", (qs.json?.questions ?? []).every((q) => !!q.why && !!q.tip));

  const FIXED_Q = "Tell me about a time you fixed a broken process.";
  const fb = await call(token, {
    action: "feedback",
    question: FIXED_Q,
    answer: "At Bayside Home Goods I redesigned our receiving checks and cycle counts because shrink had climbed to 2.4 percent. I rebuilt the count schedule, retrained four supervisors, and audited receiving daily for a month. Shrink came down to 1.1 percent and stayed there.",
  });
  ok("feedback scores the answer", fb.status === 200 && typeof fb.json?.score === "number", `score ${fb.json?.score}`);
  ok("a strong answer scores well", (fb.json?.score ?? 0) >= 70, `scored ${fb.json?.score}, expected 70 or more`);
  ok("feedback is specific", (fb.json?.strengths?.length ?? 0) > 0);

  const weak = await call(token, { action: "feedback", question: FIXED_Q, answer: "I am a hard worker and I always do my best. I like fixing things when they go wrong." });
  ok("a vague answer scores low", (weak.json?.score ?? 100) < 50, `scored ${weak.json?.score}, expected under 50`);

  console.log("\n[5b] Posting keywords");
  // Prefer a posting nobody has read yet, so the model path is what gets tested.
  const { data: fresh } = await db.from("jobs").select("id, title, description").is("keywords", null).gt("description", "").limit(1).maybeSingle();
  const kwJob = fresh ?? (await db.from("jobs").select("id, title, description").gt("description", "").limit(1).maybeSingle()).data;
  const k1 = await call(token, { action: "keywords", jobId: kwJob.id });
  ok("keywords come back as required and preferred lists", k1.status === 200 && Array.isArray(k1.json?.must) && Array.isArray(k1.json?.nice), `${k1.json?.must?.length} required, ${k1.json?.nice?.length} preferred, source ${k1.json?.source}`);
  ok("a posting yields some required terms", (k1.json?.must?.length ?? 0) >= ((kwJob.description ?? "").length >= 400 ? 3 : 1), `posting is ${(kwJob.description ?? "").length} characters`);
  // Every term must come from the posting. Compared loosely on word stems.
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ");
  const haystack = norm(`${kwJob.title} ${kwJob.description}`);
  const ungrounded = [...(k1.json?.must ?? []), ...(k1.json?.nice ?? [])].filter((t) => !norm(t).split(" ").filter(Boolean).every((w) => haystack.includes(w.slice(0, Math.max(4, w.length - 2)))));
  ok("every term traces back to the posting", ungrounded.length === 0, ungrounded.length ? `not found: ${ungrounded.join(", ")}` : "none invented");
  ok("no term is a paragraph", [...(k1.json?.must ?? []), ...(k1.json?.nice ?? [])].every((t) => t.length <= 48));
  const k2 = await call(token, { action: "keywords", jobId: kwJob.id });
  ok("the second read is served from the saved copy", k2.json?.source === "cache" || k1.json?.source === "basic", `source ${k2.json?.source}`);
  ok("the same terms come back", JSON.stringify(k2.json?.must) === JSON.stringify(k1.json?.must) || k1.json?.source === "basic");
  ok("an unknown job is a 404, not a crash", (await call(token, { action: "keywords", jobId: "nope:0" })).status === 404);

  console.log("\n[6] Free plan metering");
  const spend = [];
  for (let i = 0; i < 3; i++) spend.push((await call(token, { action: "letter", jobId: job.id, tone: "direct", addressGaps: [] })).status);
  ok("free letters run out", spend.includes(402), `statuses: ${spend.join(", ")}`);

  console.log("\n[7] Rows reached the database");
  const { count: usage } = await db.from("usage_counters").select("*", { count: "exact", head: true }).eq("user_id", userId);
  ok("usage was counted", (usage ?? 0) > 0);
  const { count: attempts } = await db.from("practice_attempts").select("*", { count: "exact", head: true }).eq("user_id", userId);
  console.log(`  (practice_attempts written by the browser, not this script: ${attempts ?? 0})`);
} catch (e) {
  fail++;
  console.error("\nThrew:", e.message);
} finally {
  console.log("\n[cleanup] removing the throwaway account");
  if (userId) await db.auth.admin.deleteUser(userId).catch(() => {});
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
}
