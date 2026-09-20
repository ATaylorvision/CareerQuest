// Real job listings from Adzuna and (when subscribed) JSearch.

export interface RawJob {
  source: "adzuna" | "jsearch";
  external_id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  apply_url: string;
  posted_at: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_period: string | null;
  employer_posted: boolean | null;
  remote_hint: boolean;
  category?: string;
}

async function getJson(url: string, init?: RequestInit, ms = 12_000): Promise<unknown> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { ...init, signal: ctl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

const clean = (s: unknown) => String(s ?? "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

interface AdzunaResult {
  id: string;
  title: string;
  company?: { display_name?: string };
  location?: { display_name?: string };
  description?: string;
  redirect_url?: string;
  created?: string;
  salary_min?: number;
  salary_max?: number;
  salary_is_predicted?: string;
  category?: { label?: string };
}

export async function adzunaSearch(what: string, where: string, opts: { maxDaysOld?: number; perPage?: number; remote?: boolean } = {}): Promise<RawJob[]> {
  const id = process.env.ADZUNA_APP_ID;
  const key = process.env.ADZUNA_APP_KEY;
  if (!id || !key) return [];
  const q = new URLSearchParams({
    app_id: id,
    app_key: key,
    results_per_page: String(opts.perPage ?? 20),
    what,
    title_only: what,
    sort_by: "date",
    max_days_old: String(opts.maxDaysOld ?? 30),
    "content-type": "application/json",
  });
  q.delete("what");
  if (where && !/^remote/i.test(where)) {
    q.set("where", where);
    q.set("distance", "40");
  }
  if (opts.remote) q.set("what_and", "remote");
  const data = (await getJson(`https://api.adzuna.com/v1/api/jobs/us/search/1?${q}`)) as { results?: AdzunaResult[] };
  return (data.results ?? []).map((r): RawJob => {
    const predicted = r.salary_is_predicted === "1";
    const hasSalary = !predicted && !!r.salary_min && !!r.salary_max && r.salary_min > 10000;
    const text = `${r.title} ${r.description} ${r.location?.display_name}`;
    return {
      source: "adzuna",
      external_id: String(r.id),
      title: clean(r.title),
      company: clean(r.company?.display_name) || "Company not named",
      location: clean(r.location?.display_name),
      description: clean(r.description),
      apply_url: r.redirect_url ?? "",
      posted_at: r.created ?? null,
      salary_min: hasSalary ? Math.round(r.salary_min!) : null,
      salary_max: hasSalary ? Math.round(r.salary_max!) : null,
      salary_period: hasSalary ? "year" : null,
      employer_posted: null,
      remote_hint: /\b(remote|work from home|telecommut)/i.test(text),
      category: r.category?.label,
    };
  });
}

interface JSearchResult {
  job_id: string;
  job_title: string;
  employer_name?: string;
  job_city?: string;
  job_state?: string;
  job_country?: string;
  job_is_remote?: boolean;
  job_description?: string;
  job_apply_link?: string;
  job_posted_at_datetime_utc?: string;
  job_min_salary?: number;
  job_max_salary?: number;
  job_salary_period?: string;
  job_publisher?: string;
  job_apply_is_direct?: boolean;
  apply_options?: { apply_link: string; is_direct: boolean; publisher?: string }[];
}

/** Returns [] quietly if the RapidAPI key is not subscribed to JSearch yet. */
export async function jsearchSearch(query: string): Promise<RawJob[]> {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) return [];
  try {
    const q = new URLSearchParams({ query, page: "1", num_pages: "1", date_posted: "month" });
    const data = (await getJson(`https://jsearch.p.rapidapi.com/search-v2?${q}`, {
      headers: { "x-rapidapi-key": key, "x-rapidapi-host": "jsearch.p.rapidapi.com" },
    })) as { data?: { jobs?: JSearchResult[] } };
    return (data.data?.jobs ?? []).map((r): RawJob => ({
      source: "jsearch",
      external_id: r.job_id,
      title: clean(r.job_title),
      company: clean(r.employer_name) || "Company not named",
      location: r.job_is_remote ? "Remote" : [r.job_city, r.job_state].filter(Boolean).join(", "),
      description: clean(r.job_description).slice(0, 12000),
      // Prefer a link straight to the employer when the listing offers one.
      apply_url: r.apply_options?.find((o) => o.is_direct)?.apply_link ?? r.job_apply_link ?? "",
      posted_at: r.job_posted_at_datetime_utc ?? null,
      salary_min: r.job_min_salary && r.job_salary_period === "YEAR" ? Math.round(r.job_min_salary) : null,
      salary_max: r.job_max_salary && r.job_salary_period === "YEAR" ? Math.round(r.job_max_salary) : null,
      salary_period: r.job_min_salary && r.job_salary_period === "YEAR" ? "year" : null,
      // "Not direct" only means it came through a job board, so agency status is left to the text checks.
      employer_posted: null,
      remote_hint: !!r.job_is_remote,
    }));
  } catch {
    return [];
  }
}

const AGENCY_NAME = /(staffing|recruit|talent|workforce|search group|placement|personnel|headhunt|manpower|randstad|adecco|robert half|kelly services|insight global|teksystems|aerotek|hire\b|jobs\b)/i;
const AGENCY_TEXT = /(our client|on behalf of (a|our) client|confidential (client|company)|client of ours)/i;
const EVERGREEN = /(always hiring|talent pool|talent network|pipeline of|future (openings|opportunities)|current and future|evergreen|continuous(ly)? (hiring|recruiting))/i;

export function looksLikeAgency(r: Pick<RawJob, "company" | "description" | "employer_posted">): boolean {
  if (r.employer_posted === false) return true;
  return AGENCY_NAME.test(r.company) || AGENCY_TEXT.test(r.description);
}

export function looksEvergreen(r: Pick<RawJob, "title" | "description">): boolean {
  return EVERGREEN.test(r.description) || /\b(ongoing|open)\s+(requisition|recruitment)\b/i.test(r.title);
}

export function remoteType(r: Pick<RawJob, "title" | "description" | "location" | "remote_hint">): "remote" | "hybrid" | "onsite" | "unknown" {
  const t = `${r.title} ${r.description} ${r.location}`;
  if (/\bhybrid\b/i.test(t)) return "hybrid";
  if (r.remote_hint || /\bremote\b/i.test(r.location)) return "remote";
  if (/\bon[- ]?site\b|\bin[- ]office\b/i.test(t)) return "onsite";
  return "unknown";
}
