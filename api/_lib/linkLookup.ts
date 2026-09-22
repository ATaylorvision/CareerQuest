// Reads a job posting link the person pasted in, so we can fill in the title, company,
// description, salary and company site for them instead of asking them to retype it.
//
// The fetch is guarded against SSRF: only http/https, the resolved address is checked
// against the private and reserved ranges before we connect, and redirects are followed
// one hop at a time with the same check applied again. This is the same shape of guard
// used for outbound calls elsewhere in this codebase (see checkCompanySite in ats.ts),
// just against an address the person supplies rather than a fixed API host.

import dns from "node:dns/promises";
import net from "node:net";

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, oct) => (acc << 8) + Number(oct), 0) >>> 0;
}

function inRangeV4(ip: string, base: string, bits: number): boolean {
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(base) & mask);
}

// Loopback, private, link local, and other non routable ranges. A server side fetch
// should never be able to reach any of these, whatever address the link resolves to.
const BLOCKED_V4: [string, number][] = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];

function isBlockedV4(ip: string): boolean {
  return BLOCKED_V4.some(([base, bits]) => inRangeV4(ip, base, bits));
}

function isBlockedV6(ip: string): boolean {
  const l = ip.toLowerCase();
  return l === "::1" || l === "::" || l.startsWith("::ffff:127.") || /^f[cd]/.test(l) || /^fe[89ab]/.test(l);
}

function isBlockedIp(ip: string): boolean {
  const v = net.isIP(ip);
  if (v === 4) return isBlockedV4(ip);
  if (v === 6) return isBlockedV6(ip);
  return true;
}

async function hostIsSafe(hostname: string): Promise<boolean> {
  if (net.isIP(hostname)) return !isBlockedIp(hostname);
  let addrs: { address: string }[];
  try {
    addrs = await dns.lookup(hostname, { all: true });
  } catch {
    return false;
  }
  return addrs.length > 0 && addrs.every((a) => !isBlockedIp(a.address));
}

const UA = "Mozilla/5.0 (compatible; CareerQuestBot/1.0; job listing lookup requested by a signed in user)";

/** Fetches a page the person linked to, following at most a few redirects, each re-checked for safety. */
export async function safeFetchText(start: URL, opts: { timeoutMs?: number; maxBytes?: number; maxRedirects?: number } = {}): Promise<{ text: string; finalUrl: string } | null> {
  const { timeoutMs = 7000, maxBytes = 2_000_000, maxRedirects = 3 } = opts;
  let current = start;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    if (current.protocol !== "http:" && current.protocol !== "https:") return null;
    if (!(await hostIsSafe(current.hostname))) return null;

    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetch(current.toString(), {
        signal: ctl.signal,
        redirect: "manual",
        headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml" },
      });
    } catch {
      return null;
    } finally {
      clearTimeout(t);
    }

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return null;
      try {
        current = new URL(loc, current);
      } catch {
        return null;
      }
      continue;
    }
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (ct && !/text\/html|application\/xhtml/i.test(ct)) return null;

    const reader = res.body?.getReader();
    if (!reader) return null;
    const chunks: Buffer[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        void reader.cancel();
        break;
      }
      chunks.push(Buffer.from(value));
    }
    return { text: Buffer.concat(chunks).toString("utf-8"), finalUrl: current.toString() };
  }
  return null;
}

/* ---------------- pulling a job posting out of the HTML ---------------- */

export interface ParsedJobPage {
  title?: string;
  company?: string;
  location?: string;
  description?: string;
  salaryMin?: number;
  salaryMax?: number;
  companyWebsite?: string;
}

const decodeEntities = (s: string) =>
  s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .trim();

function stripTags(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
      .replace(/<li[^>]*>/gi, "- ")
      .replace(/<[^>]+>/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/ *\n */g, "\n")
      .replace(/\n{3,}/g, "\n\n"),
  ).trim();
}

function metaContent(html: string, ...names: string[]): string | null {
  for (const name of names) {
    const a = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]*content=["']([^"']*)["']`, "i"));
    if (a) return decodeEntities(a[1]);
    const b = html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${name}["']`, "i"));
    if (b) return decodeEntities(b[1]);
  }
  return null;
}

function jsonLdJobPostings(html: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    try {
      const data = JSON.parse(m[1].trim());
      const arr: unknown[] = Array.isArray(data) ? data : Array.isArray((data as Record<string, unknown>)?.["@graph"]) ? ((data as Record<string, unknown>)["@graph"] as unknown[]) : [data];
      for (const item of arr) {
        const obj = item as Record<string, unknown>;
        const type = obj?.["@type"];
        const types = Array.isArray(type) ? type : [type];
        if (types.some((t) => typeof t === "string" && t.toLowerCase() === "jobposting")) out.push(obj);
      }
    } catch {
      /* not valid JSON-LD, skip it */
    }
  }
  return out;
}

