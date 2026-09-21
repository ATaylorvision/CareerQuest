import { HttpError, admin, body, route, quota, type AuthedUser } from "./_lib/http.js";
import { DEEP_MODEL, FAST_MODEL, numbersSupported, structured } from "./_lib/claude.js";

/**
 * Resume Studio, Cover Letter Studio and Interview Prep, in one function.
 *
 * Everything here reads the person's real resume and a real cached posting.
 * Nothing is generated from a template, and a truth guard drops any sentence
 * carrying a number that is not in the resume or the posting.
 */

const str = { type: "string" } as const;
const strList = { type: "array", items: str } as const;

interface Resume {
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  summary: string;
  roles: { title: string; company: string; location?: string; start: string; end: string; bullets: { id?: string; text: string }[] }[];
  skills: string[];
  education: string[];
  certifications: string[];
}

interface JobRow {
  id: string;
  title: string;
  company: string;
  location: string | null;
  description: string | null;
  salary_min: number | null;
  salary_max: number | null;
}

const usable = (s: string | undefined) => !!s && s.trim().split(/\s+/).length >= 5 && !/placeholder|lorem ipsum|n\/a|tbd/i.test(s);

const posting = (j: JobRow, chars = 6000) =>
  `Title: ${j.title}\nCompany: ${j.company}\nLocation: ${j.location ?? "not listed"}\nSalary: ${j.salary_min ? `${j.salary_min} to ${j.salary_max} per year` : "not listed"}\nPosting text:\n${(j.description ?? "").slice(0, chars)}`;

/** The resume as the model sees it, with a stable id on every bullet so changes can cite their source. */
function compactResume(r: Resume) {
  return {
    summary: r.summary,
    roles: r.roles.map((role, i) => ({
      id: `role-${i}`,
      title: role.title,
      company: role.company,
      dates: `${role.start} to ${role.end}`,
      bullets: role.bullets.map((b, j) => ({ id: b.id || `r${i}b${j}`, text: b.text })),
    })),
    skills: r.skills,
    education: r.education,
    certifications: r.certifications,
  };
}

/** Free plan allowances per calendar month. Pro and trial are unlimited. */
const FREE_LIMITS = { tailored_resumes: 3, cover_letters: 3 };

const monthKey = () => `${new Date().toISOString().slice(0, 7)}-01`;

/**
 * Checks the allowance and counts the use. This lives on the server because a
 * limit enforced only in the browser is not a limit.
 */
async function meter(user: AuthedUser, column: keyof typeof FREE_LIMITS) {
  const db = admin();
  const month = monthKey();
  const [{ data: profile }, { data: usage }] = await Promise.all([
    db.from("profiles").select("plan_tier").eq("id", user.id).single(),
    db.from("usage_counters").select("*").eq("user_id", user.id).eq("month", month).maybeSingle(),
  ]);

  const used = (usage?.[column] as number | undefined) ?? 0;
  const unlimited = profile?.plan_tier === "pro" || profile?.plan_tier === "trial";
  if (!unlimited && used >= FREE_LIMITS[column]) {
    throw new HttpError(402, `You have used your ${FREE_LIMITS[column]} free ${column === "tailored_resumes" ? "tailored resumes" : "cover letters"} this month. They reset on the 1st, and Pro has no limit.`);
  }

  await db.from("usage_counters").upsert({ user_id: user.id, month, [column]: used + 1 }, { onConflict: "user_id,month" });
  return { used: used + 1, unlimited };
}

async function load(user: AuthedUser, jobId: string) {
  const db = admin();
  const [{ data: resumeRow }, { data: profile }, { data: job }, { data: match }] = await Promise.all([
    db.from("resumes").select("parsed").eq("user_id", user.id).eq("is_base", true).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("profiles").select("full_name, situation, prev_field, target_field, headline").eq("id", user.id).single(),
    db.from("jobs").select("id, title, company, location, description, salary_min, salary_max").eq("id", jobId).maybeSingle(),
    db.from("job_matches").select("gaps, why, score").eq("user_id", user.id).eq("job_id", jobId).maybeSingle(),
  ]);
  if (!resumeRow?.parsed) throw new HttpError(400, "Upload your resume first so we have something to work from.");
  if (!job) throw new HttpError(404, "We could not find that listing. Try opening it again from your matches.");
  return { resume: resumeRow.parsed as Resume, profile, job: job as JobRow, match };
}

