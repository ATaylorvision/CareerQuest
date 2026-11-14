import { admin, body, route, quota } from "../_lib/http.js";
import { adzunaSearch, jsearchSearch, looksEvergreen, looksLikeAgency, remoteType, type RawJob } from "../_lib/sources.js";
import { checkCompanySite, type SiteCheck } from "../_lib/ats.js";
import { computeLegitimacy, type LegitSignals } from "../../src/lib/legit.js";
import { geocodeCity, geocodeUS, haversineMiles, placeAt, searchPlaces, type Point } from "../_lib/geo.js";
import { getItems, getRun, hasApify, LIMITS, mapLinkedIn, startLinkedInRun } from "../_lib/apify.js";

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

// Accents are dropped so "Hermès" and "Hermes" are the same employer when we look for duplicates.
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

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

const tag = (p: Promise<RawJob[]>, scoped: boolean, diag?: string[]): Promise<Found[]> =>
  p
    .then((rows) => rows.map((r) => ({ ...r, scoped })))
    .catch((e: unknown): Found[] => {
      // A board that fails must not look the same as a board with nothing to show.
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[jobs source]", msg);
      diag?.push(msg);
      return [];
    });

export default route(async (req, _res, user) => {
  const { extraQuery, action, runId, q, lat, lng } = body<{ extraQuery?: string; action?: string; runId?: string; q?: string; lat?: number; lng?: number }>(req);

  // Confirming where someone lives. Everyone's search starts from this, so it has to be right.
  if (action === "place") {
    await quota(user, "place", 90, "place lookups");
    return { places: await searchPlaces(String(q ?? "")) };
  }
  if (action === "placeAt") {
    await quota(user, "place", 90, "place lookups");
    return { place: await placeAt(Number(lat), Number(lng)) };
  }

  const polling = action === "linkedinPoll";
  if (!polling && action !== "linkedinStart") await quota(user, "search", 15, "job searches");
  const db = admin();

  const diag: string[] = [];
  let { data: profile, error: profileErr } = await db
    .from("profiles")
    .select("location, target_roles, locations, remote_pref, salary_floor, max_distance_miles, home_lat, home_lng, home_geocoded_for, anchors")
    .eq("id", user.id)
    .single();
  if (profileErr) {
    // Most likely the newest database columns are missing. Search still works without them, so read the older ones.
    console.error("[jobs profile]", profileErr.message);
    diag.push(`profile: ${profileErr.message}`);
    const older = await db.from("profiles").select("location, target_roles, locations, remote_pref, salary_floor, max_distance_miles").eq("id", user.id).single();
    profile = older.data as typeof profile;
  }

  const roles = (profile?.target_roles?.length ? profile.target_roles : ["operations manager"]).slice(0, 3);
  const remotePref: string = profile?.remote_pref ?? "any";
  let radius = Math.max(5, Math.min(ANY_DISTANCE, profile?.max_distance_miles ?? 30));
  let anyDistance = radius >= ANY_DISTANCE;

  // Where the person actually lives comes first. The extra locations are the
  // other places they said they would also work, not a replacement for home.
  const home = (profile?.location ?? "").trim();
  const extras: string[] = (profile?.locations ?? []).filter((l: string) => l && !/^remote/i.test(l));
  const listedRemote: boolean = (profile?.locations ?? []).some((l: string) => /^remote/i.test(l));
  const areas = [...new Set([home, ...extras].filter(Boolean))].slice(0, 3);
  const openToRemote = remotePref === "remote" || remotePref === "any" || listedRemote;
  const remoteOnly = remotePref === "remote";

  // Without a home base we would be guessing where to look, and would show people jobs in cities they will never work in.
  if (areas.length === 0 && !remoteOnly) {
    return { ids: [], total: 0, verified: 0, agencies: 0, ghostRisk: 0, outOfRange: 0, note: "Add your home base in Settings so we can search where you actually live." };
  }
  if (!profile?.target_roles?.length) {
    return { ids: [], total: 0, verified: 0, agencies: 0, ghostRisk: 0, outOfRange: 0, note: "Add the roles you are looking for in Settings, and we will search for those." };
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

  // LinkedIn is a second, slower search that runs beside the first. It is off until staff switch it on.
  const { data: setting } = await db.from("app_settings").select("value").eq("key", "linkedin_enabled").maybeSingle();
  const linkedinOn = hasApify() && setting?.value === true;

  if (action === "linkedinStart") {
    const none = (note: string) => ({ started: false, note });
    if (!linkedinOn) return none("LinkedIn search is not switched on.");
    const place = home || areas[0];
    if (!place) return none("Add your home base in Settings so we can search LinkedIn near you.");
    await quota(user, "linkedin", LIMITS.perUserPerDay, "LinkedIn searches");
    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);
    const { count } = await db.from("linkedin_runs").select("id", { count: "exact", head: true }).gte("started_at", dayStart.toISOString());
    if ((count ?? 0) >= LIMITS.globalPerDay) return none("LinkedIn search is resting for today. Your other results are unaffected.");
    const run = await startLinkedInRun({ keywords: roles[0], location: place, distance: radius });
    await db.from("linkedin_runs").insert({ user_id: user.id, run_id: run.id });
    return { started: true, runId: run.id };
  }

  const empty = (note?: string) => ({ ids: [] as string[], total: 0, verified: 0, agencies: 0, ghostRisk: 0, outOfRange: 0, status: "done", ...(note ? { note } : {}) });
  let linkedinRaw: Found[] | null = null;
  let pollMeta: { items: number; cost: number | null } | null = null;
  if (polling) {
    if (!runId) return empty("Which search?");
    const { data: row } = await db.from("linkedin_runs").select("run_id, status, ids").eq("run_id", runId).eq("user_id", user.id).maybeSingle();
    if (!row) return empty("We could not find that search.");
    if (row.status === "done") return { ...empty(), ids: (row.ids as string[]) ?? [], total: ((row.ids as string[]) ?? []).length };
    const run = await getRun(runId);
    if (run.status === "READY" || run.status === "RUNNING") return { status: "running" };
    if (run.status !== "SUCCEEDED") {
      await db.from("linkedin_runs").update({ status: "done", ids: [], items: 0, cost_usd: run.usageTotalUsd ?? null, finished_at: new Date().toISOString() }).eq("run_id", runId);
      return empty("LinkedIn did not return results this time. Your other results are unaffected.");
    }
    const items = await getItems(run.defaultDatasetId);
    linkedinRaw = items.map(mapLinkedIn).filter((r): r is NonNullable<typeof r> => !!r).map((r) => ({ ...r, scoped: true }));
    pollMeta = { items: items.length, cost: run.usageTotalUsd ?? null };
  }
  /** Records how a LinkedIn run ended, so its spend and results are on file. */
  const settle = async (ids: string[]) => {
    if (polling && pollMeta) await db.from("linkedin_runs").update({ status: "done", ids, items: pollMeta.items, cost_usd: pollMeta.cost, finished_at: new Date().toISOString() }).eq("run_id", runId!);
  };

  // 1. Pull real listings, each one scoped to a place the person named.
  const searchRemote = remoteOnly || listedRemote || (openToRemote && areas.length === 0);
  const gather = async (broad: boolean, dist: number): Promise<Found[]> => {
    const queries: Promise<Found[]>[] = [];
    for (const role of roles) {
      if (!remoteOnly) for (const loc of areas) queries.push(tag(adzunaSearch(role, loc, { distanceMiles: dist, broad }), true, diag));
      if (searchRemote) queries.push(tag(adzunaSearch(role, "", { remote: true, broad }), false, diag));
    }
    if (extraQuery) {
      if (areas.length && !remoteOnly) queries.push(tag(adzunaSearch(extraQuery, areas[0], { distanceMiles: dist, broad }), true, diag));
      else queries.push(tag(adzunaSearch(extraQuery, "", { remote: searchRemote, broad }), false, diag));
    }
    queries.push(tag(jsearchSearch(`${roles[0]} in ${areas[0] || "United States"}`), false, diag));
    return (await Promise.all(queries)).flat();
  };
  let raw: Found[] = linkedinRaw ?? (polling ? [] : await gather(false, radius));

  // The job boards send no coordinates, so place each listing from its city and state.
  const placeAll = async (raw: Found[]): Promise<void> => {
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
  };
  await placeAll(raw);

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
  if (polling) {
    // The same job is often on LinkedIn and on a board we already read. Show it once.
    const { data: have } = await db.from("job_matches").select("jobs(company, title)").eq("user_id", user.id).limit(400);
    for (const m of have ?? []) {
      const j = (Array.isArray(m.jobs) ? m.jobs[0] : m.jobs) as { company: string; title: string } | null;
      if (j) seen.add(`${norm(j.company)}|${norm(j.title)}`);
    }
  }
  let list: Found[] = [];
  let outOfRange = 0;
  let widenedNote = "";
  const choose = (rows: Found[]) => {
    list = [];
    outOfRange = 0;
    for (const r of rows.sort((x, y) => (y.posted_at ?? "").localeCompare(x.posted_at ?? ""))) {
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
  };
  choose(raw);

  // A search should not come back empty while listings exist. Try again, a little looser each time, and say so.
  if (list.length === 0 && !polling) {
    const asked = radius;
    if (!anyDistance && !remoteOnly && outOfRange > 0) {
      radius = Math.min(ANY_DISTANCE, Math.max(asked * 2, 50));
      anyDistance = radius >= ANY_DISTANCE;
      seen.clear();
      choose(raw);
      if (list.length) widenedNote = `Nothing sat within ${asked} miles, so we looked out to ${radius}. You can change this in Settings.`;
    }
    if (list.length === 0) {
      raw = await gather(true, radius);
      await placeAll(raw);
      seen.clear();
      choose(raw);
      if (list.length) widenedNote = widenedNote || "Your exact role title had no listings, so these are close matches.";
    }
  }

  // Last resort: listings other people's searches already saved, if they suit this person.
  if (list.length === 0 && !polling) {
    const words: string[] = [...new Set((roles as string[]).flatMap((r) => norm(r).split(" ")))].filter((w) => w.length > 3);
    const { data: cached } = await db
      .from("jobs")
      .select("id, title, company, location, remote_type, latitude, longitude")
      .is("owner_id", null)
      .gte("last_seen_at", new Date(Date.now() - 60 * DAY).toISOString())
      .order("first_seen_at", { ascending: false })
      .limit(400);
    const near = (cached ?? []).filter((j) => {
      const t = norm(j.title as string);
      if (words.length && !words.some((w: string) => t.includes(w))) return false;
      if (j.remote_type === "remote") return openToRemote;
      if (remoteOnly) return false;
      if (anyDistance) return true;
      if (anchors.length && j.latitude != null && j.longitude != null) return Math.min(...anchors.map((a) => haversineMiles(a, { lat: j.latitude as number, lng: j.longitude as number }))) <= radius;
      return namesOneOf((j.location as string) ?? "", areas);
    });
    if (near.length) {
      const ids = near.slice(0, MAX_JOBS).map((j) => j.id as string);
      return { ids, total: ids.length, verified: 0, agencies: 0, ghostRisk: 0, outOfRange, status: "done", note: "The job boards are not answering right now, so these are recent listings we already had on file.", sourceErrors: diag };
    }
  }

  const picked = list.slice(0, MAX_JOBS);
  if (picked.length === 0) {
    const down = diag.length > 0;
    const note = down
      ? "The job boards did not answer this time. Nothing is wrong with your profile. Please try again in a few minutes."
      : outOfRange
        ? `Every listing we found sits outside your ${radius} mile range${home ? ` from ${home}` : ""}. Widen the range in Settings, or add remote.`
        : "No listings came back. Try a broader role title or location.";
    await settle([]);
    return { ids: [], total: 0, verified: 0, agencies: 0, ghostRisk: 0, outOfRange, note, sourceErrors: diag, ...(polling ? { status: "done" } : {}) };
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

  await settle(rows.map((r) => r.id));
  return {
    ids: rows.map((r) => r.id),
    total: rows.length,
    verified: rows.filter((r) => r.legit.badge === "verified").length,
    agencies: rows.filter((r) => !r.employer_posted).length,
    ghostRisk: rows.filter((r) => r.legit.badge === "ghost").length,
    outOfRange,
    ...(widenedNote ? { note: widenedNote } : {}),
    sourceErrors: diag,
    // Tells the browser whether to start the LinkedIn search that runs beside this one.
    ...(polling ? { status: "done" } : { linkedin: linkedinOn }),
  };
});
