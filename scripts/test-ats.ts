// Tests for the ATS scorer and the keyword tools. No network, no database.
// Run:  npm run test:ats
import assert from "node:assert/strict";
import { scoreResume, type ResumeLike } from "../src/lib/ats";
import { extractKeywordsBasic, stem, tokens, verbatim } from "../src/lib/keywords";

let pass = 0;
let fail = 0;
const test = (name: string, fn: () => void) => {
  try {
    fn();
    pass++;
    console.log(`  PASS  ${name}`);
  } catch (e) {
    fail++;
    console.log(`  FAIL  ${name}\n        ${(e as Error).message.split("\n")[0]}`);
  }
};

const b = (id: string, text: string) => ({ id, text });

const STRONG: ResumeLike = {
  name: "Dana Whitfield",
  email: "dana.whitfield@example.com",
  phone: "(555) 555-0147",
  location: "Providence, RI",
  summary: "Retail operations manager with seven years running high volume stores, known for inventory accuracy, vendor management and fixing broken processes.",
  roles: [
    {
      id: "r1",
      title: "Store Operations Manager",
      company: "Bayside Home Goods",
      location: "Providence, RI",
      start: "Mar 2021",
      end: "Present",
      bullets: [
        b("b1", "Cut shrink from 2.4% to 1.1% by redesigning receiving checks and cycle counts across a $9M store."),
        b("b2", "Led a team of 28 associates and 4 supervisors across two shifts, reducing overtime by 18%."),
        b("b3", "Negotiated terms with 14 vendors, recovering $210K in damaged goods credits over two years."),
        b("b4", "Built weekly Excel reports on sales, labor and shrink that the district manager used to plan staffing."),
      ],
    },
    {
      id: "r2",
      title: "Assistant Manager",
      company: "Harbor Hardware",
      location: "Warwick, RI",
      start: "Jun 2018",
      end: "Feb 2021",
      bullets: [
        b("b5", "Trained 40 associates on the new point of sale system, cutting checkout errors by 30%."),
        b("b6", "Managed weekly replenishment orders for 6 departments, lowering stockouts by 22%."),
        b("b7", "Resolved 95% of customer escalations on the first call, improving satisfaction scores."),
      ],
    },
  ],
  education: ["B.A. Communications, University of Rhode Island, 2015"],
  certifications: ["Lean Six Sigma Yellow Belt, 2022"],
  skills: ["Inventory control", "Vendor management", "Excel", "Team leadership", "Cycle counting", "Scheduling"],
};

const WEAK: ResumeLike = {
  name: "D",
  email: "not-an-email",
  phone: "555",
  location: "",
  summary: "Hard worker.",
  roles: [
    {
      id: "r1",
      title: "Manager",
      company: "Store",
      start: "2018",
      end: "",
      bullets: [b("b1", "Responsible for the store."), b("b2", "Helped with stuff and various tasks that came up every day")],
    },
  ],
  education: [],
  certifications: [],
  skills: ["people"],
};

const clone = <T,>(x: T): T => structuredClone(x);

console.log("\n[1] The score is measured, not a starting number plus bonuses");
test("a strong resume and a weak one land far apart", () => {
  const s = scoreResume(STRONG, null).total;
  const w = scoreResume(WEAK, null).total;
  assert.ok(s - w >= 35, `strong ${s}, weak ${w}, expected a gap of at least 35`);
});
test("the weak resume is not handed a comfortable baseline", () => {
  const w = scoreResume(WEAK, null).total;
  assert.ok(w < 40, `weak resume scored ${w}, expected under 40`);
});
test("a well built resume scores well", () => {
  const s = scoreResume(STRONG, null).total;
  assert.ok(s >= 80, `strong resume scored ${s}, expected 80 or more`);
});
test("changing one line moves the score", () => {
  const r = clone(STRONG);
  const before = scoreResume(r, null).total;
  r.roles[0].bullets[0].text = "Was responsible for the store.";
  const after = scoreResume(r, null).total;
  assert.ok(after < before, `before ${before}, after ${after}`);
});
test("adding a number to a line raises the score", () => {
  const r = clone(WEAK);
  const before = scoreResume(r, null).total;
  r.roles[0].bullets[0].text = "Ran a store with 12 employees and reduced shrink by 20%.";
  const after = scoreResume(r, null).total;
  assert.ok(after > before, `before ${before}, after ${after}`);
});
test("a broken email and phone cost points", () => {
  const good = scoreResume(STRONG, null).total;
  const r = clone(STRONG);
  r.email = "nope";
  r.phone = "12";
  assert.ok(scoreResume(r, null).total < good);
});
test("total always stays between 0 and 100", () => {
  for (const r of [STRONG, WEAK, { ...WEAK, roles: [], summary: "" } as ResumeLike]) {
    const t = scoreResume(r, { must: ["excel"], nice: [] }).total;
    assert.ok(t >= 0 && t <= 100, `got ${t}`);
  }
});

