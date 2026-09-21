import { HttpError, admin, body, route, quota } from "../_lib/http.js";
import { FAST_MODEL, numbersSupported, structured } from "../_lib/claude.js";
import { GAPS } from "../../src/data/gaps.js";

/**
 * Two stages, so the first results show up fast:
 *  - "score": one quick pass over many jobs (scores, field, one sentence why).
 *  - "detail": the full analysis for one or two jobs (translations, requirement checks, gaps).
 */

const FIELDS = ["supply", "program", "cs", "health", "project"];
const CATEGORIES = ["Operations", "Supply Chain & Logistics", "Program Management", "Customer Success", "Healthcare Admin", "Sales Operations", "Project Coordination"];
const str = { type: "string" };
const int = { type: "integer" };

const SCORE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["results"],
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["job_id", "experience", "skills", "industry", "transferable", "field", "category", "career_changer_friendly", "why"],
        properties: {
          job_id: str,
          experience: int,
          skills: int,
          industry: int,
          transferable: int,
          field: { type: "string", enum: FIELDS },
          category: { type: "string", enum: CATEGORIES },
          career_changer_friendly: { type: "boolean" },
          why: str,
        },
      },
    },
  },
};

const DETAIL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["results"],
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["job_id", "story_line", "translations", "requirements", "gaps"],
        properties: {
          job_id: str,
          story_line: str,
          translations: {
            type: "array",
            items: { type: "object", additionalProperties: false, required: ["bullet", "phrases"], properties: { bullet: str, phrases: { type: "array", items: str } } },
          },
          requirements: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["text", "status", "note"],
              properties: { text: str, status: { type: "string", enum: ["met", "partial", "gap"] }, note: str },
            },
          },
          gaps: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["id", "label", "severity", "note", "cover_letter_line", "time_to_credible", "resources"],
              properties: {
                id: str,
                label: str,
                severity: { type: "string", enum: ["dealbreaker", "trainable", "preferred"] },
                note: str,
                cover_letter_line: str,
                time_to_credible: str,
                resources: {
                  type: "array",
                  items: { type: "object", additionalProperties: false, required: ["title", "cost", "detail", "minutes"], properties: { title: str, cost: str, detail: str, minutes: int } },
                },
              },
            },
          },
        },
      },
    },
  },
};

const libraryList = Object.values(GAPS)
  .map((g) => `${g.id}: ${g.label}`)
  .join("\n");

const COMMON = `You are the matching engine for CareerQuest, a job search tool for career changers and people restarting after a layoff. You compare one person's real resume against real job postings and report honestly.

TRUTH RULES (strict):
- Use only facts that appear in the resume or the posting. Never invent a skill, number, employer, date, credential, or result.
- Any number you write must already appear in the resume or the posting.
- Copy rules: warm, direct, plain. Short sentences. No exclamation points. Never use em dashes.`;

const SCORE_SYSTEM = `${COMMON}

Score each posting. Integers 0 to 100. Use the full range and do not inflate. A posting that lists hard requirements the resume clearly lacks must score lower on experience and skills.
- experience: years and level of responsibility against what the posting asks for.
- skills: skills and tools in the resume that the posting names.
- industry: closeness of the person's past industry to the employer's. Weighted lightly on purpose.
- transferable: how well the work the person has actually done maps to this role even under a different title. Most important for a career changer.
- field: supply (supply chain, logistics, inventory, operations), program (program or business operations, sales operations), cs (customer success, account management), health (healthcare administration), project (project coordination).
- career_changer_friendly: true when the posting does not demand experience in one specific industry.
- why: one full sentence, second person, naming the specific overlap or the specific mismatch between the resume and this posting. If the posting text is short, say what you can see and keep the claim modest. Never write a placeholder.`;

const DETAIL_SYSTEM = `${COMMON}

For each posting, produce:
- story_line: one or two plain sentences, first person, on how the person's real experience fits this role. Resume facts only.
- translations: up to 3 resume bullets that matter most for this job. Copy each bullet EXACTLY as written in the resume. For each, 2 or 3 short phrases (2 to 5 words) naming the same work in the language of the posting's field. Relabel only. Do not add facts.
- requirements: up to 6 concrete requirements visible in the posting. status is met, partial, or gap against the resume. note is one short sentence or an empty string.
- gaps: at most 4 real requirements the resume does not show, most important first. If a gap matches one in the library below, use that exact id and keep other fields short (they will be replaced). Otherwise use an id like "custom-" plus a short slug and fill every field. severity: dealbreaker means likely to end the application, trainable means learnable in weeks, preferred means nice to have. cover_letter_line: one honest first person sentence that admits the gap and points to real related experience from the resume. resources: 1 or 2 short suggestions of the kind of free or low cost learning that would close it (describe the type, never invent a URL or brand). minutes is a rough integer estimate.

GAP LIBRARY (ids you may reuse):
${libraryList}`;

