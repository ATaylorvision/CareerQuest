// Ghost Job Shield scoring. Pure functions, shared by the app and the server.
// Signals that job boards do not provide are marked "unknown" and never guessed.

export interface LegitSignals {
  firstPostedDaysAgo: number;
  reposts90: number;
  companySite: "confirmed" | "unconfirmed" | "missing";
  checkedHoursAgo?: number;
  poster: "employer" | "agency";
  salaryListed: boolean;
  applicantTrend: "rising" | "steady" | "stalled" | "unknown";
  evergreen?: boolean;
}

export type LegitBadge = "verified" | "active" | "stale" | "ghost";

export interface LegitFactor {
  label: string;
  value: string;
  impact: number;
  tone: "good" | "neutral" | "warn" | "bad";
  note: string;
}

/* ------------------------------------------------------------------ */
/* Ghost Job Shield: the scoring logic is shown to the user as-is.     */
/* ------------------------------------------------------------------ */

export interface LegitResult {
  score: number;
  badge: LegitBadge;
  factors: LegitFactor[];
}

export function computeLegitimacy(s: LegitSignals): LegitResult {
  const factors: LegitFactor[] = [];
  let score = 100;

  const d = s.firstPostedDaysAgo;
  const fresh = d <= 7 ? 0 : d <= 14 ? -3 : d <= 30 ? -8 : d <= 60 ? -18 : -22;
  factors.push({
    label: "Days since first posted",
    value: d === 0 ? "Today" : `${d} day${d === 1 ? "" : "s"}`,
    impact: fresh,
    tone: fresh === 0 ? "good" : fresh > -10 ? "neutral" : "bad",
    note: d <= 7 ? "Fresh listing. Most real roles fill within 30 to 45 days." : d <= 30 ? "Still within a normal hiring window." : "Older than 30 days. Real roles this old are often filled or paused.",
  });

  const r = s.reposts90;
  const repost = r <= 0 ? 0 : r === 1 ? -2 : r === 2 ? -6 : -Math.min(24, 6 * r);
  factors.push({
    label: "Times reposted in 90 days",
    value: r === 0 ? "Never" : `${r} time${r === 1 ? "" : "s"}`,
    impact: repost,
    tone: r <= 1 ? "good" : r === 2 ? "warn" : "bad",
    note: r <= 1 ? "No sign of a revolving listing." : r === 2 ? "Reposted twice. Sometimes a budget reset, sometimes a stalled search." : "Repeated reposting is the strongest ghost job signal we track.",
  });

  const site = s.companySite === "confirmed" ? 0 : s.companySite === "unconfirmed" ? -10 : -20;
  factors.push({
    label: "On the company's own careers page",
    value: s.companySite === "confirmed" ? `Yes, checked ${s.checkedHoursAgo ?? 6}h ago` : s.companySite === "unconfirmed" ? "Not confirmed yet" : "No matching role found",
    impact: site,
    tone: s.companySite === "confirmed" ? "good" : s.companySite === "unconfirmed" ? "warn" : "bad",
    note: s.companySite === "confirmed" ? "We found the same role on the employer's site. This is the best proof a job is real." : s.companySite === "unconfirmed" ? "We only see this on job boards so far. Use Verify on company site to check yourself." : "The employer's careers page has no role like this one.",
  });

  const agency = s.poster === "agency" ? -8 : 0;
  factors.push({
    label: "Posted by",
    value: s.poster === "agency" ? "Staffing agency" : "The employer",
    impact: agency,
    tone: s.poster === "agency" ? "warn" : "good",
    note: s.poster === "agency" ? "Agencies sometimes post roles to collect resumes before a client exists." : "Posted directly by the hiring company.",
  });

  const sal = s.salaryListed ? 0 : -6;
  factors.push({
    label: "Salary transparency",
    value: s.salaryListed ? "Range listed" : "Not listed",
    impact: sal,
    tone: s.salaryListed ? "good" : "warn",
    note: s.salaryListed ? "A posted range usually means a real, budgeted role." : "No range. Not proof of anything, but real roles increasingly list one.",
  });

  const trend = s.applicantTrend === "stalled" ? -6 : 0;
  factors.push({
    label: "Applicant count trend",
    value: s.applicantTrend === "unknown" ? "Not available" : s.applicantTrend === "rising" ? "Rising" : s.applicantTrend === "steady" ? "Steady" : "Stalled",
    impact: trend,
    tone: s.applicantTrend === "unknown" ? "neutral" : s.applicantTrend === "stalled" ? "warn" : "good",
    note:
      s.applicantTrend === "unknown"
        ? "Job boards do not share applicant counts, so we do not guess. This signal is left out of the score."
        : s.applicantTrend === "stalled"
          ? "The count has not moved in weeks, which can mean nobody is reviewing."
          : "Normal activity for a live posting.",
  });

  if (s.evergreen) {
    factors.push({
      label: "Evergreen posting",
      value: "Always open",
      impact: -12,
      tone: "bad",
      note: "Marked as an ongoing or pipeline listing, not a specific opening.",
    });
  }

  score += fresh + repost + site + agency + sal + trend + (s.evergreen ? -12 : 0);
  score = Math.max(8, Math.min(99, score));

  let badge: LegitBadge;
  if (s.evergreen || s.companySite === "missing" || (s.poster === "agency" && r >= 3) || score < 40) badge = "ghost";
  else if (d > 30 || r > 2) badge = "stale";
  else if (s.companySite === "confirmed" && (s.checkedHoursAgo ?? 6) <= 24) badge = "verified";
  else badge = "active";

  return { score, badge, factors };
}