/** "$70,000 - $85,000", "70K-85K per year", "$70,000 to $85,000 annually". Loose on purpose; false negatives are fine, false positives are not. */
const SALARY_RE = /\$?\s?(\d{2,3}(?:,\d{3})?)\s?(k)?\s?(?:-|to|–|—)\s?\$?\s?(\d{2,3}(?:,\d{3})?)\s?(k)?\s?(?:per\s*(?:year|yr|annum)|\/\s*(?:year|yr)|annually)?/i;

function guessSalary(text: string): [number, number] | null {
  const m = text.match(SALARY_RE);
  if (!m) return null;
  const num = (s: string, k: string | undefined) => {
    const n = parseFloat(s.replace(/,/g, "")) * (k ? 1000 : 1);
    return Math.round(n);
  };
  const a = num(m[1], m[2]);
  const b = num(m[3], m[4] ?? m[2]);
  if (!a || !b || a > b || a < 8000 || b > 2_000_000) return null;
  return [a, b];
}

const BOARD_HOSTS = new Set(["indeed.com", "linkedin.com", "ziprecruiter.com", "glassdoor.com", "monster.com", "careerbuilder.com", "simplyhired.com", "ladders.com", "dice.com", "snagajob.com"]);

/** Best effort read of a job posting page: structured JobPosting data first, then Open Graph tags, then plain text. */
export function parseJobPage(html: string, sourceUrl: URL): ParsedJobPage {
  const out: ParsedJobPage = {};
  const posting = jsonLdJobPostings(html)[0];

  if (posting) {
    if (typeof posting.title === "string") out.title = decodeEntities(posting.title).slice(0, 140);
    const org = posting.hiringOrganization as Record<string, unknown> | string | undefined;
    const orgName = typeof org === "string" ? org : (org?.name as string | undefined);
    if (typeof orgName === "string" && orgName.trim()) out.company = decodeEntities(orgName).slice(0, 120);
    const orgUrl = typeof org === "object" ? ((org?.sameAs as string) ?? (org?.url as string)) : undefined;
    if (typeof orgUrl === "string" && /^https?:\/\//i.test(orgUrl)) out.companyWebsite = orgUrl.slice(0, 300);

    const loc = posting.jobLocation as Record<string, unknown> | Record<string, unknown>[] | undefined;
    const first = Array.isArray(loc) ? loc[0] : loc;
    const addr = first?.address as Record<string, unknown> | undefined;
    if (addr) {
      const parts = [addr.addressLocality, addr.addressRegion].filter((v): v is string => typeof v === "string" && !!v);
      if (parts.length) out.location = parts.join(", ");
    }
    if (!out.location && posting.jobLocationType === "TELECOMMUTE") out.location = "Remote";

    if (typeof posting.description === "string") out.description = stripTags(posting.description).slice(0, 20000);

    const sal = posting.baseSalary as Record<string, unknown> | undefined;
    const val = sal?.value as Record<string, unknown> | number | undefined;
    if (val && typeof val === "object") {
      const min = val.minValue;
      const max = val.maxValue ?? val.value;
      if (typeof min === "number" && typeof max === "number" && min > 0 && max >= min) {
        out.salaryMin = Math.round(min);
        out.salaryMax = Math.round(max);
      }
    }
  }

  if (!out.title) {
    const t = metaContent(html, "og:title") ?? html.match(/<title>([^<]*)<\/title>/i)?.[1];
    if (t) out.title = decodeEntities(t).slice(0, 140);
  }
  if (!out.company) {
    const site = metaContent(html, "og:site_name");
    if (site) out.company = decodeEntities(site).slice(0, 120);
  }
  if (!out.description) {
    const ogDesc = metaContent(html, "og:description", "description");
    const bodyText = stripTags(html);
    out.description = (ogDesc && ogDesc.length > 80 ? `${ogDesc}\n\n${bodyText}` : bodyText).slice(0, 20000);
  }
  if (out.salaryMin == null) {
    const guess = guessSalary(out.description ?? "");
    if (guess) {
      out.salaryMin = guess[0];
      out.salaryMax = guess[1];
    }
  }
  if (!out.companyWebsite) {
    const host = sourceUrl.hostname.replace(/^www\./, "");
    if (!BOARD_HOSTS.has(host)) out.companyWebsite = `https://${host}`;
  }
  return out;
}
