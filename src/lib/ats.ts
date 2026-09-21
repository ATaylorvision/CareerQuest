import { containsRun, stem, tokens, type PostingKeywords } from "./keywords";

/**
 * An estimate of how screening software will read a resume.
 *
 * It is measured from the resume itself. Nothing here is a starting number
 * that suggestions add to: change one word and the score can move, and two
 * different resumes start in different places. It is still an estimate. We are
 * not running anyone's real system, and the interface says so.
 *
 * Scored out of 100:
 *   35  keyword coverage against the posting        (skipped when no posting)
 *   25  bullet quality: action verb, result, number
 *   20  structure: contact, complete roles, dates, enough lines per role
 *   10  length: does it fill one page without spilling onto a second
 *   10  sections: summary, experience, education, skills
 */

export interface ResumeLike {
  name: string;
  email: string;
  phone: string;
  location: string;
  summary: string;
  roles: { id: string; title: string; company: string; location?: string; start: string; end: string; bullets: { id: string; text: string }[] }[];
  education: string[];
  certifications: string[];
  skills: string[];
}

export type KeywordStatus = "covered" | "likely" | "missing";

export interface KeywordResult {
  term: string;
  /** 2 for something the posting requires, 1 for a preference. */
  weight: 1 | 2;
  status: KeywordStatus;
  /** Where on the document it was found, so the panel can point at it. */
  where?: string;
}

export interface AtsFix {
  id: string;
  label: string;
  detail: string;
  /** Points recovered on the 0 to 100 scale if this is done. */
  points: number;
  /** Document field to jump to. */
  field?: string;
}

export interface BulletReport {
  id: string;
  text: string;
  role: string;
  hasVerb: boolean;
  weakStart: boolean;
  hasResult: boolean;
  hasNumber: boolean;
  tooLong: boolean;
  tooShort: boolean;
  /** 0 to 3. */
  points: number;
}

export interface AtsPart {
  key: "keywords" | "bullets" | "structure" | "length" | "sections";
  label: string;
  score: number;
  max: number;
  note: string;
}

export interface AtsResult {
  total: number;
  /** True when there is no posting to compare against, so the score covers the other four parts. */
  general: boolean;
  parts: AtsPart[];
  keywords: KeywordResult[];
  fixes: AtsFix[];
  bullets: BulletReport[];
  /** Estimated share of one page the text fills. 1 is exactly one page. */
  fill: number;
  /** Rough lines still free on the page, or negative when over. */
  linesFree: number;
}

/* ------------------------------------------------------------------ */
/* Bullet quality                                                      */
/* ------------------------------------------------------------------ */

const VERB_BASES =
  "manage lead build run drive cut grow write teach make sell set keep hold bring begin find give hire pay send shape develop create design implement launch reduce increase improve save deliver achieve exceed recover win coordinate direct supervise train coach mentor analyze analyse streamline eliminate negotiate secure standardize standardise automate migrate consolidate resolve prevent forecast plan budget oversee own establish organize organise maintain monitor audit review evaluate prepare present report track schedule dispatch process resolve handle support serve advise consult partner collaborate facilitate execute deploy configure integrate optimize optimise upgrade redesign rebuild restructure revamp renegotiate cultivate expand accelerate generate identify investigate document draft edit publish perform operate administer allocate assign assess authorize calculate certify clarify communicate compile complete conduct control convert customize decrease define demonstrate diagnose distribute enforce enhance ensure examine expedite guide inspect install instruct interview introduce inventory maximize minimize modernize motivate onboard originate outperform overhaul pilot procure produce promote propose provide recruit reconcile refine reorganize replace represent research resolve retain revise scale screen select simplify spearhead sponsor stabilize steer strengthen supply surpass sustain tailor test transform troubleshoot unify update validate verify visualize".split(
    " ",
  );

const VERB_STEMS = new Set(VERB_BASES.map(stem));
const IRREGULAR = new Set("led built ran drove cut grew wrote taught made sold set kept held brought began found gave hired paid sent shaped won oversaw took chose spent stood".split(" "));

