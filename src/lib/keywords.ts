/**
 * Shared by the browser and the serverless functions, so it imports nothing
 * from the app. Two jobs: turn text into comparable stems, and pull the terms
 * that matter out of a job posting without spending any money on a model.
 */

/* ------------------------------------------------------------------ */
/* Normalising and stemming                                            */
/* ------------------------------------------------------------------ */

const STOP = new Set(
  "a an and are as at be but by for from has have in into is it its of on or our that the their this to was were will with you your we us they them who whom which while within across per via etc using use used".split(" "),
);

/** Different ways of writing the same thing, collapsed before anything is compared. */
const CANON: [RegExp, string][] = [
  [/\bp\s*&\s*l\b|\bprofit and loss\b|\bprofit & loss\b/g, "pnl"],
  [/\bkey performance indicators?\b|\bkpis?\b/g, "kpi"],
  [/\bcustomer relationship management\b|\bcrm\b/g, "crm"],
  [/\benterprise resource planning\b|\berp\b/g, "erp"],
  [/\bwarehouse management systems?\b|\bwms\b/g, "wms"],
  [/\btransportation management systems?\b|\btms\b/g, "tms"],
  [/\bapplicant tracking systems?\b/g, "ats"],
  [/\bhuman resources\b|\bhr\b/g, "hr"],
  [/\bmicrosoft excel\b|\bms excel\b/g, "excel"],
  [/\bmicrosoft office\b|\bms office\b|\boffice 365\b|\bmicrosoft 365\b/g, "msoffice"],
  [/\bproject management professional\b|\bpmp\b/g, "pmp"],
  [/\bservice level agreements?\b|\bslas?\b/g, "sla"],
  [/\bstandard operating procedures?\b|\bsops?\b/g, "sop"],
  [/\bfull[- ]time equivalents?\b|\bftes?\b/g, "fte"],
  [/\bvendor management\b|\bsupplier management\b/g, "vendor management"],
  [/\bcycle counts?\b|\bcycle counting\b/g, "cycle count"],
  [/\bsix sigma\b|\blean six sigma\b/g, "six sigma"],
  [/\bemr\b|\belectronic medical records?\b|\belectronic health records?\b|\behr\b/g, "emr"],
  [/\bhipaa\b/g, "hipaa"],
];

const SUFFIXES = [
  "ization", "isation", "ational", "ations", "ation", "ments", "ment", "ings", "ing", "ers", "er", "ors", "or",
  "ed", "ly", "ive", "ity", "ness", "ous", "able", "ible", "ance", "ence", "ate", "ates", "al",
];

/**
 * A small stemmer. It is not Porter: it only has to make "manage", "managed",
 * "managing", "management" and "manager" agree, and it errs toward conflating
 * because a missed match costs more here than a false one.
 */
export function stem(word: string): string {
  let w = word;
  if (w.length <= 3) return w;
  if (w.endsWith("ies") && w.length > 4) w = w.slice(0, -3) + "y";
  else if (w.endsWith("sses")) w = w.slice(0, -2);
  else if (w.endsWith("s") && !w.endsWith("ss") && !w.endsWith("us") && !w.endsWith("is")) w = w.slice(0, -1);

  for (const suf of SUFFIXES) {
    if (w.endsWith(suf) && w.length - suf.length >= 4) {
      w = w.slice(0, -suf.length);
      break;
    }
  }
  if (w.endsWith("e") && w.length > 4) w = w.slice(0, -1);
  // "planning" and "plan" agree once the doubled letter goes.
  if (/([bdgklmnprt])\1$/.test(w) && w.length > 4) w = w.slice(0, -1);
  return w;
}

export function canon(text: string): string {
  let t = text.toLowerCase();
  for (const [re, to] of CANON) t = t.replace(re, to);
  return t;
}

