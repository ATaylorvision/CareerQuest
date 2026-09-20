import type { Company } from "@/data/companies";
import type { Gap } from "@/data/gaps";
import type { Category, Job, LiveTranslation, RequirementCheck, TargetField, WorkMode } from "@/data/jobs";
import type { LegitSignals } from "@/lib/legit";

export interface JobRow {
  id: string;
  title: string;
  company: string;
  location: string | null;
  remote_type: string | null;
  salary_min: number | null;
  salary_max: number | null;
  description: string | null;
  apply_url: string | null;
  employer_posted: boolean | null;
  posted_at: string | null;
  ats_provider: string | null;
  company_site_status: string;
  company_site_checked_at: string | null;
  legit: Job["legit"] | null;
  raw: { signals?: LegitSignals } | null;
}

export interface MatchRow {
  score: number;
  breakdown: Job["breakdown"] | null;
  why: string | null;
  gaps: Gap[] | null;
  career_changer_friendly: boolean | null;
  dismissed: boolean;
  translator: {
    field?: string;
    category?: string;
    enriched?: boolean;
    story?: string;
    translations?: LiveTranslation[];
    requirements?: RequirementCheck[];
  } | null;
}

const MODE: Record<string, WorkMode> = { remote: "Remote", hybrid: "Hybrid", onsite: "Onsite", unknown: "Not stated" };

function hue(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

export function companyFor(name: string, agency: boolean): Company {
  const words = name.replace(/[^A-Za-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  return {
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    name,
    industry: "",
    size: "",
    hq: "",
    founded: 0,
    rating: 0,
    ratingCount: 0,
    layoffs: "",
    hiringTrend: "",
    careerChangers: "",
    about: "",
    isAgency: agency,
    initials: (words[0]?.[0] ?? "?").toUpperCase() + (words[1]?.[0] ?? "").toUpperCase(),
    hue: hue(name),
  };
}

const NOT_AUTOMATED =
  "CareerQuest cannot submit to this employer's application system for you yet. Open the application on their page, and we will keep a record of what you sent so it shows up in your tracker and Proof Score.";

export function rowToJob(row: JobRow, match: MatchRow): Job {
  const daysAgo = row.posted_at ? Math.max(0, Math.floor((Date.now() - new Date(row.posted_at).getTime()) / 86_400_000)) : 0;
  const t = match.translator ?? {};
  const desc = row.description ?? "";
  const signals: LegitSignals =
    row.raw?.signals ?? { firstPostedDaysAgo: daysAgo, reposts90: 0, companySite: "unconfirmed", poster: "employer", salaryListed: false, applicantTrend: "unknown" };
  const confirmed = row.company_site_status === "confirmed";
  const salary: Job["salary"] = row.salary_min && row.salary_max ? [row.salary_min, row.salary_max] : null;

  return {
    id: row.id,
    title: row.title,
    company: companyFor(row.company, row.employer_posted === false),
    location: row.location || "Location not listed",
    mode: MODE[row.remote_type ?? "unknown"] ?? "Not stated",
    salary,
    postedDaysAgo: daysAgo,
    applicants: null,
    category: (t.category as Category) ?? "Operations",
    careerChangerFriendly: !!match.career_changer_friendly,
    why: match.why ?? "",
    summary: desc.slice(0, 320),
    responsibilities: [],
    requirements: (t.requirements ?? []).map((r) => r.text),
    niceToHave: [],
    gaps: match.gaps ?? [],
    target: (t.field as TargetField) ?? "supply",
    applyMethod: "manual",
    manualReason: NOT_AUTOMATED,
    source: confirmed ? `${row.company} careers page` : row.employer_posted === false ? "Staffing agency listing" : "Job board listing",
    signals,
    legit: row.legit ?? { score: 50, badge: "active", factors: [] },
    breakdown: match.breakdown ?? { experience: match.score, skills: match.score, industry: match.score, transferable: match.score },
    match: match.score,
    isNew: daysAgo <= 2,
    live: true,
    applyUrl: row.apply_url ?? undefined,
    descriptionText: desc,
    reqChecks: t.requirements ?? [],
    translations: t.translations ?? [],
    storyLine: t.story ?? "",
    atsProvider: row.ats_provider ?? undefined,
    checkedAt: row.company_site_checked_at ?? undefined,
    // Marks jobs whose full analysis (translations, requirement checks, gaps) has not run yet.
    ...(t.enriched ? {} : { translations: undefined }),
  };
}

export const isEnriched = (j: Job) => !!j.live && j.translations !== undefined;
