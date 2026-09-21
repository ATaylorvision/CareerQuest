import { BASE_RESUME, type Resume } from "@/data/user";
import type { TailorChange } from "@/data/resumeStudio";
import { renderResumeHtml } from "@/data/resumeTemplates";

export interface BuiltResume extends Resume {
  certsOwnSection: boolean;
  changedIds: Set<string>;
  /** Fields the person retyped themselves, so the document can mark them. */
  editedIds: Set<string>;
}

/** What the person typed straight onto the document, which always wins over a suggestion. */
export interface ManualEdits {
  /** Keyed by field id: "summary", "skills", a bullet id, or "<role id>.title" and friends. */
  fields?: Record<string, string>;
  /** Shared by every version, because these belong to the account rather than one application. */
  contact?: { name?: string; email?: string; phone?: string; location?: string };
  /** Lines the person added under a role, keyed by role id. */
  added?: Record<string, { id: string; text: string }[]>;
}

const ROLE_FIELDS = ["title", "company", "location", "start", "end"] as const;

/**
 * Apply only the accepted changes to the base resume, then whatever the person
 * typed over the top. Nothing else can enter the document.
 */
export function buildResume(changes: TailorChange[], decisions: Record<string, string>, manual: ManualEdits = {}): BuiltResume {
  const r = structuredClone(BASE_RESUME) as Resume;
  const changedIds = new Set<string>();
  const editedIds = new Set<string>();
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
  const fields = manual.fields ?? {};
  const put = (id: string, apply: (v: string) => void) => {
    const v = fields[id];
    if (v === undefined) return;
    apply(v);
    editedIds.add(id);
  };

  put("summary", (v) => void (r.summary = v));
  put("skills", (v) => void (r.skills = v.split(/,\s*(?![^()]*\))/).map((x) => x.trim()).filter(Boolean)));
  put("education", (v) => void (r.education = v.split(/\s*\|\s*/).map((x) => x.trim()).filter(Boolean)));
  put("certifications", (v) => void (r.certifications = v.split(/\s*\|\s*/).map((x) => x.trim()).filter(Boolean)));
  const addedIds = new Set<string>();
  for (const role of r.roles) {
    for (const a of manual.added?.[role.id] ?? []) {
      role.bullets.push({ id: a.id, text: a.text });
      addedIds.add(a.id);
    }
    for (const f of ROLE_FIELDS) put(`${role.id}.${f}`, (v) => void (role[f] = v));
    role.bullets = role.bullets
      .map((b) => {
        // A line the person added is theirs from the start, even if never retyped.
        if (addedIds.has(b.id)) editedIds.add(b.id);
        const v = fields[b.id];
        if (v === undefined) return b;
        editedIds.add(b.id);
        return { ...b, text: v };
      })
      // An emptied line is a deleted line. It is the only way to remove one by typing.
      .filter((b) => b.text.trim().length > 0);
  }

  const c = manual.contact ?? {};
  for (const k of ["name", "email", "phone", "location"] as const) {
    if (c[k] !== undefined && c[k] !== "") {
      r[k] = c[k]!;
      editedIds.add(`contact.${k}`);
    }
  }

  return { ...r, certsOwnSection, changedIds, editedIds };
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

/** Opens finished HTML in a print window. Returns false if a pop up blocker stopped it. */
export function printHtml(html: string): boolean {
  const w = window.open("", "_blank", "width=860,height=1040");
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  // The opener starts the print, rather than a script inside the document.
  // That keeps inline scripts out of the page, which is what lets the site's
  // content security policy refuse them everywhere. The load event may already
  // have fired by now, so check for that instead of waiting on it forever.
  const go = () => setTimeout(() => w.print(), 250);
  if (w.document.readyState === "complete") go();
  else w.addEventListener("load", go, { once: true });
  return true;
}

/** Opens the chosen layout in a print window. Returns false if a pop up blocker stopped it. */
export function printResume(r: BuiltResume, title: string, templateId?: string, headline?: string) {
  return printHtml(renderResumeHtml(r, templateId, title, headline));
}
