import { HttpError, admin, body, route, quota } from "./_lib/http.js";
import { FAST_MODEL, claude } from "./_lib/claude.js";

const MONTHLY_CAP = 1500;

const SYSTEM = `You are Wren, the career copilot inside CareerQuest. CareerQuest is built for career changers (roughly 28 to 50, with real work history) and people restarting after a layoff. Everything you say should help them answer two questions: "Does my experience actually count here?" and "Did that application go anywhere?"

Voice: warm, direct, plainspoken, like a sharp friend who has done this before. Short sentences. No corporate filler, no hype. Never use exclamation points. Never use em dashes; use commas or periods.

Truth rules:
- The person's real resume, preferences, matches, and applications are below. Use only those facts about them. Never invent a skill, number, employer, date, or result, and never suggest they claim one they do not have.
- If they ask for something the data does not cover, say so and ask, or say what you would need.
- When a job requires something they lack, say so plainly and suggest an honest way to address it.
- You cannot see the internet or contact anyone. You cannot apply, send messages, or change their account. Say so if asked.
- Be honest about odds and about weak fits. Encouragement should be earned by facts.
- For salary questions, give ranges and reasoning, and say plainly when you are unsure. Do not present guesses as market data.
- If someone sounds overwhelmed, respond with warmth first. If they mention self harm, urge them to contact a crisis line such as 988 in the US.

Format: plain paragraphs and short lists. Use **bold** sparingly for key points. Keep answers as short as the question allows. Ask at most one clarifying question.`;

export default route(
  async (req, res, user) => {
    const { messages } = body<{ messages?: { role: "user" | "assistant"; content: string }[] }>(req);
    if (!Array.isArray(messages) || messages.length === 0) throw new HttpError(400, "Say something first.");
    const convo = messages.slice(-24).map((m) => ({ role: m.role === "assistant" ? ("assistant" as const) : ("user" as const), content: String(m.content).slice(0, 6000) }));
    if (convo[convo.length - 1].role !== "user") throw new HttpError(400, "The last message must be from you.");

    await quota(user, "chat", 150, "messages to Wren");
    const db = admin();
    const month = new Date().toISOString().slice(0, 8) + "01";
    const { data: usage } = await db.from("usage_counters").select("copilot_messages").eq("user_id", user.id).eq("month", month).maybeSingle();
    if ((usage?.copilot_messages ?? 0) >= MONTHLY_CAP) throw new HttpError(429, "You have reached this month's chat limit.");

    const [{ data: profile }, { data: resumeRow }, { data: matches }, { data: stateRow }] = await Promise.all([
      db.from("profiles").select("full_name, location, situation, prev_field, target_field, target_roles, locations, remote_pref, salary_floor, must_haves, dealbreakers").eq("id", user.id).single(),
      db.from("resumes").select("parsed").eq("user_id", user.id).eq("is_base", true).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      db.from("job_matches").select("score, why, jobs(title, company, location, salary_min, salary_max, legit)").eq("user_id", user.id).eq("dismissed", false).order("score", { ascending: false }).limit(8),
      db.from("user_state").select("state").eq("user_id", user.id).maybeSingle(),
    ]);

    const apps = ((stateRow?.state as { applications?: { jobId: string; column: string }[] } | null)?.applications ?? []).slice(0, 20);
    let appLines = "None yet.";
    if (apps.length) {
      const { data: jobs } = await db.from("jobs").select("id, title, company").in("id", apps.map((a) => a.jobId));
      const byId = new Map((jobs ?? []).map((j) => [j.id, j]));
      appLines = apps.map((a) => `- ${byId.get(a.jobId)?.title ?? "A role"} at ${byId.get(a.jobId)?.company ?? "a company"}: ${a.column}`).join("\n");
    }

    const matchLines = (matches ?? [])
      .map((m) => {
        const j = m.jobs as unknown as { title: string; company: string; location: string; legit?: { badge?: string; score?: number } } | null;
        return j ? `- ${j.title} at ${j.company} (${j.location}), match ${m.score}, legitimacy ${j.legit?.badge ?? "unknown"} ${j.legit?.score ?? ""}. ${m.why ?? ""}` : "";
      })
      .filter(Boolean)
      .join("\n");

    const system = `${SYSTEM}

ABOUT THE PERSON
Name: ${profile?.full_name || "not given"}. Location: ${profile?.location || "not given"}.
Situation: ${profile?.situation || "not given"}. Coming from: ${profile?.prev_field || "not given"}. Moving toward: ${profile?.target_field || "not given"}.
Target roles: ${(profile?.target_roles ?? []).join(", ") || "not given"}. Locations: ${(profile?.locations ?? []).join(", ") || "not given"}. Remote preference: ${profile?.remote_pref}.
Salary floor: ${profile?.salary_floor ?? "not given"}. Must haves: ${(profile?.must_haves ?? []).join(", ") || "none"}. Dealbreakers: ${(profile?.dealbreakers ?? []).join(", ") || "none"}.

THEIR RESUME (JSON)
${resumeRow?.parsed ? JSON.stringify(resumeRow.parsed) : "No resume uploaded yet."}

THEIR TOP MATCHES
${matchLines || "None yet."}

THEIR APPLICATIONS
${appLines}`;

    await db.from("usage_counters").upsert({ user_id: user.id, month, copilot_messages: (usage?.copilot_messages ?? 0) + 1 }, { onConflict: "user_id,month" });

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("X-Accel-Buffering", "no");
    res.status(200);

    // Low effort keeps the first words fast. Coaching chat does not need long private reasoning.
    const stream = claude().messages.stream({ model: FAST_MODEL, max_tokens: 2000, system, messages: convo, output_config: { effort: "low" } });
    stream.on("text", (t) => res.write(t));
    try {
      const final = await stream.finalMessage();
      if (final.stop_reason === "refusal") res.write("\n\nI cannot help with that one. Ask me something else about your search.");
    } catch (e) {
      console.error("[chat stream]", e);
      res.write("\n\nSomething interrupted that answer. Please try again.");
    }
    res.end();
  },
  { stream: true },
);
