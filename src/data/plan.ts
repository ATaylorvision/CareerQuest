export type Intensity = "casual" | "active" | "urgent";

export const INTENSITY_META: Record<Intensity, { label: string; actions: number; apps: string; blurb: string }> = {
  casual: { label: "Casual", actions: 3, apps: "1 to 2 applications a week", blurb: "You are employed or have time. Quality over volume." },
  active: { label: "Active", actions: 4, apps: "3 to 5 applications a week", blurb: "A steady search you can keep up for months." },
  urgent: { label: "Urgent", actions: 5, apps: "6 to 10 applications a week", blurb: "You need a job soon. More actions, still small ones." },
};

export interface PlanItem {
  id: string;
  title: string;
  detail: string;
  minutes: number;
  to: string;
  cta: string;
  kind: "apply" | "network" | "learn" | "log" | "review" | "prep";
}

export function buildPlan(opts: { northvaleMatch: number; closesDay: string; wmsCount: number; savedTotal: number }): PlanItem[] {
  return [
    { id: "p1", title: "Review 3 new matches from overnight", detail: "Two are Verified Live. One is a 93 percent match at Fieldstone.", minutes: 5, to: "/app/matches", cta: "Open matches", kind: "review" },
    { id: "p2", title: "Log notes from your Cedarline screening call", detail: "While it is fresh. Future you will thank you before the next round.", minutes: 5, to: "/app/receipts/a09", cta: "Open receipt", kind: "log" },
    { id: "p3", title: `Tailor your resume for the Operations Manager role at Northvale Supply Co.`, detail: `It is a ${opts.northvaleMatch} percent match and closes ${opts.closesDay}.`, minutes: 15, to: "/app/studio?job=j01", cta: "Tailor resume", kind: "apply" },
    { id: "p4", title: "Send a note to Marcus Reyes", detail: "He worked at Harbor & Pine Home too and is now at Cedarline Logistics. The draft is ready.", minutes: 5, to: "/app/connections?person=p1", cta: "See the draft", kind: "network" },
    { id: "p5", title: "Spend 20 minutes on the WMS gap", detail: `It shows up in ${opts.wmsCount} of your ${opts.savedTotal} saved jobs. Start with the free video series.`, minutes: 20, to: "/app/roadmap?gap=wms", cta: "Open roadmap", kind: "learn" },
  ];
}

export const SEED_PLAN_DONE: Record<string, boolean> = { p1: true, p2: true };

/** Activity history for the last 21 days (index 0 = today). true = at least one action completed. */
export const SEED_ACTIVITY = [true, true, true, true, true, true, true, true, true, false, false, true, true, true, false, true, true, false, true, true, true];