/** Stemmed words with filler removed, in order. c++ and c# keep their symbols. */
export function tokens(text: string): string[] {
  return canon(text)
    .replace(/c\+\+/g, "cplusplus")
    .replace(/c#/g, "csharp")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((w) => w && !STOP.has(w))
    .map(stem);
}

/** True when `needle` appears in `hay` as an unbroken run of stems. */
export function containsRun(hay: string[], needle: string[]): boolean {
  if (!needle.length || needle.length > hay.length) return false;
  outer: for (let i = 0; i <= hay.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer;
    return true;
  }
  return false;
}

/**
 * The posting's own wording for a term. A term can be grounded by stem
 * ("delivery driving" against "Delivery Driver") and still not be something the
 * posting says, so the panel shows the posting's words instead. Returns null
 * when no unbroken run of the text matches, and the caller keeps its term.
 */
export function verbatim(text: string, term: string): string | null {
  const run = tokens(term);
  if (!run.length) return null;
  const raw = text.match(/[A-Za-z0-9][A-Za-z0-9+#&'./-]*/g) ?? [];
  const kept: { i: number; s: string }[] = [];
  raw.forEach((w, i) => {
    for (const s of tokens(w)) kept.push({ i, s });
  });
  for (let a = 0; a + run.length <= kept.length; a++) {
    let hit = true;
    for (let j = 0; j < run.length; j++) {
      if (kept[a + j].s !== run[j]) {
        hit = false;
        break;
      }
    }
    if (hit) return raw.slice(kept[a].i, kept[a + run.length - 1].i + 1).join(" ").replace(/[.,;:]+$/, "");
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* A vocabulary of terms that carry weight in postings                 */
/* ------------------------------------------------------------------ */

const LEXICON = [
  // tools and systems
  "excel", "sql", "python", "tableau", "power bi", "powerbi", "salesforce", "hubspot", "zendesk", "sap", "oracle", "netsuite", "workday",
  "quickbooks", "kronos", "adp", "jira", "asana", "smartsheet", "monday.com", "slack", "microsoft project", "ms project", "sharepoint",
  "msoffice", "google sheets", "google workspace", "access", "vlookup", "pivot tables", "macros", "crm", "erp", "wms", "tms", "emr", "epic",
  "cerner", "athenahealth", "medisoft", "intercom", "freshdesk", "gainsight", "outreach", "salesloft", "zoominfo", "powerpoint", "visio", "lucidchart",
  // methods and frameworks
  "six sigma", "lean", "kaizen", "agile", "scrum", "kanban", "waterfall", "pmp", "prince2", "itil", "5s", "root cause analysis", "process improvement",
  "continuous improvement", "change management", "risk management", "quality assurance", "quality control", "sop", "workflow", "process mapping",
  // operations and supply chain
  "inventory management", "inventory control", "inventory planning", "replenishment", "demand planning", "forecasting", "procurement", "purchasing",
  "sourcing", "vendor management", "supplier relationships", "supply chain", "logistics", "warehouse", "distribution", "fulfillment", "shipping",
  "receiving", "cycle count", "shrink", "loss prevention", "freight", "carrier management", "transportation", "fleet", "dispatch", "routing",
  "order management", "order processing", "returns", "reverse logistics", "materials management", "production planning", "scheduling", "capacity planning",
  "facilities management", "safety compliance", "osha", "iso 9001", "regulatory compliance", "compliance", "audit", "auditing", "contracts", "negotiation",
  // management and finance
  "pnl", "budgeting", "budget management", "financial analysis", "cost reduction", "cost control", "kpi", "reporting", "dashboards", "data analysis",
  "data entry", "analytics", "metrics", "forecast", "variance analysis", "expense management", "invoicing", "accounts payable", "accounts receivable",
  "payroll", "hr", "recruiting", "onboarding", "training", "coaching", "mentoring", "performance management", "staffing", "labor management",
  "team leadership", "people management", "cross functional", "stakeholder management", "executive communication", "presentations", "strategic planning",
  // program and project
  "project management", "program management", "project coordination", "program operations", "portfolio management", "roadmap", "timelines",
  "resource planning", "resource allocation", "status reporting", "risk mitigation", "requirements gathering", "user acceptance testing", "uat",
  "vendor coordination", "implementation", "rollout", "go live", "process documentation", "business operations", "business analysis", "operations management",
  // customer and revenue
  "customer success", "customer service", "customer support", "customer experience", "account management", "client relationships", "renewals",
  "retention", "churn", "upsell", "cross sell", "onboarding customers", "sales operations", "sales enablement", "lead generation", "pipeline management",
  "business development", "quota", "revenue operations", "nps", "csat", "escalations", "sla", "help desk", "ticketing", "call center", "service delivery",
  // healthcare administration
  "hipaa", "emr", "revenue cycle", "medical billing", "medical coding", "icd 10", "cpt", "claims", "prior authorization", "insurance verification",
  "patient scheduling", "patient access", "credentialing", "practice management", "clinic operations", "patient experience", "care coordination", "utilization review",
  // credentials
  "bachelor", "mba", "cpa", "pmp certification", "cscp", "cpim", "apics", "cissp", "scrum master", "lean six sigma", "green belt", "black belt", "forklift",
  "cdl", "osha 30", "cpr", "notary", "series 7", "insurance license", "real estate license",
];

const LEXICON_TOKENS = Array.from(new Set(LEXICON))
  .map((term) => ({ term, run: tokens(term) }))
  .filter((x) => x.run.length > 0);

/* ------------------------------------------------------------------ */
/* Pulling terms out of a posting without a model                      */
/* ------------------------------------------------------------------ */

export interface PostingKeywords {
  /** Terms the posting asks for. Weighted double in the score. */
  must: string[];
  /** Terms it lists as preferred, or only mentions. */
  nice: string[];
}

const REQUIRED_CUE = /\b(required|requirements?|must have|must|minimum|proficien\w*|experience (with|in|using)|knowledge of|ability to|responsibilit\w*|you will|qualifications?)\b/i;
const PREFERRED_CUE = /\b(preferred|nice to have|bonus|a plus|desirable|helpful|ideal|would be great)\b/i;

/**
 * Finds known skill terms in the text, weighting a term as required when it
 * sits in a requirement line and as preferred when the line or its heading
 * says so. Deterministic and free, so it can back up a model that fails.
 */
export function extractKeywordsBasic(parts: { required?: string[]; preferred?: string[]; body?: string }): PostingKeywords {
  const found = new Map<string, { score: number; must: boolean; nice: boolean }>();

  const scan = (line: string, kind: "must" | "nice" | "auto") => {
    const hay = tokens(line);
    if (!hay.length) return;
    const isNice = kind === "nice" || (kind === "auto" && PREFERRED_CUE.test(line));
    const isMust = kind === "must" || (kind === "auto" && !isNice && REQUIRED_CUE.test(line));
    for (const { term, run } of LEXICON_TOKENS) {
      if (!containsRun(hay, run)) continue;
      const cur = found.get(term) ?? { score: 0, must: false, nice: false };
      cur.score += 1;
      cur.must ||= isMust;
      cur.nice ||= isNice;
      found.set(term, cur);
    }
  };

  (parts.required ?? []).forEach((l) => scan(l, "must"));
  (parts.preferred ?? []).forEach((l) => scan(l, "nice"));

  // Free text: track a heading like "Preferred qualifications" until the next one.
  let section: "must" | "nice" | "auto" = "auto";
  for (const raw of (parts.body ?? "").split(/\n+|(?<=[.;])\s+/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.length < 60 && PREFERRED_CUE.test(line) && !/[.]$/.test(line)) section = "nice";
    else if (line.length < 60 && REQUIRED_CUE.test(line) && !/[.]$/.test(line)) section = "auto";
    scan(line, section);
  }

  const all = Array.from(found.entries()).sort((a, b) => b[1].score - a[1].score);
  const must = all.filter(([, v]) => v.must && !v.nice).map(([t]) => t);
  const nice = all.filter(([t, v]) => !must.includes(t) && (v.nice || v.score >= 2 || v.must)).map(([t]) => t);
  // A posting with no clear requirement lines still needs something to score against.
  const fallbackMust = must.length ? must : all.filter(([, v]) => v.score >= 2).map(([t]) => t).slice(0, 8);
  return {
    must: fallbackMust.slice(0, 14),
    nice: nice.filter((t) => !fallbackMust.includes(t)).slice(0, 8),
  };
}
