import { admin, body, route, quota } from "../_lib/http.js";
import { adzunaSearch, jsearchSearch, looksEvergreen, looksLikeAgency, remoteType, type RawJob } from "../_lib/sources.js";
import { checkCompanySite, type SiteCheck } from "../_lib/ats.js";
import { computeLegitimacy, type LegitSignals } from "../../src/lib/legit.js";
import { geocodeCity, geocodeUS, haversineMiles, type Point } from "../_lib/geo.js";

const MAX_JOBS = 30;
const DAY = 86_400_000;
/** The commute slider tops out here, where the person told us distance is not a filter. */
const ANY_DISTANCE = 100;

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

/** The city part of "Austin, TX". */
const cityOf = (s: string) => norm(s).split(/\s+/).slice(0, 2).join(" ");

/**
 * A listing that never went through a radius search and carries no coordinates
 * still counts as local when its location names one of the person's own places.
 */
function namesOneOf(location: string, anchors: string[]): boolean {
  const l = norm(location);
  if (!l) return false;
  return anchors.some((a) => {
    const city = norm(a).split(",")[0]?.split(/\s+/)[0] ?? "";
    return city.length > 2 && (l === norm(a) || l.includes(cityOf(a)) || l.includes(city));
  });
}

/** A listing plus whether the board already filtered it to a commute radius. */
type Found = RawJob & { scoped: boolean };

const tag = (p: Promise<RawJob[]>, scoped: boolean): Promise<Found[]> =>
  p.then((rows) => rows.map((r) => ({ ...r, scoped }))).catch((): Found[] => []);