/* ---------------- Resume Studio ---------------- */

const TAILOR_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["changes"],
  properties: {
    changes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["source_id", "section", "type", "original", "tailored", "reason", "keywords"],
        properties: {
          source_id: str,
          section: str,
          type: { type: "string", enum: ["reorder", "reword", "emphasize", "format"] },
          original: str,
          tailored: str,
          reason: str,
          keywords: { type: "integer" },
        },
      },
    },
  },
} as const;

const TAILOR_SYSTEM = `You tailor a resume for one job posting under strict Truth Mode rules.

TRUTH MODE, absolute:
- You may only reorder, reword, re-emphasise or reformat what the resume already says.
- Never add a skill, tool, employer, title, date, certification, degree or number that is not already in the resume.
- Never inflate scope. If the resume says six stores, it stays six stores.
- Every number in your tailored text must already appear in that person's resume.
- If a requirement is not met, do not paper over it. Leave it out; the gap is handled elsewhere.

For each change:
- source_id: the exact bullet id from the resume, or "summary" for the summary line.
- section: the role title the bullet belongs to, or "Summary".
- type: reorder means same words moved higher; reword means same fact said in the posting's language; emphasize means the important part moved to the front; format means punctuation or structure only.
- original: the resume text exactly as it is now.
- tailored: the rewritten line. For a reorder, this is identical to the original.
- reason: one plain sentence naming what in the posting drove the change. Write it to the person, in plain English, no jargon.
- keywords: how many terms from the posting the tailored line now matches, 0 to 5.

Return at most 8 changes, most valuable first. Prefer the summary plus the strongest bullets. Do not return a change that makes no difference.`;

async function tailor(user: AuthedUser, jobId: string) {
  const { resume, job } = await load(user, jobId);
  await meter(user, "tailored_resumes");
  const resumeText = JSON.stringify(resume);

  const out = await structured<{
    changes: { source_id: string; section: string; type: string; original: string; tailored: string; reason: string; keywords: number }[];
  }>({
    model: DEEP_MODEL,
    system: TAILOR_SYSTEM,
    content: [{ type: "text", text: `RESUME:\n${JSON.stringify(compactResume(resume))}\n\nPOSTING:\n${posting(job)}` }],
    schema: TAILOR_SCHEMA as unknown as Record<string, unknown>,
    maxTokens: 6000,
  });

  // Anything the resume cannot support is dropped rather than shown with a warning.
  const corpus = [resumeText, job.description ?? "", job.title];
  const changes = out.changes
    .filter((c) => usable(c.tailored) && usable(c.reason))
    .filter((c) => numbersSupported(c.tailored, ...corpus))
    .slice(0, 8)
    .map((c, i) => ({
      id: `${job.id}-${i + 1}`,
      section: c.section,
      sourceId: c.source_id,
      type: c.type as "reorder" | "reword" | "emphasize" | "format",
      original: c.original,
      tailored: c.tailored,
      reason: c.reason,
      ats: { keywords: Math.max(0, Math.min(5, c.keywords)) },
    }));

  return { jobId: job.id, changes };
}

/* ---------------- Cover Letter Studio ---------------- */

const LETTER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["greeting", "paragraphs"],
  properties: {
    greeting: str,
    paragraphs: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "role", "text", "sources"],
        properties: {
          id: str,
          role: { type: "string", enum: ["opening", "evidence", "gap", "closing"] },
          text: str,
          sources: strList,
        },
      },
    },
  },
} as const;

const TONE_NOTE: Record<string, string> = {
  warm: "Warm and human. Plain words, a little personality. Good for small companies and mission driven teams.",
  direct: "Direct and efficient. Short sentences, no throat clearing. Good for operations and technical teams.",
  formal: "Formal and precise. Traditional business register. Good for government, healthcare, finance and law.",
};

