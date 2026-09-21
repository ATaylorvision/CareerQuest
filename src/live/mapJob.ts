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
  latitude: number | null;
  longitude: number | null;
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
  source?: string;
  keywords?: { must?: string[]; nice?: string[] } | null;
  raw: { signals?: LegitSignals } | null;
}

export interface MatchRow {
  score: number;
  breakdown: Job["breakdown"] | null;
  why: string | null;
  gaps: Gap[] | null;
  career_changer_friendly: boolean | null;
  dismissed: boolean;
  /** When this was first shown to the person, and how far it is from the nearest place they named. */
  first_shown_at?: string | null;
  distance_miles?: number | null;
  kept?: boolean | null;
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

/**
 * Where the signed in person lives, set once when their profile loads. Job rows
 * are shared between users, so the distance has to be worked out here rather
 * than stored on the listing.
 */
let homePoint: { lat: number; lng: number } | null = null;
export const setHomePoint = (p: { lat: number; lng: number } | null) => void (homePoint = p);

const EARTH_MILES = 3958.8;
const rad = (d: number) => (d * Math.PI) / 180;

function milesFromHome(lat: number | null, lng: number | null): number | null {
  if (!homePoint || lat == null || lng == null) return null;
  const dLat = rad(lat - homePoint.lat);
  const dLng = rad(lng - homePoint.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(homePoint.lat)) * Math.cos(rad(lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * EARTH_MILES * Math.asin(Math.min(1, Math.sqrt(s))));
}

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
    source: row.source === "imported" ? "Added by you" : row.source === "linkedin" && !confirmed ? "LinkedIn listing" : confirmed ? `${row.company} careers page` : row.employer_posted === false ? "Staffing agency listing" : "Job board listing",
    imported: row.source === "imported",
    signals,
    legit: row.legit ?? { score: 50, badge: "active", factors: [] },
    breakdown: match.breakdown ?? { experience: match.score, skills: match.score, industry: match.score, transferable: match.score },
    match: match.score,
    // New means new to this person, which is when it first reached them and not when it was posted.
    isNew: match.first_shown_at ? Date.now() - new Date(match.first_shown_at).getTime() <= 3 * 86_400_000 : daysAgo <= 2,
    live: true,
    applyUrl: row.apply_url ?? undefined,
    descriptionText: desc,
    keywords: row.keywords && (row.keywords.must?.length || row.keywords.nice?.length) ? { must: row.keywords.must ?? [], nice: row.keywords.nice ?? [] } : null,
    reqChecks: t.requirements ?? [],
    translations: t.translations ?? [],
    storyLine: t.story ?? "",
    atsProvider: row.ats_provider ?? undefined,
    checkedAt: row.company_site_checked_at ?? undefined,
    distanceMiles: row.remote_type === "remote" ? null : (match.distance_miles ?? milesFromHome(row.latitude, row.longitude)),
    shownAt: match.first_shown_at ?? undefined,
    kept: !!match.kept,
    // Marks jobs whose full analysis (translations, requirement checks, gaps) has not run yet.
    ...(t.enriched ? {} : { translations: undefined }),
  };
}

export const isEnriched = (j: Job) => !!j.live && j.translations !== undefined;
