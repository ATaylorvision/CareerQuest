import type { AppState } from "@/store/AppStore";
import { JOBS, type Job } from "@/data/jobs";
import { INTENSITY_META, type PlanItem } from "@/data/plan";
import { diffDays } from "@/lib/date";
import { TARGET_FIELDS } from "@/data/translator";
import { gapAggregate } from "@/lib/selectors";

/** YYYY-MM-DD in the user's local time. Plan ids include it so each day starts fresh. */
export const localDay = () => new Date().toLocaleDateString("en-CA");

/**
 * Builds today's small actions from the user's own data. Nothing here is invented:
 * every item points at a real match, application, or gap.
 */
export function buildLivePlan(state: AppState): PlanItem[] {
  const day = localDay();
  const id = (k: string) => `${day}:${k}`;
  const visible = JOBS.filter((j) => j.legit.score >= state.legitThreshold && !state.dismissedJobIds.includes(j.id));
  const appliedIds = new Set(state.applications.filter((a) => a.receipt?.submittedAt).map((a) => a.jobId));
  const savedIds = new Set(state.applications.map((a) => a.jobId));
  const ranked = [...visible].sort((a, b) => b.match - a.match);
  const items: PlanItem[] = [];

  if (JOBS.length === 0) {
    return [
      { id: id("find"), title: "Find your first matches", detail: "We will pull live listings for your target roles and score each one against your resume.", minutes: 2, to: "/app/matches", cta: "Find jobs", kind: "review" },
      { id: id("translate"), title: "See how your experience translates", detail: "Pick the field you want and read your own resume in its language.", minutes: 5, to: "/app/studio", cta: "Open Studio", kind: "learn" },
      { id: id("wren"), title: "Tell Wren what you are aiming for", detail: "A two minute chat helps Wren give sharper advice.", minutes: 3, to: "/app/copilot", cta: "Open Wren", kind: "review" },
    ];
  }

  // 1. The best match you have not acted on.
  const best = ranked.find((j) => !appliedIds.has(j.id));
  if (best) {
    items.push({
      id: id("best"),
      title: `Look closely at ${best.title} at ${best.company.name}`,
      detail: `It is your strongest open match at ${best.match} percent${best.legit.badge === "verified" ? ", and confirmed live on the employer's own careers page" : ""}. Check the gaps and decide.`,
      minutes: 10,
      to: `/app/jobs/${best.id}`,
      cta: "Open the job",
      kind: "apply",
    });
  }

  // 2. Follow up on something already sent.
  const waiting = state.applications
    .filter((a) => a.column === "applied" && a.receipt?.submittedAt && diffDays(a.receipt.submittedAt) >= 7)
    .sort((a, b) => diffDays(b.receipt!.submittedAt!) - diffDays(a.receipt!.submittedAt!))[0];
  const waitingJob = waiting ? JOBS.find((j) => j.id === waiting.jobId) : undefined;
  if (waiting && waitingJob) {
    items.push({
      id: id(`follow-${waiting.id}`),
      title: `Check in on ${waitingJob.title} at ${waitingJob.company.name}`,
      detail: `You applied ${diffDays(waiting.receipt!.submittedAt!)} days ago. Log any update on the receipt, or note that you have not heard back.`,
      minutes: 5,
      to: `/app/receipts/${waiting.id}`,
      cta: "Open receipt",
      kind: "log",
    });
  }

  // 3. Save roles worth tracking.
  const unsaved = ranked.filter((j) => !savedIds.has(j.id)).slice(0, 3);
  if (savedIds.size < 3 && unsaved.length) {
    items.push({
      id: id("save"),
      title: `Save ${Math.min(3 - savedIds.size, unsaved.length)} roles you would actually take`,
      detail: "Saved roles feed your Skill Gap Roadmap, so it shows the gaps that matter to you.",
      minutes: 5,
      to: "/app/matches",
      cta: "Review matches",
      kind: "review",
    });
  }

  // 4. The most common gap across the strongest matches.
  const agg = gapAggregate(state);
  let topGap = agg.items[0]?.gap;
  let gapCount = agg.items[0]?.jobs.length ?? 0;
  let gapTotal = agg.total;
  if (!topGap) {
    const counts = new Map<string, { gap: Job["gaps"][number]; n: number }>();
    ranked.slice(0, 10).forEach((j) => j.gaps.forEach((g) => counts.set(g.id, { gap: g, n: (counts.get(g.id)?.n ?? 0) + 1 })));
    const top = [...counts.values()].sort((a, b) => b.n - a.n)[0];
    if (top) {
      topGap = top.gap;
      gapCount = top.n;
      gapTotal = Math.min(10, ranked.length);
    }
  }
  if (topGap && topGap.severity !== "dealbreaker") {
    items.push({
      id: id(`gap-${topGap.id}`),
      title: `Spend 20 minutes on ${topGap.label}`,
      detail: `It shows up in ${gapCount} of your ${gapTotal} strongest matches. Your roadmap has free ways to start.`,
      minutes: 20,
      to: `/app/roadmap?gap=${topGap.id}`,
      cta: "Open roadmap",
      kind: "learn",
    });
  }

  // 5. Fillers that are always true and always useful.
  const field = TARGET_FIELDS.find((t) => t.id === state.prefs.targetField);
  items.push({
    id: id("translate"),
    title: `Read how your experience translates for ${field?.label.toLowerCase() ?? "your target field"}`,
    detail: "Use the wording in your resume and in interviews.",
    minutes: 5,
    to: "/app/studio",
    cta: "Open Studio",
    kind: "learn",
  });
  items.push({
    id: id("wren"),
    title: "Ask Wren one question about your search",
    detail: "A gap, a weak match, how to explain a career change. Anything on your mind.",
    minutes: 5,
    to: "/app/copilot",
    cta: "Open Wren",
    kind: "review",
  });

  return items.slice(0, INTENSITY_META[state.prefs.intensity].actions);
}
