import type Anthropic from "@anthropic-ai/sdk";
import { detectKind, extractText, imageType } from "../_lib/resumeText.js";
import { HttpError, admin, body, route, quota } from "../_lib/http.js";
import { DEEP_MODEL, structured } from "../_lib/claude.js";

const MAX_BYTES = 3_200_000;

const str = { type: "string" };
const strList = { type: "array", items: str };

const RESUME_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["name", "email", "phone", "location", "summary", "current_field", "roles", "education", "certifications", "skills"],
  properties: {
    name: str,
    email: str,
    phone: str,
    location: str,
    summary: str,
    current_field: str,
    roles: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "company", "location", "start", "end", "bullets"],
        properties: { title: str, company: str, location: str, start: str, end: str, bullets: strList },
      },
    },
    education: strList,
    certifications: strList,
    skills: strList,
  },
};

const SYSTEM = `You extract structured data from a resume. You are a careful transcriber, not a writer.

Rules:
- Copy text exactly as written. Keep each bullet point verbatim. Do not fix wording, shorten, merge, or improve anything.
- Never add a skill, number, employer, date, title, or certification that is not in the document.
- If a field is not in the document, return an empty string or an empty list. Do not guess.
- Dates: keep the resume's own format (for example "Mar 2022" and "Present").
- Roles: newest first, as they appear. A bullet belongs to the role it sits under.
- Education and certifications: one string per entry, as written.
- Skills: one string per skill, as listed. If the resume has no skills section, return an empty list.
- current_field: two to four words naming the industry or field the person has worked in, based only on the roles listed (for example "retail operations").
- Write no copy that uses em dashes.`;

interface Parsed {
  name: string;
  email: string;
  phone: string;
  location: string;
  summary: string;
  current_field: string;
  roles: { title: string; company: string; location: string; start: string; end: string; bullets: string[] }[];
  education: string[];
  certifications: string[];
  skills: string[];
}

export default route(async (req, _res, user) => {
  await quota(user, "parse", 10, "resume uploads");
  const { fileName, mime, data } = body<{ fileName?: string; mime?: string; data?: string }>(req);
  if (!data || !fileName) throw new HttpError(400, "No file was received.");
  const buf = Buffer.from(data, "base64");
  if (buf.length === 0) throw new HttpError(400, "That file looks empty.");
  if (buf.length > MAX_BYTES) throw new HttpError(413, "That file is over 3 MB. Try a smaller file, or save it as a PDF.");

  const kind = detectKind(fileName, mime, buf);
  if (!kind) {
    throw new HttpError(415, "We could not tell what kind of file that is. Try PDF, Word (.docx or .doc), RTF, OpenDocument (.odt), HTML, plain text, or a clear photo or screenshot (PNG or JPG).");
  }

  const content: Anthropic.Messages.ContentBlockParam[] = [];
  if (kind === "pdf") {
    content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data } });
  } else if (kind === "image") {
    if (buf.length > 5_000_000) throw new HttpError(413, "That image is too large to read. Try a smaller screenshot or a PDF.");
    content.push({ type: "image", source: { type: "base64", media_type: imageType(fileName, mime, buf), data } });
  } else {
    let text = "";
    try {
      text = await extractText(kind, buf);
    } catch (e) {
      console.error("[resume extract]", kind, (e as Error).message);
    }
    if (text.trim().length < 40) {
      throw new HttpError(422, "We could not find any text in that file. If it is a scan, upload it as a PDF or a clear photo instead.");
    }
    content.push({ type: "text", text: `RESUME TEXT:\n\n${text.slice(0, 60_000)}` });
  }
  content.push({ type: "text", text: "Extract this resume into the required structure." });

  const parsed = await structured<Parsed>({ model: DEEP_MODEL, system: SYSTEM, content, schema: RESUME_SCHEMA, maxTokens: 8000, effort: "medium" });

  const bulletCount = parsed.roles.reduce((n, r) => n + r.bullets.length, 0);
  if (parsed.roles.length === 0 && bulletCount === 0) {
    throw new HttpError(422, "We could not find work history in that file. Is it a resume? You can also paste the text into a .txt file.");
  }

  // Give every bullet a stable id so tailoring and diffs can point at it.
  let n = 0;
  const resume = {
    ...parsed,
    roles: parsed.roles.map((r, ri) => ({
      id: `role-${ri + 1}`,
      ...r,
      bullets: r.bullets.map((text) => ({ id: `b${++n}`, text })),
    })),
  };

  // Keep the original file, private to this user.
  const db = admin();
  const safeName = fileName.replace(/[^\w.\-]+/g, "_").slice(0, 80);
  const path = `${user.id}/${Date.now()}-${safeName}`;
  const up = await db.storage.from("resumes").upload(path, buf, { contentType: mime || "application/octet-stream", upsert: false });
  if (up.error) console.error("[resume upload]", up.error.message);

  await db.from("resumes").update({ is_base: false }).eq("user_id", user.id);
  const ins = await db
    .from("resumes")
    .insert({ user_id: user.id, file_path: up.error ? null : path, file_name: fileName, mime_type: mime ?? null, parsed: resume, is_base: true })
    .select("id")
    .single();
  if (ins.error) throw new HttpError(500, "We read your resume but could not save it. Please try again.");

  return { resumeId: ins.data.id, resume, stats: { roles: resume.roles.length, bullets: bulletCount, skills: resume.skills.length } };
});