console.log("\n[2] Keywords: covered, likely, missing");
const POSTING = { must: ["vendor management", "cycle counting", "Kronos", "inventory control"], nice: ["six sigma", "Tableau"] };
test("a phrase that is written out is covered", () => {
  const k = scoreResume(STRONG, POSTING).keywords;
  assert.equal(k.find((x) => x.term === "inventory control")?.status, "covered");
  assert.equal(k.find((x) => x.term === "vendor management")?.status, "covered");
});
test("different word endings still count as covered", () => {
  // The resume says "cycle counts" and the skills line says "Cycle counting".
  const k = scoreResume(STRONG, POSTING).keywords;
  assert.equal(k.find((x) => x.term === "cycle counting")?.status, "covered");
});
test("a term the resume never mentions is missing", () => {
  const k = scoreResume(STRONG, POSTING).keywords;
  assert.equal(k.find((x) => x.term === "Kronos")?.status, "missing");
  assert.equal(k.find((x) => x.term === "Tableau")?.status, "missing");
});
test("something described but not named is likely", () => {
  const r = clone(STRONG);
  r.skills = ["Excel", "Team leadership"];
  r.summary = "Retail operations manager with seven years running high volume stores.";
  r.roles[0].bullets[2].text = "Negotiated with 14 vendors on delivery schedules, recovering $210K in credits.";
  const k = scoreResume(r, { must: ["vendor management"], nice: [] }).keywords;
  assert.equal(k[0].status, "likely", `got ${k[0].status}`);
});
test("likely earns some credit, but far less than covered", () => {
  const covered = scoreResume(STRONG, { must: ["vendor management"], nice: [] }).parts.find((p) => p.key === "keywords")!.score;
  const r = clone(STRONG);
  r.skills = ["Excel"];
  r.summary = "Retail operations manager with seven years running high volume stores.";
  r.roles[0].bullets[2].text = "Negotiated with 14 vendors on delivery schedules, recovering $210K in credits.";
  const likely = scoreResume(r, { must: ["vendor management"], nice: [] }).parts.find((p) => p.key === "keywords")!.score;
  assert.ok(likely > 0 && likely < covered * 0.5, `covered ${covered}, likely ${likely}`);
});
test("a required term is worth more than a preferred one", () => {
  const r = { ...clone(STRONG), skills: ["Excel"] };
  const must = scoreResume(r, { must: ["kronos"], nice: ["excel"] }).keywords;
  assert.equal(must.find((x) => x.term === "kronos")?.weight, 2);
  assert.equal(must.find((x) => x.term === "excel")?.weight, 1);
});
test("with a posting, keyword coverage is part of the score", () => {
  const withPosting = scoreResume(STRONG, POSTING);
  assert.equal(withPosting.general, false);
  assert.ok(withPosting.parts.some((p) => p.key === "keywords"));
});
test("without a posting the score is general and still out of 100", () => {
  const g = scoreResume(STRONG, null);
  assert.equal(g.general, true);
  assert.ok(!g.parts.some((p) => p.key === "keywords"));
  assert.ok(Math.abs(g.parts.reduce((n, p) => n + p.max, 0) - 100) < 0.01);
});
test("a resume that covers the posting beats one that does not", () => {
  const a = scoreResume(STRONG, { must: ["inventory control", "vendor management"], nice: [] }).total;
  const bad = clone(STRONG);
  bad.skills = ["Teamwork"];
  bad.summary = "Manager with experience.";
  const c = scoreResume(bad, { must: ["inventory control", "vendor management"], nice: [] }).total;
  assert.ok(a > c + 10, `covering ${a}, not covering ${c}`);
});

