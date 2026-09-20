import { HttpError, admin, body, route } from "./_lib/http.js";
import { FAST_MODEL, numbersSupported, structured } from "./_lib/claude.js";

const FIELD_NAMES: Record<string, string> = {
  supply: "supply chain and logistics",
  program: "program and business operations",
  cs: "customer success",
  health: "healthcare administration",
  project: "project coordination",
};

const str = { type: "string" };
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["rows", "story"],
  properties: {
    rows: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["from", "phrases"],
        properties: { from: str, phrases: { type: "array", items: str } },
      },
    },
    story: str,
  },
};

const SYSTEM = `You are the Career Translator for CareerQuest. You help a career changer see how work they already did is described in another field.

Rules:
- For each input line, return the input exactly as given in "from", and 2 to 4 short phrases (2 to 6 words each) that name the same work in the language hiring managers in the target field use.
- Relabel only. Never add a skill, tool, number, employer, or result that is not in the input line. Numbers may only be repeated from the input.
- story: one or two plain first person sentences that connect the person's real experience to the target field, using only facts from the input lines.
- Warm, direct, plain. No exclamation points. Never use em dashes.`;

export default route(async (req, _res, user) => {
  const { target, items, prevField } = body<{ target?: string; items?: string[]; prevField?: string }>(req);
  const field = FIELD_NAMES[target ?? ""];
  if (!field) throw new HttpError(400, "Pick a target field.");
  let lines = (items ?? []).map((s) => String(s).trim()).filter(Boolean).slice(0, 14);

  // With no lines, translate the top bullets of the user's own resume.
  if (lines.length === 0) {
    const { data } = await admin().from("resumes").select("parsed").eq("user_id", user.id).eq("is_base", true).order("created_at", { ascending: false }).limit(1).maybeSingle();
    const roles = (data?.parsed?.roles ?? []) as { bullets: { text: string }[] }[];
    lines = roles.flatMap((r) => r.bullets.map((b) => b.text)).slice(0, 12);
  }
  if (lines.length === 0) throw new HttpError(400, "Upload your resume first, or type a responsibility to translate.");

  const out = await structured<{ rows: { from: string; phrases: string[] }[]; story: string }>({
    model: FAST_MODEL,
    system: SYSTEM,
    content: [{ type: "text", text: `Previous field: ${prevField || "not stated"}\nTarget field: ${field}\n\nLines to translate:\n${lines.map((l, i) => `${i + 1}. ${l}`).join("\n")}` }],
    schema: SCHEMA,
    maxTokens: 4000,
    effort: "low",
  });

  const source = lines.join(" ");
  const rows = lines.map((line) => {
    const hit = out.rows.find((r) => r.from.trim().toLowerCase() === line.toLowerCase());
    return { from: line, phrases: (hit?.phrases ?? []).filter((p) => numbersSupported(p, source)).slice(0, 4) };
  });
  return { rows, story: numbersSupported(out.story, source) ? out.story : "" };
});
