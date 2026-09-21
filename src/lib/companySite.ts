import type { Job } from "@/data/jobs";

/** Job boards and aggregators. A link to one of these is not the employer's own page. */
const BOARDS = /(^|\.)(adzuna|indeed|linkedin|ziprecruiter|glassdoor|monster|simplyhired|jooble|talent|jsearch|google|careerjet|snagajob)\./i;

/**
 * Where "View company site" goes. If we confirmed the role on the employer's own
 * careers page, that is the page. Otherwise we send the person to the first
 * result for the company's official site, which is the nearest thing to its front door.
 */
export function companySiteUrl(job: Job): string {
  if (job.signals.companySite === "confirmed" && job.applyUrl) {
    try {
      const u = new URL(job.applyUrl);
      if (u.protocol === "https:" && !BOARDS.test(u.hostname)) return u.toString();
    } catch {
      /* fall through to the search */
    }
  }
  return `https://duckduckgo.com/?q=${encodeURIComponent(`!ducky ${job.company.name} official website`)}`;
}