console.log("\n[3] The fix list");
test("fixes are sorted, worth points, and point at something", () => {
  const r = scoreResume(WEAK, POSTING);
  assert.ok(r.fixes.length >= 5, `only ${r.fixes.length} fixes`);
  for (let i = 1; i < r.fixes.length; i++) assert.ok(r.fixes[i - 1].points >= r.fixes[i].points, "not sorted");
  assert.ok(r.fixes.every((f) => f.points > 0 && f.label && f.detail));
});
test("doing the top fix really does raise the score", () => {
  const r = clone(WEAK);
  const before = scoreResume(r, null);
  const top = before.fixes[0];
  assert.ok(top.points >= 2, `top fix only worth ${top.points}`);
  // Apply a plausible fix for whatever the top item is.
  if (top.id.startsWith("bl:")) {
    r.roles[0].bullets[0].text = "Managed daily operations for a store of 12 employees, reducing shrink by 20% in one year.";
  } else if (top.id.startsWith("contact:")) {
    r.email = "dana@example.com";
    r.phone = "(555) 555-0147";
    r.name = "Dana Whitfield";
    r.location = "Providence, RI";
  } else {
    r.summary = "Store manager with six years running daily operations, focused on inventory accuracy and team development.";
    r.education = ["High school diploma, 2014"];
    r.skills = ["Inventory control", "Scheduling", "Excel", "Team leadership"];
  }
  const after = scoreResume(r, null).total;
  assert.ok(after > before.total, `before ${before.total}, after ${after}`);
});
test("a missing phone number is named as a fix", () => {
  const r = clone(STRONG);
  r.phone = "";
  assert.ok(scoreResume(r, null).fixes.some((f) => f.id === "contact:phone"));
});
test("a duty-style line is called out as weak", () => {
  const rep = scoreResume(WEAK, null).bullets.find((x) => x.id === "b1")!;
  assert.equal(rep.weakStart, true);
  assert.equal(rep.hasVerb, false);
  assert.equal(rep.hasNumber, false);
});
test("a strong line has a verb, a result and a number", () => {
  const rep = scoreResume(STRONG, null).bullets.find((x) => x.id === "b1")!;
  assert.deepEqual([rep.hasVerb, rep.hasResult, rep.hasNumber], [true, true, true]);
});
test("keyword fixes point at the skills line, or at where the idea already is", () => {
  const f = scoreResume(STRONG, POSTING).fixes.find((x) => x.id === "kw:Kronos")!;
  assert.equal(f.field, "skills");
});

