import type { Job } from "@/data/jobs";

/** A skill or experience the person told us they have, that a posting asked for and their resume did not show. */
export interface SkillClaim {
  /** The gap it answers: a library id, or one we made up for this person's jobs. */
  gapId: string;
  label: string;
  level: "started" | "some" | "comfortable" | "expert";
  /** A role id from their resume, or "outside" for school, volunteering or personal projects. */
  roleId: string;
  /** Free text when it was outside a job. */
  where: string;
  /** What they did with it, in their words. */
  detail: string;
  /** Anything else worth knowing. Read when their resume is tailored to a job that wants this. */
  extra: string;
  /** The resume line they chose, if they chose one. */
  line: string;
  at: string;
}

export const LEVELS: { id: SkillClaim["level"]; label: string; hint: string }[] = [
  { id: "started", label: "Just started", hint: "I have tried it, or I am learning it." },
  { id: "some", label: "Some experience", hint: "I have used it a few times." },
  { id: "comfortable", label: "Comfortable", hint: "I use it regularly and could do it on my own." },
  { id: "expert", label: "Expert", hint: "I could teach it to someone else." },
];

const STOP = new Set(["experience", "skills", "skill", "knowledge", "ability", "proficiency", "using", "with", "years", "strong", "working", "understanding", "familiarity", "background", "including", "related", "creation", "creating", "management", "based"]);

/** The words in a phrase that say what it is about. */
export function keyWords(text: string): string[] {
  return [
    ...new Set(
      text
        .toLowerCase()
        .replace(/[^a-z0-9+#. ]/g, " ")
        .split(/\s+/)
        .map((w) => w.replace(/^\.+|\.+$/g, ""))
        .filter((w) => w.length >= 4 && !STOP.has(w)),
    ),
  ];
}

/** Does a piece of text (a requirement, a posting) mention what this claim is about? */
export function claimMatches(claim: Pick<SkillClaim, "label" | "gapId">, text: string): boolean {
  const t = text.toLowerCase();
  const words = keyWords(claim.label);
  if (!words.length) return false;
  // Every key word of a short label, or the one that names the thing, has to appear.
  return words.length <= 2 ? words.every((w) => t.includes(w)) : words.filter((w) => t.includes(w)).length >= Math.ceil(words.length / 2);
}

/** The claim that answers a requirement, if the person has told us they have it. */
export function claimForRequirement(claims: Record<string, SkillClaim> | undefined, requirement: string): SkillClaim | undefined {
  return Object.values(claims ?? {}).find((c) => claimMatches(c, requirement));
}

/** Claims that bear on a particular job: it listed the gap, or its posting talks about the skill. */
export function relevantClaims(job: Job, claims: Record<string, SkillClaim> | undefined): SkillClaim[] {
  const text = `${job.title} ${job.descriptionText ?? job.summary} ${(job.reqChecks ?? []).map((r) => r.text).join(" ")} ${(job.keywords?.must ?? []).join(" ")}`;
  return Object.values(claims ?? {}).filter((c) => job.gaps.some((g) => g.id === c.gapId) || claimMatches(c, text));
}