const LETTER_SYSTEM = `You write a cover letter using only what a person's resume already says.

RULES, absolute:
- Every claim must trace to a line in the resume. Never invent an employer, number, tool, date or result.
- Every number you write must already appear in the resume.
- Do not claim a skill the resume does not show. If the posting asks for something missing, either leave it out or address it honestly in a gap paragraph.
- No flattery about the company, no "I have always been passionate about". Say what the person did and why it transfers.
- Never write a placeholder like [Company] or [Your Name]. Use the real values given.

Structure: one opening, two or three evidence paragraphs, at most one gap paragraph if gaps are supplied, one closing.
Each paragraph lists in "sources" the resume bullet ids or the word "summary" it came from. A closing may have an empty source list.
Keep the whole letter under 300 words. Write in the first person, as the candidate.`;

async function letter(user: AuthedUser, jobId: string, tone: string, addressGaps: string[]) {
  const { resume, job, match } = await load(user, jobId);
  await meter(user, "cover_letters");
  const resumeText = JSON.stringify(resume);
  const gaps = (match?.gaps ?? []) as { id: string; label: string; coverLetterLine?: string }[];
  const chosen = gaps.filter((g) => addressGaps.includes(g.id));

  const out = await structured<{ greeting: string; paragraphs: { id: string; role: string; text: string; sources: string[] }[] }>({
    model: DEEP_MODEL,
    system: LETTER_SYSTEM,
    content: [
      {
        type: "text",
        text: [
          `CANDIDATE NAME: ${resume.name ?? ""}`,
          `TONE: ${TONE_NOTE[tone] ?? TONE_NOTE.warm}`,
          `RESUME:\n${JSON.stringify(compactResume(resume))}`,
          `POSTING:\n${posting(job, 5000)}`,
          chosen.length ? `GAPS TO ADDRESS HONESTLY (one short paragraph covering these):\n${chosen.map((g) => `- ${g.label}`).join("\n")}` : "GAPS TO ADDRESS: none. Do not write a gap paragraph.",
        ].join("\n\n"),
      },
    ],
    schema: LETTER_SCHEMA as unknown as Record<string, unknown>,
    maxTokens: 3000,
  });

  const corpus = [resumeText, job.description ?? "", job.title, job.company];
  const paragraphs = out.paragraphs
    .filter((p) => usable(p.text))
    .filter((p) => numbersSupported(p.text, ...corpus))
    .slice(0, 6)
    .map((p, i) => ({ id: p.id || `p${i + 1}`, role: p.role, text: p.text, sources: p.sources.slice(0, 4) }));

  if (!paragraphs.length) throw new HttpError(502, "We could not write a letter we could stand behind from this posting. Please try again.");
  return { jobId: job.id, greeting: out.greeting, paragraphs };
}

/* ---------------- Interview Prep ---------------- */

const QUESTIONS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["questions"],
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "text", "category", "why", "tip", "outline"],
        properties: {
          id: str,
          text: str,
          category: { type: "string", enum: ["Behavioral", "Situational", "Role specific", "Career change", "Layoff"] },
          why: str,
          tip: str,
          outline: strList,
        },
      },
    },
  },
} as const;

const QUESTIONS_SYSTEM = `You prepare someone for a real interview for a real job.

Write questions this employer is genuinely likely to ask, based on the posting and on this person's actual history.
- "why": one sentence on what the interviewer is really checking.
- "tip": one sentence of specific advice for THIS person, naming something real from their resume.
- "outline": three or four short beats for their answer, drawn from their own experience. Never invent an achievement or a number.
- Include at least one question about their career change or gap if their situation calls for it.
Return 8 questions, most likely first. No generic filler.`;

async function questions(user: AuthedUser, jobId: string) {
  const { resume, profile, job } = await load(user, jobId);
  const out = await structured<{ questions: { id: string; text: string; category: string; why: string; tip: string; outline: string[] }[] }>({
    model: FAST_MODEL,
    system: QUESTIONS_SYSTEM,
    content: [
      {
        type: "text",
        text: `SITUATION: ${profile?.situation ?? "changer"} (moving from ${profile?.prev_field ?? "another field"})\n\nRESUME:\n${JSON.stringify(compactResume(resume))}\n\nPOSTING:\n${posting(job, 5000)}`,
      },
    ],
    schema: QUESTIONS_SCHEMA as unknown as Record<string, unknown>,
    maxTokens: 5000,
  });

  const resumeText = JSON.stringify(resume);
  const corpus = [resumeText, job.description ?? "", job.title];
  const list = out.questions
    .filter((q) => usable(q.text))
    .slice(0, 8)
    .map((q, i) => ({
      id: q.id || `${job.id}-q${i + 1}`,
      text: q.text,
      category: q.category,
      why: q.why,
      tip: numbersSupported(q.tip, ...corpus) ? q.tip : "Answer with a specific example from your own history.",
      outline: q.outline.filter((o) => numbersSupported(o, ...corpus)).slice(0, 4),
    }));
  return { jobId: job.id, jobTitle: job.title, company: job.company, questions: list };
}