export default route(async (req, _res, user) => {
  await quota(user, "search", 15, "job searches");
  const { extraQuery } = body<{ extraQuery?: string }>(req);
  const db = admin();

  const { data: profile } = await db
    .from("profiles")
    .select("location, target_roles, locations, remote_pref, salary_floor, max_distance_miles, home_lat, home_lng, home_geocoded_for, anchors")
    .eq("id", user.id)
    .single();

  const roles = (profile?.target_roles?.length ? profile.target_roles : ["operations manager"]).slice(0, 3);
  const remotePref: string = profile?.remote_pref ?? "any";
  const radius = Math.max(5, Math.min(ANY_DISTANCE, profile?.max_distance_miles ?? 30));
  const anyDistance = radius >= ANY_DISTANCE;

  // Where the person actually lives comes first. The extra locations are the
  // other places they said they would also work, not a replacement for home.
  const home = (profile?.location ?? "").trim();
  const extras: string[] = (profile?.locations ?? []).filter((l: string) => l && !/^remote/i.test(l));
  const listedRemote: boolean = (profile?.locations ?? []).some((l: string) => /^remote/i.test(l));
  const areas = [...new Set([home, ...extras].filter(Boolean))].slice(0, 3);
  const openToRemote = remotePref === "remote" || remotePref === "any" || listedRemote;
  const remoteOnly = remotePref === "remote";

  if (areas.length === 0 && !openToRemote) {
    return { ids: [], total: 0, verified: 0, agencies: 0, ghostRisk: 0, outOfRange: 0, note: "Add your home base in Settings so we can search where you actually live." };
  }

  // Coordinates for home, looked up once and kept on the profile afterwards.
  let homePoint: Point | null =
    profile?.home_lat != null && profile?.home_lng != null && profile?.home_geocoded_for === home
      ? { lat: profile.home_lat, lng: profile.home_lng }
      : null;
  if (home && !homePoint) {
    homePoint = await geocodeUS(home);
    if (homePoint) await db.from("profiles").update({ home_lat: homePoint.lat, home_lng: homePoint.lng, home_geocoded_for: home }).eq("id", user.id);
  }

  // Every place the person said they would work, with coordinates. Distance is measured from
  // whichever of these is nearest, so a person open to Manhattan and Long Island is not judged
  // from one of them alone. Looked up once and kept on the profile.
  type Anchor = { place: string; lat: number; lng: number };
  const cachedAnchors: Anchor[] = Array.isArray(profile?.anchors) ? (profile!.anchors as Anchor[]) : [];
  const anchors: Anchor[] = [];
  for (const place of areas) {
    let a = cachedAnchors.find((c) => c.place === place);
    if (!a) {
      const p = place === home && homePoint ? homePoint : await geocodeUS(place);
      if (p) a = { place, lat: p.lat, lng: p.lng };
    }
    if (a) anchors.push(a);
  }
  if (JSON.stringify(anchors) !== JSON.stringify(cachedAnchors)) {
    await db.from("profiles").update({ anchors }).eq("id", user.id);
    // The places changed, so distances saved on earlier matches were measured from somewhere else.
    const { data: mine } = await db.from("job_matches").select("job_id, distance_miles, jobs(latitude, longitude, remote_type)").eq("user_id", user.id).limit(400);
    const fix = (mine ?? []).flatMap((m) => {
      const j = (Array.isArray(m.jobs) ? m.jobs[0] : m.jobs) as { latitude: number | null; longitude: number | null; remote_type: string | null } | null;
      const d = !j || j.remote_type === "remote" || j.latitude == null || j.longitude == null || !anchors.length ? null : Math.round(Math.min(...anchors.map((a) => haversineMiles(a, { lat: j.latitude!, lng: j.longitude! }))));
      return d === m.distance_miles ? [] : [{ job_id: m.job_id as string, d }];
    });
    await pool(fix, 10, (x) => Promise.resolve(db.from("job_matches").update({ distance_miles: x.d }).eq("user_id", user.id).eq("job_id", x.job_id)).then(() => undefined));
  }

  // 1. Pull real listings, each one scoped to a place the person named.
  const searchRemote = remoteOnly || listedRemote || (openToRemote && areas.length === 0);
  const queries: Promise<Found[]>[] = [];
  for (const role of roles) {
    if (!remoteOnly) for (const loc of areas) queries.push(tag(adzunaSearch(role, loc, { distanceMiles: radius }), true));
    if (searchRemote) queries.push(tag(adzunaSearch(role, "", { remote: true }), false));
  }
  if (extraQuery) {
    if (areas.length && !remoteOnly) queries.push(tag(adzunaSearch(extraQuery, areas[0], { distanceMiles: radius }), true));
    else queries.push(tag(adzunaSearch(extraQuery, "", { remote: searchRemote }), false));
  }
  queries.push(tag(jsearchSearch(`${roles[0]} in ${areas[0] || "United States"}`), false));
  const raw = (await Promise.all(queries)).flat();

  // The job boards send no coordinates, so place each listing from its city and state.
  {
    const need = new Map<string, { city: string; st: string }>();
    for (const r of raw) {
      if (r.latitude != null || !r.state || remoteType(r) === "remote") continue;
      const city = r.location.split(",")[0]?.trim();
      if (city) need.set(`${city}, ${r.state}`.toLowerCase(), { city, st: r.state });
    }
    const keys = [...need.keys()];
    if (keys.length) {
      const { data: hits } = await db.from("geo_cache").select("place, lat, lng, found").in("place", keys);
      const geo = new Map<string, Point | null>((hits ?? []).map((g) => [g.place as string, g.found ? { lat: g.lat as number, lng: g.lng as number } : null]));
      const missing = keys.filter((k) => !geo.has(k)).slice(0, 40);
      await pool(missing, 8, async (k) => {
        const { city, st } = need.get(k)!;
        geo.set(k, await geocodeCity(city, st));
      });
      if (missing.length) await db.from("geo_cache").upsert(missing.map((k) => ({ place: k, lat: geo.get(k)?.lat ?? null, lng: geo.get(k)?.lng ?? null, found: !!geo.get(k) })), { onConflict: "place" });
      for (const r of raw) {
        if (r.latitude != null || !r.state) continue;
        const p = geo.get(`${r.location.split(",")[0]?.trim()}, ${r.state}`.toLowerCase());
        if (p) {
          r.latitude = p.lat;
          r.longitude = p.lng;
        }
      }
    }
  }

  /** How far a listing sits from the nearest place the person named, when both ends have coordinates. */
  const milesFromHome = (r: Found): number | null =>
    anchors.length && r.latitude != null && r.longitude != null ? Math.min(...anchors.map((a) => haversineMiles(a, { lat: r.latitude!, lng: r.longitude! }))) : null;

  /** Is this listing somewhere the person is actually willing to work? */
  function reachable(r: Found): boolean {
    const mode = remoteType(r);
    if (mode === "remote") return openToRemote;
    if (remoteOnly) return false;
    if (anyDistance) return true;
    const miles = milesFromHome(r);
    if (miles != null) return miles <= radius;
    // No coordinates: trust the radius the board itself applied, or the place name.
    return r.scoped || namesOneOf(r.location, areas);
  }

  // 2. De-duplicate, drop anything out of reach, newest first.
  const seen = new Set<string>();
  const list: Found[] = [];
  let outOfRange = 0;
  for (const r of raw.sort((a, b) => (b.posted_at ?? "").localeCompare(a.posted_at ?? ""))) {
    const k1 = `${r.source}:${r.external_id}`;
    const k2 = `${norm(r.company)}|${norm(r.title)}`;
    if (!r.title || !r.apply_url || seen.has(k1) || seen.has(k2)) continue;
    if (/\b(intern|internship|co-?op|apprentice(ship)?)\b/i.test(r.title)) continue;
    if (!reachable(r)) {
      outOfRange++;
      continue;
    }
    seen.add(k1);
    seen.add(k2);
    list.push(r);
  }
  const picked = list.slice(0, MAX_JOBS);
  if (picked.length === 0) {
    const note = outOfRange
      ? `Every listing we found sits outside your ${radius} mile range${home ? ` from ${home}` : ""}. Widen the range in Settings, or add remote.`
      : "No listings came back. Try a broader role title or location.";
    return { ids: [], total: 0, verified: 0, agencies: 0, ghostRisk: 0, outOfRange, note };
  }

  // 3. What we already know about these listings.
  const ids = picked.map((r) => `${r.source}:${r.external_id}`);
  const companies = [...new Set(picked.map((r) => r.company))];
  const since = new Date(Date.now() - 90 * DAY).toISOString();
  const [{ data: existing }, { data: history }] = await Promise.all([
    db
      .from("jobs")
      .select("id, first_seen_at, company_site_status, company_site_checked_at, ats_provider, description, apply_url, employer_posted, latitude, longitude")
      .in("id", ids),
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
      latitude: r.latitude ?? prev?.latitude ?? null,
      longitude: r.longitude ?? prev?.longitude ?? null,
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
    outOfRange,
  };
});
