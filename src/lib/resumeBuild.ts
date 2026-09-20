import { BASE_RESUME, type Resume } from "@/data/user";
import type { TailorChange } from "@/data/resumeStudio";
import { renderResumeHtml } from "@/data/resumeTemplates";

export interface BuiltResume extends Resume {
  certsOwnSection: boolean;
  changedIds: Set<string>;
}

/** Apply only the accepted changes to the base resume. Nothing else can enter the document. */
export function buildResume(changes: TailorChange[], decisions: Record<string, string>): BuiltResume {
  const r = structuredClone(BASE_RESUME) as Resume;
  const changedIds = new Set<string>();
  let certsOwnSection = false;
  for (const c of changes) {
    if (decisions[c.id] !== "accepted") continue;
    if (c.sourceId === "summary") {
      r.summary = c.tailored;
      changedIds.add("summary");
    } else if (c.sourceId === "skills") {
      r.skills = c.tailored.split(/,\s*(?![^()]*\))/);
      changedIds.add("skills");
    } else if (c.sourceId === "certs") {
      certsOwnSection = true;
      changedIds.add("certs");
    } else {
      for (const role of r.roles) {
        const idx = role.bullets.findIndex((b) => b.id === c.sourceId);
        if (idx === -1) continue;
        role.bullets[idx] = { ...role.bullets[idx], text: c.tailored };
        if (c.type === "reorder" && idx > 0) {
          const [b] = role.bullets.splice(idx, 1);
          role.bullets.unshift(b);
        }
        changedIds.add(c.sourceId);
      }
    }
  }
  return { ...r, certsOwnSection, changedIds };
}

export function resumeToText(r: BuiltResume) {
  const lines = [
    r.name.toUpperCase(),
    `${r.location} | ${r.phone} | ${r.email}`,
    "",
    "SUMMARY",
    r.summary,
    "",
    "EXPERIENCE",
  ];
  r.roles.forEach((role) => {
    lines.push(`${role.title}, ${role.company}, ${role.location}   ${role.start} to ${role.end}`);
    role.bullets.forEach((b) => lines.push(`  - ${b.text}`));
    lines.push("");
  });
  lines.push("EDUCATION", ...r.education);
  if (!r.certsOwnSection) lines.push(...r.certifications);
  if (r.certsOwnSection) lines.push("", "CERTIFICATIONS", ...r.certifications);
  lines.push("", "SKILLS", r.skills.join(", "));
  return lines.join("\n");
}

export function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Opens the chosen layout in a print window. Returns false if a pop up blocker stopped it. */
export function printResume(r: BuiltResume, title: string, templateId?: string, headline?: string) {
  const w = window.open("", "_blank", "width=860,height=1040");
  if (!w) return false;
  const html = renderResumeHtml(r, templateId, title, headline);
  // The print call is appended rather than baked into the template, so the
  // same markup can be reused for the on screen previews without printing.
  w.document.write(html.replace("</body>", "<script>window.onload=()=>setTimeout(()=>window.print(),250)<\/script></body>"));
  w.document.close();
  return true;
}