console.log("\n[4] Length");
test("a tiny resume is flagged as not filling the page", () => {
  const r = scoreResume(WEAK, null);
  assert.ok(r.fill < 0.6, `fill ${r.fill}`);
  assert.ok(r.fixes.some((f) => f.id === "len:under"));
});
test("a very long resume is flagged as running over", () => {
  const r = clone(STRONG);
  for (let i = 0; i < 6; i++) r.roles.push({ ...clone(r.roles[0]), id: `x${i}`, bullets: r.roles[0].bullets.map((x) => ({ id: `${x.id}-${i}`, text: x.text })) });
  const res = scoreResume(r, null);
  assert.ok(res.fill > 1.2, `fill ${res.fill}`);
  assert.ok(res.fixes.some((f) => f.id === "len:over"));
});
test("a resume that fills one page earns full length marks", () => {
  // Three roles with four solid lines each, and a real summary, is a full page.
  const r = clone(STRONG);
  r.roles[1].bullets.push(b("b8", "Opened the store's first weekend team, covering 3 peak shifts and raising weekend sales by 12%."));
  r.roles.push({
    id: "r3",
    title: "Sales Associate",
    company: "Ocean State Outfitters",
    location: "Cranston, RI",
    start: "Jun 2015",
    end: "May 2018",
    bullets: [
      b("b9", "Sold an average of $4,200 a week, ranking first among 18 associates for 3 quarters running."),
      b("b10", "Trained 12 new hires on the register and returns process, cutting onboarding time by 2 days."),
      b("b11", "Reconciled the daily cash drawer to the penny across 300 shifts with no unexplained shortages."),
      b("b12", "Rebuilt the stockroom layout so top sellers were reachable in under a minute, reducing restock time by 25%."),
    ],
  });
  r.summary = `${r.summary} Trained more than 50 associates, negotiated with 14 vendors, and led two store openings. Known for calm leadership under pressure and for turning messy processes into simple checklists people actually follow.`;
  const res = scoreResume(r, null);
  const len = res.parts.find((p) => p.key === "length")!;
  assert.ok(len.score >= len.max * 0.99, `length ${len.score.toFixed(1)} of ${len.max.toFixed(1)}, fill ${res.fill.toFixed(2)}`);
});
test("a resume with only two roles is honestly told it has room", () => {
  const res = scoreResume(STRONG, null);
  assert.ok(res.fill < 0.82 && res.linesFree >= 5, `fill ${res.fill.toFixed(2)}, free ${res.linesFree}`);
});

console.log("\n[5] Stemming and extraction");
test("word forms agree", () => {
  for (const group of [["manage", "managed", "managing", "management", "manager"], ["plan", "planning", "planned"], ["vendor", "vendors"], ["inventory", "inventories"]]) {
    const s = new Set(group.map(stem));
    assert.equal(s.size, 1, `${group.join(", ")} -> ${[...s].join(", ")}`);
  }
});
test("unrelated words stay apart", () => {
  assert.notEqual(stem("finance"), stem("financial") + "x");
  assert.notEqual(stem("sales"), stem("service"));
  assert.notEqual(stem("inventory"), stem("invention"));
});
test("known abbreviations match their long forms", () => {
  assert.deepEqual(tokens("profit and loss"), tokens("P&L"));
  assert.deepEqual(tokens("key performance indicators"), tokens("KPIs"));
  assert.deepEqual(tokens("Microsoft Excel"), tokens("Excel"));
});
test("required and preferred terms are told apart", () => {
  const kw = extractKeywordsBasic({
    required: ["3+ years of inventory management experience", "Proficient in Excel and SQL"],
    preferred: ["Kronos experience is a plus", "Six Sigma certification"],
  });
  assert.ok(kw.must.includes("excel") && kw.must.includes("sql"), `must: ${kw.must.join(", ")}`);
  assert.ok(kw.must.includes("inventory management"), `must: ${kw.must.join(", ")}`);
  assert.ok(kw.nice.includes("kronos") && kw.nice.includes("six sigma"), `nice: ${kw.nice.join(", ")}`);
});
test("free text under a preferred heading counts as preferred", () => {
  const kw = extractKeywordsBasic({
    body: "Requirements\nExperience with vendor management and Excel.\nPreferred qualifications\nSix Sigma green belt. Tableau.",
  });
  assert.ok(kw.must.includes("vendor management"), `must: ${kw.must.join(", ")}`);
  assert.ok(kw.nice.includes("tableau"), `nice: ${kw.nice.join(", ")}`);
});
test("a near miss is replaced by the posting's own words", () => {
  const text = "We are hiring a Delivery Driver for our Boston depot. Experience with route planning helps.";
  assert.equal(verbatim(text, "delivery driving"), "Delivery Driver");
  assert.equal(verbatim(text, "route planning"), "route planning");
});
test("an abbreviation resolves to what the posting actually wrote", () => {
  assert.equal(verbatim("Must know our WMS well.", "warehouse management system"), "WMS");
});
test("a term the posting never says has no verbatim form", () => {
  assert.equal(verbatim("We sell mattresses in Boston.", "forklift certification"), null);
});
test("nothing is invented from a posting with no known terms", () => {
  const kw = extractKeywordsBasic({ body: "We are a friendly company with great snacks and a dog." });
  assert.equal(kw.must.length + kw.nice.length, 0);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
