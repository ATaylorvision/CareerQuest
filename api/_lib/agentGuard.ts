import { numbersSupported } from "./claude.js";

/**
 * The rules that stand between what the model writes and what a person sees.
 * Wren proposes; nothing here trusts the proposal. It is dropped unless it
 * points at something real on the page and claims nothing the person has not said.
 */

export interface Snapshot {
  summary: string;
  skills: string[];
  roles: { id: string; title: string; company: string; bullets: { id: string; text: string }[] }[];
}

export interface RawProposal {
  kind: string;
  field: string;
  role_id: string;
  after: string;
  why: string;
}

export interface Proposal {
  id: string;
  kind: "replace" | "add";
  /** "summary", "skills" or a line id for a replacement. Empty for an added line. */
  field: string;
  /** The role an added line goes under. Empty for a replacement. */
  roleId: string;
  before: string;
  after: string;
  why: string;
}

const clip = (s: unknown, n: number) => (typeof s === "string" ? s.slice(0, n) : "");

/** Reads what the browser sent as the current page. Anything malformed becomes empty rather than an error. */
export function cleanSnapshot(x: unknown): Snapshot | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  const roles = Array.isArray(o.roles) ? o.roles.slice(0, 12) : [];
  const snap: Snapshot = {
    summary: clip(o.summary, 1500),
    skills: (Array.isArray(o.skills) ? o.skills : []).slice(0, 60).map((s) => clip(s, 80)).filter(Boolean),
    roles: roles
      .map((r) => {
        const ro = (r ?? {}) as Record<string, unknown>;
        return {
          id: clip(ro.id, 60),
          title: clip(ro.title, 120),
          company: clip(ro.company, 120),
          bullets: (Array.isArray(ro.bullets) ? ro.bullets : [])
            .slice(0, 12)
            .map((b) => ({ id: clip((b as Record<string, unknown>)?.id, 60), text: clip((b as Record<string, unknown>)?.text, 500) }))
            .filter((b) => b.id && b.text),
        };
      })
      .filter((r) => r.id),
  };
  if (!snap.roles.length && !snap.summary) return null;
  return snap;
}

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9+#. ]/g, " ").replace(/\s+/g, " ").trim();
const splitSkills = (s: string) => s.split(/,\s*(?![^()]*\))/).map((x) => x.trim()).filter(Boolean);
const significant = (s: string) => new Set(norm(s).split(" ").filter((w) => w.length >= 5));

export function textOf(snap: Snapshot): string {
  return [snap.summary, snap.skills.join(", "), ...snap.roles.flatMap((r) => [r.title, r.company, ...r.bullets.map((b) => b.text)])].join("\n");
}

/**
 * `said` is what the person has told Wren in this conversation. A line may only
 * carry a number, a skill or a fact that is on the page or in `said`. The
 * posting is context for wording only; it never supports a claim.
 */
export function validateProposals(raw: RawProposal[], snap: Snapshot, said: string): Proposal[] {
  const page = textOf(snap);
  const pageNorm = norm(page);
  const saidNorm = norm(said);
  const saidWords = significant(said);
  const lines = new Map(snap.roles.flatMap((r) => r.bullets.map((b) => [b.id, b.text] as const)));
  const roleIds = new Set(snap.roles.map((r) => r.id));
  const seen = new Set<string>();
  const out: Proposal[] = [];

  for (const p of raw) {
    const after = clip(p.after, 600).trim();
    const why = clip(p.why, 300).trim();
    if (!after || !why) continue;
    // A number is a claim about the person, so it cannot come from the posting.
    if (!numbersSupported(after, page, said)) continue;

    if (p.kind === "replace") {
      const field = p.field;
      const before = field === "summary" ? snap.summary : field === "skills" ? snap.skills.join(", ") : lines.get(field);
      if (before === undefined || seen.has(field)) continue;
      if (norm(after) === norm(before)) continue;
      if (field === "skills") {
        // A new skill has to come from the person, never from the posting.
        const have = new Set(snap.skills.map(norm));
        const invented = splitSkills(after).some((s) => !have.has(norm(s)) && !pageNorm.includes(norm(s)) && !saidNorm.includes(norm(s)));
        if (invented) continue;
      } else if (words(after) < (field === "summary" ? 8 : 4)) continue;
      seen.add(field);
      out.push({ id: `p${out.length + 1}`, kind: "replace", field, roleId: "", before, after, why });
    } else if (p.kind === "add") {
      if (!roleIds.has(p.role_id) || words(after) < 5) continue;
      // An added line must come from what the person just told us, not from the model.
      const shared = [...significant(after)].filter((w) => saidWords.has(w)).length;
      if (shared < Math.max(1, Math.min(2, saidWords.size))) continue;
      out.push({ id: `p${out.length + 1}`, kind: "add", field: "", roleId: p.role_id, before: "", after, why });
    }
    if (out.length >= 6) break;
  }
  return out;
}

/** Options for a single line. Each has to stand on what the person wrote, and carry no number they did not write. */
export function validateOptions(options: string[], notes: string): string[] {
  const noteWords = significant(notes);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of options) {
    const t = clip(raw, 500).trim();
    if (words(t) < 5 || seen.has(norm(t))) continue;
    // A number here has to be one the person just wrote. Borrowing a result from another line would pin it on something it was not.
    if (!numbersSupported(t, notes)) continue;
    if ([...significant(t)].filter((w) => noteWords.has(w)).length < Math.max(1, Math.min(2, noteWords.size))) continue;
    seen.add(norm(t));
    out.push(t);
  }
  return out.slice(0, 3);
}
