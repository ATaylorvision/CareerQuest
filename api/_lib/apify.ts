import { HttpError } from "./http.js";
import { stateCode, type RawJob } from "./sources.js";

/**
 * LinkedIn listings, through an Apify scraper.
 *
 * Nothing here can spend more than the limits below, whatever the browser asks
 * for: every run carries its own price cap and result cap, and the server
 * refuses to start one past the daily limits. Apify's own monthly limit on the
 * account is the last backstop.
 */

/** Chosen after a test run: the most used LinkedIn jobs scraper, with structured, local results. */
const ACTOR = () => (process.env.APIFY_ACTOR || "curious_coder~linkedin-jobs-scraper").replace("/", "~");

export const LIMITS = {
  /** Listings requested per search. */
  maxItems: 25,
  /** The most a single run may cost, in dollars. A full run is about five cents. */
  maxChargeUsd: 0.25,
  /** Seconds before Apify stops a run that is still going. */
  timeoutSecs: 90,
  memoryMb: 1024,
  /** Searches one person can start in a day. */
  perUserPerDay: 3,
  /** Searches everyone together can start in a day. */
  globalPerDay: 40,
};

export const hasApify = () => !!process.env.APIFY_TOKEN?.trim();

async function apify<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = process.env.APIFY_TOKEN?.trim();
  if (!token) throw new HttpError(503, "LinkedIn search is not set up.");
  const res = await fetch(`https://api.apify.com/v2/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    console.error("[apify]", path.split("?")[0], res.status, (await res.text()).slice(0, 200));
    throw new HttpError(502, "LinkedIn did not answer. Your other results are unaffected.");
  }
  return ((await res.json()) as { data: T }).data ?? (undefined as T);
}

export interface RunInfo {
  id: string;
  status: string;
  defaultDatasetId: string;
  usageTotalUsd?: number;
}

export async function startLinkedInRun(input: { keywords: string; location: string; distance: number }): Promise<RunInfo> {
  const q = new URLSearchParams({
    maxItems: String(LIMITS.maxItems),
    maxTotalChargeUsd: String(LIMITS.maxChargeUsd),
    timeout: String(LIMITS.timeoutSecs),
    memory: String(LIMITS.memoryMb),
  });
  return apify<RunInfo>(`acts/${ACTOR()}/runs?${q}`, {
    method: "POST",
    body: JSON.stringify({
      keywords: input.keywords.slice(0, 80),
      location: input.location.slice(0, 80),
      distance: Math.max(5, Math.min(100, Math.round(input.distance))),
      limitPerSource: LIMITS.maxItems,
      // Company pages cost extra requests and time, and nothing here reads them.
      scrapeCompany: false,
    }),
  });
}

export const getRun = (runId: string) => apify<RunInfo>(`actor-runs/${encodeURIComponent(runId)}`);

export async function getItems(datasetId: string): Promise<Record<string, unknown>[]> {
  const token = process.env.APIFY_TOKEN?.trim();
  const res = await fetch(`https://api.apify.com/v2/datasets/${encodeURIComponent(datasetId)}/items?clean=1&limit=${LIMITS.maxItems}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new HttpError(502, "LinkedIn did not answer. Your other results are unaffected.");
  return (await res.json()) as Record<string, unknown>[];
}

/* ---------------- turning what the scraper returns into our listings ---------------- */

const text = (v: unknown) => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");
const strip = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

/** "$77,605.00/yr - $100,430.00/yr" to [77605, 100430]. Hourly and part year figures are left out rather than guessed at. */
export function parseSalary(s: string): [number, number] | null {
  if (!/\/\s*yr|year|annual/i.test(s)) return null;
  const nums = (s.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map((n) => Math.round(Number(n.replace(/,/g, "")))).filter((n) => n >= 20_000 && n <= 1_000_000);
  if (nums.length === 0) return null;
  return [Math.min(...nums), Math.max(...nums)];
}

/** "Hicksville, NY" or "Austin, Texas, United States" to a two letter state. */
function stateOf(location: string): string | null {
  const parts = location.split(",").map((p) => p.trim());
  for (const p of parts.slice(1)) {
    const st = stateCode(p.replace(/\s+area$/i, ""));
    if (st) return st;
  }
  return null;
}

export function mapLinkedIn(item: Record<string, unknown>): RawJob | null {
  const link = text(item.link);
  const id = text(item.id) || link.match(/(\d{6,})\/?(?:\?|$)/)?.[1] || "";
  const title = text(item.title);
  if (!id || !title || !link.startsWith("https://")) return null;

  const location = text(item.location);
  const description = text(item.descriptionText) || strip(text(item.descriptionHtml));
  const salary = parseSalary(text(item.salary));
  const posted = text(item.postedAt);
  const postedAt = /^\d{4}-\d{2}-\d{2}/.test(posted) && !Number.isNaN(Date.parse(posted)) ? new Date(posted).toISOString() : null;
  const applyUrl = text(item.applyUrl);

  return {
    source: "linkedin",
    external_id: id,
    title: strip(title),
    company: strip(text(item.companyName)) || "Company not named",
    location,
    description: description.slice(0, 12_000),
    // The employer's own page when LinkedIn gives one, otherwise the LinkedIn posting.
    apply_url: applyUrl.startsWith("https://") ? applyUrl : link,
    posted_at: postedAt,
    salary_min: salary?.[0] ?? null,
    salary_max: salary?.[1] ?? null,
    salary_period: salary ? "year" : null,
    employer_posted: null,
    remote_hint: /\bremote\b/i.test(`${location} ${title}`),
    category: text(item.jobFunction) || undefined,
    latitude: null,
    longitude: null,
    state: stateOf(location),
  };
}
