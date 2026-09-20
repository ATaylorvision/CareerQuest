// Checks whether a job is on the company's own careers page, using the public
// job board feeds of Greenhouse, Lever, and Ashby. This is what makes "Verified Live" real.

export interface BoardJob {
  title: string;
  url: string;
  location: string;
  description: string;
}

export interface Board {
  provider: "greenhouse" | "lever" | "ashby";
  slug: string;
  /** True only when the board's own name matched the company (Greenhouse exposes it). */
  identityConfirmed: boolean;
  jobs: BoardJob[];
}

export interface SiteCheck {
  status: "confirmed" | "unconfirmed" | "missing";
  provider?: Board["provider"];
  url?: string;
  description?: string;
}

async function get(url: string, ms = 4500): Promise<unknown | null> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { accept: "application/json" } });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

const norm = (s: string) => s.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const SUFFIX = /\b(inc|llc|ltd|corp|corporation|co|company|incorporated|limited|the|group|holdings)\b/g;

export function slugCandidates(company: string): string[] {
  const base = norm(company).replace(SUFFIX, " ").replace(/\s+/g, " ").trim();
  if (!base || base.length < 3) return [];
  const words = base.split(" ");
  const out = new Set<string>([words.join(""), words.join("-")]);
  if (words.length > 1) out.add(words[0]);
  return [...out].filter((s) => s.length >= 3).slice(0, 3);
}

const stripHtml = (h: string) =>
  h
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/<\/(p|div|li|h\d|br)>/gi, "\n")
    .replace(/<li>/gi, "- ")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

async function greenhouse(slug: string, company: string): Promise<Board | null> {
  const meta = (await get(`https://boards-api.greenhouse.io/v1/boards/${slug}`)) as { name?: string } | null;
  if (!meta?.name) return null;
  const a = new Set(norm(meta.name).replace(SUFFIX, " ").split(" ").filter(Boolean));
  const b = norm(company).replace(SUFFIX, " ").split(" ").filter(Boolean);
  // Identity must match closely, or we could judge the wrong company.
  const same = b.length > 0 && b.length === a.size && b.every((w) => a.has(w));
  if (!same) return null;
  const data = (await get(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`, 8000)) as {
    jobs?: { title: string; absolute_url: string; location?: { name?: string }; content?: string }[];
  } | null;
  if (!data?.jobs) return null;
  return {
    provider: "greenhouse",
    slug,
    identityConfirmed: true,
    jobs: data.jobs.map((j) => ({ title: j.title, url: j.absolute_url, location: j.location?.name ?? "", description: stripHtml(j.content ?? "") })),
  };
}

async function lever(slug: string): Promise<Board | null> {
  const data = (await get(`https://api.lever.co/v0/postings/${slug}?mode=json`, 8000)) as
    | { text: string; hostedUrl: string; descriptionPlain?: string; categories?: { location?: string } }[]
    | null;
  if (!Array.isArray(data) || data.length === 0) return null;
  return {
    provider: "lever",
    slug,
    identityConfirmed: false,
    jobs: data.map((j) => ({ title: j.text, url: j.hostedUrl, location: j.categories?.location ?? "", description: j.descriptionPlain ?? "" })),
  };
}

async function ashby(slug: string): Promise<Board | null> {
  const data = (await get(`https://api.ashbyhq.com/posting-api/job-board/${slug}`, 8000)) as {
    jobs?: { title: string; jobUrl: string; location?: string; descriptionPlain?: string }[];
  } | null;
  if (!data?.jobs?.length) return null;
  return {
    provider: "ashby",
    slug,
    identityConfirmed: false,
    jobs: data.jobs.map((j) => ({ title: j.title, url: j.jobUrl, location: j.location ?? "", description: j.descriptionPlain ?? "" })),
  };
}

const boardCache = new Map<string, Promise<Board | null>>();

/** Finds the company's public job board, if it has one on a supported system. */
export function findBoard(company: string): Promise<Board | null> {
  const key = norm(company);
  if (!boardCache.has(key)) {
    boardCache.set(
      key,
      (async () => {
        for (const slug of slugCandidates(company)) {
          const found = (await greenhouse(slug, company)) ?? (await lever(slug)) ?? (await ashby(slug));
          if (found) return found;
        }
        return null;
      })(),
    );
  }
  return boardCache.get(key)!;
}

const STOP = new Set(["and", "of", "the", "a", "for", "in", "at", "to", "sr", "senior", "jr"]);
const tokens = (s: string) => new Set(norm(s).split(" ").filter((w) => w && !STOP.has(w)));

function similarity(a: string, b: string) {
  const A = tokens(a);
  const B = tokens(b);
  if (!A.size || !B.size) return 0;
  const inter = [...A].filter((w) => B.has(w)).length;
  return inter / Math.max(A.size, B.size);
}

export async function checkCompanySite(company: string, title: string, location: string): Promise<SiteCheck> {
  if (/not named/i.test(company)) return { status: "unconfirmed" };
  const board = await findBoard(company);
  if (!board) return { status: "unconfirmed" };
  let best: BoardJob | null = null;
  let bestScore = 0;
  for (const j of board.jobs) {
    let s = similarity(title, j.title);
    if (location && j.location && norm(j.location).split(" ").some((w) => w.length > 3 && norm(location).includes(w))) s += 0.1;
    if (s > bestScore) {
      bestScore = s;
      best = j;
    }
  }
  if (best && bestScore >= 0.75) return { status: "confirmed", provider: board.provider, url: best.url, description: best.description };
  // Only call it missing when we are sure whose board this is.
  if (board.identityConfirmed && board.jobs.length >= 3 && bestScore < 0.3) return { status: "missing", provider: board.provider };
  return { status: "unconfirmed", provider: board.provider };
}
