import { admin, body, route } from "../_lib/http.js";
import { adzunaSearch, jsearchSearch, looksEvergreen, looksLikeAgency, remoteType, type RawJob } from "../_lib/sources.js";
import { checkCompanySite, type SiteCheck } from "../_lib/ats.js";
import { computeLegitimacy, type LegitSignals } from "../../src/lib/legit.js";

const MAX_JOBS = 30;
const DAY = 86_400_000;

async function pool<T, R>(items: T[], size: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k]);
      }
    }),
  );
  return out;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export default route(async (req, _res, user) => {
  const { extraQuery } = body<{ extraQuery?: string }>(req);
  const db = admin();

  const { data: profile } = await db.from("profiles").select("target_roles, locations, remote_pref, salary_floor").eq("id", user.id).single();
  const roles = (profile?.target_roles?.length ? profile.target_roles : ["operations manager"]).slice(0, 3);
  const locs = (profile?.locations?.length ? profile.locations : [""]).filter((l: string) => !/^remote/i.test(l)).slice(0, 2);
  const wantsRemote = profile?.remote_pref === "remote" || (profile?.locations ?? []).some((l: string) => /^remote/i.test(l));
  if (locs.length === 0) locs.push("");

  // 1. Pull real listings.
  const jobs: Promise<RawJob[]>[] = [];
  for (const role of roles) {
    for (const loc of locs) jobs.push(adzunaSearch(role, loc).catch(() => []));
    if (wantsRemote) jobs.push(adzunaSearch(role, "", { remote: true }).catch(() => []));
  }
  if (extraQuery) jobs.push(adzunaSearch(extraQuery, locs[0] ?? "").catch(() => []));
  jobs.push(jsearchSearch(`${roles[0]} in ${locs[0] || "United States"}`));
  const raw = (await Promise.all(jobs)).flat();

  // 2. De-duplicate, newest first.
  const seen = new Set<string>();
  const list: RawJob[] = [];
  for (const r of raw.sort((a, b) => (b.posted_at ?? "").localeCompare(a.posted_at ?? ""))) {
    const k1 = `${r.source}:${r.external_id}`;
    const k2 = `${norm(r.company)}|${norm(r.title)}`;
    if (!r.title || !r.apply_url || seen.has(k1) || seen.has(k2)) continue;
    if (/\b(intern|internship|co-?op|apprentice(ship)?)\b/i.test(r.title)) continue;
    if (wantsRemote && locs.length === 1 && !locs[0] && !r.remote_hint) continue;
    seen.add(k1);
    seen.add(k2);
    list.push(r);
  }
  const picked = list.slice(0, MAX_JOBS);
  if (picked.length === 0) return { ids: [], total: 0, verified: 0, agencies: 0, ghostRisk: 0, note: "No listings came back. Try a broader role title or location." };

  // 3. What we already know about these listings.
  const ids = picked.map((r) => `${r.source}:${r.external_id}`);
  const companies = [...new Set(picked.map((r) => r.company))];
  const since = new Date(Date.now() - 90 * DAY).toISOString();
  const [{ data: existing }, { data: history }] = await Promise.all([
    db.from("jobs").select("id, first_seen_at, company_site_status, company_site_checked_at, ats_provider, description, apply_url, employer_posted").in("id", ids),
    db.from("jobs").select("id, company, title").in("company", companies).gte("first_seen_at", since),
  ]);
  const known = new Map((existing ?? []).map((e) => [e.id, e]));

  // 4. Check the company's own careers page (skip anything checked in the last day).
  const stale = picked.filter((r) => {
    const e = known.get(`${r.source}:${r.external_id}`);
    return !e?.company_site_checked_at || Date.now() - new Date(e.company_site_checked_at).getTime() > DAY;
  });
  const uniqueByCompany = new Map<string, RawJob>();
  for (const r of stale) if (!uniqueByCompany.has(r.company)) uniqueByCompany.set(r.company, r);
  const companyBudget = [...uniqueByCompany.values()].slice(0, 24);
  const checks = new Map<string, SiteCheck>();
  await pool(stale.filter((r) => companyBudget.some((c) => c.company === r.company)), 10, async (r) => {
    checks.set(`${r.source}:${r.external_id}`, await checkCompanySite(r.company, r.title, r.location).catch((): SiteCheck => ({ status: "unconfirmed" })));
  });

  // 5. Score legitimacy from real signals and save.
  const rows = picked.map((r) => {
    const id = `${r.source}:${r.external_id}`;
    const prev = known.get(id);
    const check = checks.get(id);
    const siteStatus = check?.status ?? (prev?.company_site_status as SiteCheck["status"]) ?? "unconfirmed";
    const posted = r.posted_at ? new Date(r.posted_at).getTime() : Date.now() - 10 * DAY;
    const days = Math.max(0, Math.floor((Date.now() - posted) / DAY));
    const t = norm(r.title);
    const reposts = (history ?? []).filter((h) => h.id !== id && norm(h.company) === norm(r.company) && norm(h.title) === t).length;
    const agency = looksLikeAgency(r);
    const signals: LegitSignals = {
      firstPostedDaysAgo: days,
      reposts90: reposts,
      companySite: siteStatus,
      checkedHoursAgo: check ? 0 : prev?.company_site_checked_at ? Math.round((Date.now() - new Date(prev.company_site_checked_at).getTime()) / 3_600_000) : undefined,
      poster: agency ? "agency" : "employer",
      salaryListed: !!(r.salary_min && r.salary_max),
      applicantTrend: "unknown",
      evergreen: looksEvergreen(r),
    };
    const legit = computeLegitimacy(signals);
    const description = check?.description && check.description.length > r.description.length ? check.description : (prev?.description ?? r.description);
    return {
      id,
      source: r.source,
      external_id: r.external_id,
      title: r.title,
      company: r.company,
      location: r.location,
      remote_type: remoteType(r),
      salary_min: r.salary_min,
      salary_max: r.salary_max,
      salary_period: r.salary_period,
      description: description.length >= r.description.length ? description : r.description,
      apply_url: check?.url ?? prev?.apply_url ?? r.apply_url,
      employer_posted: !agency,
      posted_at: r.posted_at,
      last_seen_at: new Date().toISOString(),
      repost_count: reposts,
      ats_provider: check?.provider ?? prev?.ats_provider ?? null,
      company_site_status: siteStatus,
      company_site_checked_at: check ? new Date().toISOString() : (prev?.company_site_checked_at ?? null),
      legit,
      raw: { signals },
    };
  });

  const { error } = await db.from("jobs").upsert(rows, { onConflict: "id" });
  if (error) {
    console.error("[jobs upsert]", error.message);
    throw new Error("Could not save listings");
  }

  return {
    ids: rows.map((r) => r.id),
    total: rows.length,
    verified: rows.filter((r) => r.legit.badge === "verified").length,
    agencies: rows.filter((r) => !r.employer_posted).length,
    ghostRisk: rows.filter((r) => r.legit.badge === "ghost").length,
  };
});