interface Resume {
  summary: string;
  roles: { title: string; company: string; start: string; end: string; bullets: { text: string }[] }[];
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

const clamp = (n: number) => Math.max(10, Math.min(99, Math.round(n)));

/** A usable sentence: several words, and not a leftover placeholder. */
const usable = (s: string | undefined) => !!s && s.trim().split(/\s+/).length >= 6 && !/placeholder|lorem ipsum|not available|n\/a|tbd/i.test(s);
const flat = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

const posting = (j: JobRow, chars: number) =>
  `<job id="${j.id}">\nTitle: ${j.title}\nCompany: ${j.company}\nLocation: ${j.location}\nSalary: ${j.salary_min ? `${j.salary_min} to ${j.salary_max} per year` : "not listed"}\nPosting text:\n${(j.description ?? "").slice(0, chars)}\n</job>`;

export default route(async (req, _res, user) => {
  await quota(user, "match", 200, "reading job matches");
  const { ids, mode = "score", force } = body<{ ids?: string[]; mode?: "score" | "detail"; force?: boolean }>(req);
  const max = mode === "score" ? 15 : 2;
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > max) throw new HttpError(400, `Send between 1 and ${max} job ids.`);
  const db = admin();

  const [{ data: resumeRow }, { data: profile }, { data: jobs }, { data: existing }] = await Promise.all([
    db.from("resumes").select("parsed").eq("user_id", user.id).eq("is_base", true).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("profiles").select("situation, prev_field, target_field").eq("id", user.id).single(),
    // Jobs someone pasted in are private to them, so anyone else asking for one gets nothing back.
    db.from("jobs").select("id, title, company, location, description, salary_min, salary_max").in("id", ids).or(`owner_id.is.null,owner_id.eq.${user.id}`),
    db.from("job_matches").select("job_id, breakdown, why, gaps, translator, career_changer_friendly, score").eq("user_id", user.id).in("job_id", ids),
  ]);
  if (!resumeRow?.parsed) throw new HttpError(400, "Upload your resume first so we can match against it.");
  if (!jobs?.length) throw new HttpError(404, "Those listings were not found.");

  const resume = resumeRow.parsed as Resume;
  const resumeText = JSON.stringify(resume);
  const compact = {
    summary: resume.summary,
    roles: resume.roles.map((r) => ({ title: r.title, company: r.company, dates: `${r.start} to ${r.end}`, bullets: r.bullets.map((b) => b.text) })),
    education: resume.education,
    certifications: resume.certifications,
    skills: resume.skills,
  };
  const situation = `The person's situation: ${profile?.situation ?? "unknown"}. Coming from: ${profile?.prev_field ?? "unknown"}. Moving toward: ${profile?.target_field ?? "unknown"}.\n\nRESUME (JSON):\n${JSON.stringify(compact)}`;
  const haveMatch = new Map((existing ?? []).map((m) => [m.job_id, m]));

  /* ---------------- score ---------------- */
  if (mode === "score") {
    const todo = jobs.filter((j) => force || !haveMatch.has(j.id));
    if (todo.length === 0) return { scored: 0, skipped: jobs.length };

    type ScoreOut = { results: { job_id: string; experience: number; skills: number; industry: number; transferable: number; field: string; category: string; career_changer_friendly: boolean; why: string }[] };
    const scoreBatch = (batch: JobRow[]) =>
      structured<ScoreOut>({
        model: FAST_MODEL,
        system: SCORE_SYSTEM,
        content: [{ type: "text", text: `${situation}\n\nJOB POSTINGS:\n${batch.map((j) => posting(j, 1400)).join("\n\n")}\n\nReturn exactly one result for every one of the ${batch.length} jobs above, using each job's id as job_id. Do not skip any.` }],
        schema: SCORE_SCHEMA,
        maxTokens: 6000,
        effort: "low",
      });

    // The model occasionally skips a job. Ask again for any that are missing.
    const out: ScoreOut = { results: [] };
    let pending = todo;
    for (let attempt = 0; attempt < 3 && pending.length > 0; attempt++) {
      const t0 = Date.now();
      const got = await scoreBatch(pending);
      console.log(`[score] attempt ${attempt + 1}: asked ${pending.length}, got ${got.results.length}, ${((Date.now() - t0) / 1000).toFixed(1)}s`);
      const seen = new Set(got.results.map((r) => r.job_id));
      out.results.push(...got.results.filter((r) => pending.some((j) => j.id === r.job_id)));
      pending = pending.filter((j) => !seen.has(j.id));
    }

    const byId = new Map(todo.map((j) => [j.id, j]));
    const rows = [];
    for (const r of out.results) {
      const job = byId.get(r.job_id);
      if (!job) continue;
      const experience = clamp(r.experience);
      const skills = clamp(r.skills);
      const industry = clamp(r.industry);
      const transferable = clamp(r.transferable);
      const prev = haveMatch.get(job.id);
      const why = usable(r.why) && numbersSupported(r.why, resumeText, job.description ?? "", job.title) ? r.why : "We could not read enough of this posting to say more. Open it to judge the fit yourself.";
      rows.push({
        user_id: user.id,
        job_id: job.id,
        score: Math.round(0.3 * experience + 0.3 * skills + 0.1 * industry + 0.3 * transferable),
        breakdown: { experience, skills, industry, transferable },
        why,
        gaps: prev?.gaps ?? [],
        translator: {
          ...(prev?.translator ?? {}),
          field: FIELDS.includes(r.field) ? r.field : "supply",
          category: CATEGORIES.includes(r.category) ? r.category : "Operations",
          enriched: !!prev?.translator?.enriched,
        },
        career_changer_friendly: !!r.career_changer_friendly,
        dismissed: false,
        computed_at: new Date().toISOString(),
      });
    }
    if (rows.length) {
      const { error } = await db.from("job_matches").upsert(rows, { onConflict: "user_id,job_id" });
      if (error) throw new HttpError(500, "Could not save your matches.");
    }
    return { scored: rows.length };
  }

  /* ---------------- detail ---------------- */
  const todo = jobs.filter((j) => force || !haveMatch.get(j.id)?.translator?.enriched);
  if (todo.length === 0) return { enriched: 0, skipped: jobs.length };
  const bulletSet = new Set(resume.roles.flatMap((r) => r.bullets.map((b) => flat(b.text))));

  const out = await structured<{
    results: {
      job_id: string;
      story_line: string;
      translations: { bullet: string; phrases: string[] }[];
      requirements: { text: string; status: string; note: string }[];
      gaps: { id: string; label: string; severity: string; note: string; cover_letter_line: string; time_to_credible: string; resources: { title: string; cost: string; detail: string; minutes: number }[] }[];
    }[];
  }>({
    model: FAST_MODEL,
    system: DETAIL_SYSTEM,
    content: [{ type: "text", text: `${situation}\n\nJOB POSTINGS:\n${todo.map((j) => posting(j, 5000)).join("\n\n")}\n\nReturn one result per job, using each job's id as job_id.` }],
    schema: DETAIL_SCHEMA,
    maxTokens: 6000,
    effort: "low",
  });

  const byId = new Map(todo.map((j) => [j.id, j]));
  let enriched = 0;
  for (const r of out.results) {
    const job = byId.get(r.job_id);
    const prev = haveMatch.get(r.job_id);
    if (!job || !prev) continue;
    const corpus = [resumeText, job.description ?? "", job.title];
    const safe = (s: string, fallback: string) => (usable(s) && numbersSupported(s, ...corpus) ? s : fallback);

    const translations = r.translations
      .filter((t) => bulletSet.has(flat(t.bullet)))
      .map((t) => ({ from: t.bullet, phrases: t.phrases.filter((p) => numbersSupported(p, ...corpus)).slice(0, 3) }))
      .filter((t) => t.phrases.length > 0)
      .slice(0, 3);

    const gaps = r.gaps.slice(0, 4).map((g) => {
      const lib = GAPS[g.id];
      if (lib) return { id: lib.id, label: lib.label, severity: lib.severity, note: lib.note, coverLetterLine: lib.coverLetterLine, timeToCredible: lib.timeToCredible, hoursEstimate: lib.hoursEstimate, resources: lib.resources };
      const id = /^custom-[a-z0-9-]{2,40}$/.test(g.id) ? g.id : `custom-${g.label.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30)}`;
      const resources = g.resources.slice(0, 2).map((x, i) => ({ id: `${id}-${i + 1}`, title: x.title, cost: x.cost, detail: x.detail, minutes: Math.max(15, Math.min(6000, x.minutes)) }));
      // Add up what the suggested learning actually takes. A fixed number per
      // severity used to rate a nice to have above something trainable, and
      // gave a dealbreaker zero hours, which made the roadmap total meaningless.
      const fromResources = resources.reduce((n, r) => n + r.minutes, 0);
      const fallback = g.severity === "dealbreaker" ? 40 : g.severity === "trainable" ? 15 : 8;
      return {
        id,
        label: g.label,
        severity: g.severity,
        note: safe(g.note, "This is in the posting and not in your resume."),
        coverLetterLine: safe(g.cover_letter_line, ""),
        timeToCredible: g.time_to_credible || "Varies",
        hoursEstimate: fromResources ? Math.max(1, Math.round(fromResources / 60)) : fallback,
        resources,
      };
    });

    const { error } = await db
      .from("job_matches")
      .update({
        gaps,
        translator: {
          ...(prev.translator ?? {}),
          enriched: true,
          story: safe(r.story_line, ""),
          translations,
          requirements: r.requirements.slice(0, 6).map((q) => ({ text: q.text, status: q.status, note: safe(q.note, "") })),
        },
      })
      .eq("user_id", user.id)
      .eq("job_id", job.id);
    if (!error) enriched++;
  }
  return { enriched };
});