const FEEDBACK_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["score", "strengths", "improvements", "rewrite"],
  properties: {
    score: { type: "integer" },
    strengths: strList,
    improvements: strList,
    rewrite: str,
  },
} as const;

const FEEDBACK_SYSTEM = `You give honest, kind feedback on a practice interview answer.

score: 0 to 100 for how well this answer would land in a real interview. Calibrate against these anchors:
- 85 to 100: a clear situation, what they personally did, and a concrete result. An interviewer would remember it.
- 70 to 84: solid and on topic, with one thing missing, usually the result or the specifics.
- 50 to 69: relevant but vague. Mostly duties rather than actions and outcomes.
- 25 to 49: off topic, or so short the interviewer would have to ask again.
- 0 to 24: does not answer the question.
Most prepared answers land between 60 and 85. Do not mark an answer down for being plain spoken, and do not reward padding.

- strengths: one to three specific things that worked. Quote their words where useful.
- improvements: one to three concrete fixes, each actionable in a sentence. If the answer is already strong, say what would take it from good to memorable.
- rewrite: their own answer, tightened. Use only facts they gave you. Never add an achievement or a number they did not say.
Speak to them directly. No jargon, no scolding.`;

async function feedback(user: AuthedUser, questionText: string, answer: string) {
  if (!usable(answer)) throw new HttpError(400, "Write a little more and we will give you real feedback.");
  // Only the resume is needed here, and feedback still works without one.
  const { data: resumeRow } = await admin().from("resumes").select("parsed").eq("user_id", user.id).eq("is_base", true).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const resume = (resumeRow?.parsed ?? null) as Resume | null;

  const out = await structured<{ score: number; strengths: string[]; improvements: string[]; rewrite: string }>({
    model: FAST_MODEL,
    system: FEEDBACK_SYSTEM,
    content: [{ type: "text", text: `QUESTION:\n${questionText}\n\nTHEIR ANSWER:\n${answer.slice(0, 4000)}` }],
    schema: FEEDBACK_SCHEMA as unknown as Record<string, unknown>,
    maxTokens: 2000,
  });

  // The rewrite must not introduce a number they never said.
  const corpus = [answer, questionText, resume ? JSON.stringify(resume) : ""];
  return {
    score: Math.max(0, Math.min(100, out.score)),
    strengths: out.strengths.slice(0, 3),
    improvements: out.improvements.slice(0, 3),
    rewrite: numbersSupported(out.rewrite, ...corpus) ? out.rewrite : answer,
  };
}

/* ---------------- routing ---------------- */

interface Payload {
  action?: string;
  jobId?: string;
  tone?: string;
  addressGaps?: string[];
  question?: string;
  answer?: string;
}

export default route(async (req, _res, user) => {
  const p = body<Payload>(req);
  // Paid users have no monthly cap, so each kind of work also has a daily one.
  const DAILY: Record<string, [number, string]> = {
    tailor: [40, "tailoring resumes"],
    letter: [40, "writing cover letters"],
    questions: [40, "preparing interview questions"],
    feedback: [80, "interview answer feedback"],
  };
  const d = DAILY[p.action ?? ""];
  if (d) await quota(user, `studio-${p.action}`, d[0], d[1]);
  switch (p.action) {
    case "tailor":
      return tailor(user, p.jobId ?? "");
    case "letter":
      return letter(user, p.jobId ?? "", p.tone ?? "warm", Array.isArray(p.addressGaps) ? p.addressGaps : []);
    case "questions":
      return questions(user, p.jobId ?? "");
    case "feedback":
      return feedback(user, p.question ?? "", p.answer ?? "");
    default:
      throw new HttpError(400, "Unknown studio action.");
  }
});
