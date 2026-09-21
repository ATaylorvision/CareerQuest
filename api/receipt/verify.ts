import type Anthropic from "@anthropic-ai/sdk";
import { HttpError, admin, body, route, quota } from "../_lib/http.js";
import { FAST_MODEL, structured } from "../_lib/claude.js";

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["is_confirmation", "matches_company", "reference", "reason"],
  properties: {
    is_confirmation: { type: "boolean" },
    matches_company: { type: "boolean" },
    reference: { type: "string" },
    reason: { type: "string" },
  },
};

const SYSTEM = `You check evidence that a job application was submitted. You are given an email, a web page, or a screenshot the applicant says confirms an application.

Decide, strictly:
- is_confirmation: true only if the content is clearly an acknowledgement that an application was received or submitted (for example "thank you for applying", "we received your application", an application receipt page). A job posting, a marketing email, a rejection, an interview invite, or unrelated text is not a confirmation.
- matches_company: true only if the content names the employer given below, or clearly comes from that employer's application system.
- reference: any confirmation, application, or reference number shown, exactly as written. Empty string if none.
- reason: one plain sentence explaining your decision. If it fails, say what is missing. No exclamation points. Never use em dashes.

Do not be generous. If you cannot tell, answer false.`;

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;

export default route(async (req, _res, user) => {
  await quota(user, "receipt", 20, "checking confirmations");
  const { company, title, text, fileName, mime, data } = body<{ company?: string; title?: string; text?: string; fileName?: string; mime?: string; data?: string }>(req);
  if (!company || !title) throw new HttpError(400, "Which application is this for?");

  const content: Anthropic.Messages.ContentBlockParam[] = [];
  let storedPath: string | null = null;

  if (data && fileName) {
    const buf = Buffer.from(data, "base64");
    if (buf.length > 3_200_000) throw new HttpError(413, "That file is over 3 MB.");
    const lower = fileName.toLowerCase();
    if (mime === "application/pdf" || lower.endsWith(".pdf")) {
      content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data } });
    } else if ((IMAGE_TYPES as readonly string[]).includes(mime ?? "")) {
      content.push({ type: "image", source: { type: "base64", media_type: mime as (typeof IMAGE_TYPES)[number], data } });
    } else if (lower.endsWith(".txt") || lower.endsWith(".eml") || mime?.startsWith("text/")) {
      content.push({ type: "text", text: buf.toString("utf8").slice(0, 20000) });
    } else {
      throw new HttpError(415, "Use a screenshot (PNG or JPG), a PDF, or a text file.");
    }
    const path = `${user.id}/${Date.now()}-${fileName.replace(/[^\w.\-]+/g, "_").slice(0, 80)}`;
    const up = await admin().storage.from("confirmations").upload(path, buf, { contentType: mime || "application/octet-stream" });
    if (!up.error) storedPath = path;
  } else if (text && text.trim().length >= 20) {
    content.push({ type: "text", text: text.slice(0, 20000) });
  } else {
    throw new HttpError(400, "Paste the confirmation email or upload a screenshot.");
  }

  content.push({ type: "text", text: `Employer: ${company}\nRole applied for: ${title}\n\nDecide whether the content above confirms an application to this employer.` });
  const out = await structured<{ is_confirmation: boolean; matches_company: boolean; reference: string; reason: string }>({
    model: FAST_MODEL,
    system: SYSTEM,
    content,
    schema: SCHEMA,
    maxTokens: 600,
    effort: "low",
  });

  return { ok: out.is_confirmation && out.matches_company, reason: out.reason, reference: out.reference, path: storedPath };
});