const WEAK_START = /^(responsible for|responsibilities (include|included)|duties (include|included)|in charge of|helped|assisted|worked (on|with)|tasked with|involved in|participated in|handled|was |were |am |is |various |many |some )/i;

const RESULT_WORDS =
  /\b(reduc\w*|increas\w*|improv\w*|sav(ed|ing|ings)|cut|grew|grow\w*|boost\w*|generat\w*|deliver\w*|achiev\w*|exceed\w*|recover\w*|won|win|launch\w*|accelerat\w*|streamlin\w*|eliminat\w*|lower\w*|rais\w*|expand\w*|doubl\w*|tripl\w*|halv\w*|result(ed|ing)|leading to|so that|which (led|helped|allowed|reduced|saved)|ahead of|under budget|on time|on schedule)\b/i;

const CHARS_TOO_LONG = 230;
const CHARS_TOO_SHORT = 30;

function analyseBullet(id: string, text: string, role: string): BulletReport {
  const t = text.trim();
  const first = (t.match(/^[A-Za-z][A-Za-z'-]*/)?.[0] ?? "").toLowerCase();
  const weakStart = WEAK_START.test(t);
  const looksLikeVerb = !!first && (IRREGULAR.has(first) || VERB_STEMS.has(stem(first)) || (first.endsWith("ed") && first.length > 3));
  const hasVerb = looksLikeVerb && !weakStart;
  const hasNumber = /\d/.test(t);
  // A number on its own is not a result, but a change over time with numbers is.
  const hasResult = RESULT_WORDS.test(t) || /\bfrom\b[^.]*\d[^.]*\bto\b[^.]*\d/i.test(t);
  const tooLong = t.length > CHARS_TOO_LONG;
  const tooShort = t.length < CHARS_TOO_SHORT || t.split(/\s+/).length < 5;
  const raw = (hasVerb ? 1 : 0) + (hasResult ? 1 : 0) + (hasNumber ? 1 : 0) - (tooLong ? 0.5 : 0) - (tooShort ? 0.5 : 0);
  return { id, text: t, role, hasVerb, weakStart, hasResult, hasNumber, tooLong, tooShort, points: Math.max(0, raw) };
}

/* ------------------------------------------------------------------ */
/* Length, estimated                                                   */
/* ------------------------------------------------------------------ */

/** Characters that fit on one line of body text, and lines that fit on a page. */
const CHARS_PER_LINE = 92;
export const PAGE_LINES = 50;

/**
 * A rough count of how many lines the text will take. Good enough to tell
 * "half a page" from "spills onto two"; the download step measures for real.
 */
export function estimateLines(r: ResumeLike): number {
  const wrap = (s: string, w = CHARS_PER_LINE) => Math.max(1, Math.ceil(s.trim().length / w));
  let lines = 3;
  if (r.summary.trim()) lines += 1 + wrap(r.summary) + 0.5;
  lines += 1.5;
  for (const role of r.roles) {
    lines += 2;
    for (const b of role.bullets) lines += wrap(b.text, CHARS_PER_LINE - 4);
    lines += 0.7;
  }
  if (r.education.length) lines += 1.5 + wrap(r.education.join(" | "));
  if (r.certifications.length) lines += 1 + wrap(r.certifications.join(" | "));
  if (r.skills.length) lines += 1.5 + wrap(r.skills.join(", "));
  return lines;
}

/* ------------------------------------------------------------------ */
/* Keywords                                                            */
/* ------------------------------------------------------------------ */

const CREDIT: Record<KeywordStatus, number> = { covered: 1, likely: 0.3, missing: 0 };

interface Segment {
  field: string;
  tokens: string[];
}

function segmentsOf(r: ResumeLike): Segment[] {
  const seg: Segment[] = [];
  if (r.summary.trim()) seg.push({ field: "summary", tokens: tokens(r.summary) });
  for (const role of r.roles) {
    seg.push({ field: `${role.id}.title`, tokens: tokens(role.title) });
    for (const b of role.bullets) seg.push({ field: b.id, tokens: tokens(b.text) });
  }
  for (const s of r.skills) seg.push({ field: "skills", tokens: tokens(s) });
  for (const c of r.certifications) seg.push({ field: "certifications", tokens: tokens(c) });
  for (const e of r.education) seg.push({ field: "education", tokens: tokens(e) });
  return seg;
}

function classify(term: string, weight: 1 | 2, segs: Segment[], all: Set<string>): KeywordResult | null {
  const run = tokens(term);
  if (!run.length) return null;

  for (const s of segs) if (containsRun(s.tokens, run)) return { term, weight, status: "covered", where: s.field };

  if (run.length >= 2) {
    // Everything is there but not side by side, for example "managed 14 vendors" for "vendor management".
    const together = segs.find((s) => run.every((t) => s.tokens.includes(t)));
    if (together) return { term, weight, status: "likely", where: together.field };
    // Or most of it, including the noun the phrase is really about.
    const present = run.filter((t) => all.has(t));
    const head = run[run.length - 1];
    if (present.length >= Math.ceil(run.length / 2) && all.has(head)) {
      const at = segs.find((s) => s.tokens.includes(head));
      return { term, weight, status: "likely", where: at?.field };
    }
  }
  return { term, weight, status: "missing" };
}

/* ------------------------------------------------------------------ */
/* Scoring                                                             */
/* ------------------------------------------------------------------ */

const KW_MAX = 35;
const BULLET_MAX = 25;
const STRUCT_MAX = 20;
const LENGTH_MAX = 10;
const SECTION_MAX = 10;

const YEAR = /\b(19|20)\d{2}\b/;
const PRESENT = /\b(present|current|now)\b/i;
const short = (s: string, n = 46) => (s.length > n ? `${s.slice(0, n).trimEnd()}…` : s);

export function scoreResume(r: ResumeLike, posting: PostingKeywords | null): AtsResult {
  const fixes: AtsFix[] = [];
  const hasPosting = !!posting && posting.must.length + posting.nice.length > 0;
  const general = !hasPosting;
  // Without a posting the keyword part is dropped and the rest is stretched to 100.
  const k = general ? 100 / (100 - KW_MAX) : 1;
  const add = (f: AtsFix) => {
    if (f.points > 0.05) fixes.push({ ...f, points: f.points * k });
  };

  /* ---- keywords ---- */
  const segs = segmentsOf(r);
  const all = new Set(segs.flatMap((s) => s.tokens));
  const keywords: KeywordResult[] = [];
  let kwScore = 0;
  if (hasPosting) {
    const seen = new Set<string>();
    const list: [string, 1 | 2][] = [...posting!.must.map((t): [string, 1 | 2] => [t, 2]), ...posting!.nice.map((t): [string, 1 | 2] => [t, 1])];
    for (const [term, w] of list) {
      const key = tokens(term).join(" ");
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const res = classify(term, w, segs, all);
      if (res) keywords.push(res);
    }
    const totalW = keywords.reduce((n, x) => n + x.weight, 0) || 1;
    kwScore = keywords.reduce((n, x) => n + (KW_MAX * x.weight * CREDIT[x.status]) / totalW, 0);
    for (const x of keywords) {
      if (x.status === "covered") continue;
      const worth = (KW_MAX * x.weight) / totalW;
      const recover = worth * (1 - CREDIT[x.status]);
      fixes.push({
        id: `kw:${x.term}`,
        label: x.status === "likely" ? `Say "${x.term}" outright` : `Add "${x.term}" if you have it`,
        detail:
          x.status === "likely"
            ? `You describe something close, but the phrase itself is missing. ${x.weight === 2 ? "The posting asks for it." : "The posting prefers it."}`
            : `${x.weight === 2 ? "The posting asks for this." : "The posting prefers this."} Only add it if it is true.`,
        points: recover,
        field: x.status === "likely" ? x.where : "skills",
      });
    }
  }

  /* ---- bullets ---- */
  const bullets: BulletReport[] = r.roles.flatMap((role) => role.bullets.filter((b) => b.text.trim()).map((b) => analyseBullet(b.id, b.text, role.title)));
  const per = bullets.length ? BULLET_MAX / bullets.length : 0;
  const bulletScore = bullets.reduce((n, b) => n + (per * b.points) / 3, 0);
  for (const b of bullets) {
    const lacks: string[] = [];
    let lost = 0;
    if (!b.hasVerb) {
      lacks.push(b.weakStart ? "start with a strong action verb instead of a duty" : "start with an action verb");
      lost += per / 3;
    }
    if (!b.hasResult) {
      lacks.push("say what changed as a result");
      lost += per / 3;
    }
    if (!b.hasNumber) {
      lacks.push("add a number");
      lost += per / 3;
    }
    if (b.tooLong) {
      lacks.push("cut it to under two lines");
      lost += per / 6;
    }
    if (b.tooShort) {
      lacks.push("say a little more");
      lost += per / 6;
    }
    if (!lacks.length) continue;
    add({
      id: `bl:${b.id}`,
      label: `Strengthen "${short(b.text)}"`,
      detail: `Try to ${lacks.join(", ")}.`,
      points: lost,
      field: b.id,
    });
  }
  if (!bullets.length && r.roles.length) {
    add({ id: "bl:none", label: "Add lines under your roles", detail: "Screening software reads the lines under each role. There are none yet.", points: BULLET_MAX, field: `${r.roles[0].id}.title` });
  }

  /* ---- structure ---- */
  // Raw points: 8 for contact, 6 for complete roles, 3 for readable dates and up
  // to 1 per role for enough lines. Scaled so the whole part is worth 20.
  const n = r.roles.length;
  const sScale = STRUCT_MAX / (17 + n);
  const addS = (f: AtsFix) => add({ ...f, points: f.points * sScale });
  let structRaw = 0;

  const contact: [string, boolean, string][] = [
    ["name", r.name.trim().length >= 2, "contact.name"],
    ["email", /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email.trim()), "contact.email"],
    ["phone", r.phone.replace(/\D/g, "").length >= 10, "contact.phone"],
    ["city and state", r.location.trim().length >= 3, "contact.location"],
  ];
  for (const [what, ok, field] of contact) {
    if (ok) structRaw += 2;
    else addS({ id: `contact:${what}`, label: `Add your ${what}`, detail: "Recruiters and screening software look for it at the top.", points: 2, field });
  }

  if (n) {
    const complete = r.roles.filter((x) => x.title.trim() && x.company.trim() && x.start.trim() && x.end.trim());
    structRaw += (6 * complete.length) / n;
    for (const x of r.roles.filter((y) => !complete.includes(y))) {
      addS({ id: `role:${x.id}`, label: `Finish the details for "${short(x.title || x.company || "a role", 30)}"`, detail: "Each role needs a title, an employer, and both dates.", points: 6 / n, field: `${x.id}.title` });
    }
    const dated = r.roles.filter((x) => (YEAR.test(x.start) || /[A-Za-z]{3}/.test(x.start)) && (YEAR.test(x.end) || PRESENT.test(x.end)));
    structRaw += (3 * dated.length) / n;
    for (const x of r.roles.filter((y) => !dated.includes(y) && y.start.trim() && y.end.trim())) {
      addS({ id: `date:${x.id}`, label: `Write the dates for "${short(x.title || x.company, 30)}" as a month and year`, detail: "For example Mar 2022 to Present. Odd formats are easy for software to misread.", points: 3 / n, field: `${x.id}.start` });
    }
    for (const x of r.roles) {
      const c = x.bullets.filter((b) => b.text.trim()).length;
      structRaw += c >= 3 ? 1 : c === 2 ? 0.5 : 0;
      if (c < 3) {
        addS({ id: `thin:${x.id}`, label: `Add ${3 - c} more line${3 - c === 1 ? "" : "s"} under "${short(x.title || x.company, 30)}"`, detail: "Three lines per role reads as real experience. Only add what you actually did.", points: c === 2 ? 0.5 : 1, field: `${x.id}.title` });
      }
    }
  }
  const structure = structRaw * sScale;

  /* ---- sections ---- */
  let sections = 0;
  const words = r.summary.trim().split(/\s+/).filter(Boolean).length;
  if (words >= 15) sections += 3;
  else if (words >= 6) {
    sections += 1.5;
    add({ id: "sec:summary", label: "Lengthen your summary", detail: "Two or three sentences work best.", points: 1.5, field: "summary" });
  } else add({ id: "sec:summary", label: "Add a summary", detail: "Two or three sentences on the work you have done.", points: 3, field: "summary" });
  if (n >= 1) sections += 3;
  else add({ id: "sec:exp", label: "Add your work experience", detail: "It is the first thing screening software looks for.", points: 3 });
  if (r.education.length) sections += 2;
  else add({ id: "sec:edu", label: "Add your education", detail: "Include training and courses if you have no degree.", points: 2, field: "education" });
  if (r.skills.length >= 4) sections += 2;
  else if (r.skills.length >= 1) {
    sections += 1;
    add({ id: "sec:skills", label: "List a few more skills", detail: "Aim for six or more tools and skills you really use.", points: 1, field: "skills" });
  } else add({ id: "sec:skills", label: "Add a skills line", detail: "Tools and skills you really use, separated by commas.", points: 2, field: "skills" });

  /* ---- length ---- */
  const lines = estimateLines(r);
  const fill = lines / PAGE_LINES;
  let length: number;
  if (fill >= 0.82 && fill <= 1.02) length = LENGTH_MAX;
  else if (fill > 1.02) length = fill <= 1.12 ? 7 : fill <= 1.25 ? 4 : 2;
  else length = fill >= 0.65 ? 7 : fill >= 0.45 ? 4 : 2;
  const linesFree = Math.round(PAGE_LINES - lines);
  if (length < LENGTH_MAX) {
    add(
      fill < 0.82
        ? { id: "len:under", label: "Your resume does not fill a page", detail: `There is room for about ${Math.max(1, linesFree)} more lines. Add something real, not filler.`, points: LENGTH_MAX - length, field: r.roles[0] ? `${r.roles[0].id}.title` : undefined }
        : { id: "len:over", label: "Your resume runs past one page", detail: `About ${Math.max(1, -linesFree)} lines too many. Tighten the longest lines or drop the weakest.`, points: LENGTH_MAX - length },
    );
  }

  /* ---- assemble ---- */
  const parts: AtsPart[] = [];
  if (hasPosting) parts.push({ key: "keywords", label: "Keyword coverage", score: kwScore, max: KW_MAX, note: "Terms from the posting that appear in your resume." });
  parts.push(
    { key: "bullets", label: "Line quality", score: bulletScore * k, max: BULLET_MAX * k, note: "Action verb, a result, and a number." },
    { key: "structure", label: "Structure", score: structure * k, max: STRUCT_MAX * k, note: "Contact details, complete roles, readable dates." },
    { key: "length", label: "Length", score: length * k, max: LENGTH_MAX * k, note: "Fills one page without spilling onto two." },
    { key: "sections", label: "Sections", score: sections * k, max: SECTION_MAX * k, note: "Summary, experience, education and skills." },
  );

  const total = Math.round(Math.min(100, parts.reduce((n, p) => n + p.score, 0)));
  fixes.sort((a, b) => b.points - a.points);
  return { total, general, parts, keywords, fixes, bullets, fill, linesFree };
}

/** The label to put beside a score. */
export function atsBand(total: number): { label: string; tone: "success" | "primary" | "warning" | "danger" } {
  if (total >= 85) return { label: "Strong", tone: "success" };
  if (total >= 70) return { label: "Good", tone: "primary" };
  if (total >= 55) return { label: "Needs work", tone: "warning" };
  return { label: "Weak", tone: "danger" };
}
