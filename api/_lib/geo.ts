// Turning "City, State" into coordinates so a commute radius can mean something.
//
// Everything here degrades quietly. When a lookup fails we return null and the
// caller falls back to the radius the job board itself applied, which is the
// filter that does the real work. Coordinates only add the second check and the
// "12 miles away" line in the UI.

export interface Point {
  lat: number;
  lng: number;
}

const EARTH_MILES = 3958.8;
const rad = (d: number) => (d * Math.PI) / 180;

export function haversineMiles(a: Point, b: Point): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_MILES * Math.asin(Math.min(1, Math.sqrt(s)));
}

async function getJson(url: string, init?: RequestInit, ms = 6_000): Promise<unknown> {
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

const inUS = (p: Point) => p.lat > 18 && p.lat < 72 && p.lng > -180 && p.lng < -66;

/** A five digit ZIP, on its own or at the end of an address. */
const ZIP = /\b(\d{5})(?:-\d{4})?\s*$/;

async function byZip(zip: string): Promise<Point | null> {
  try {
    const data = (await getJson(`https://api.zippopotam.us/us/${zip}`)) as { places?: { latitude: string; longitude: string }[] };
    const p = data.places?.[0];
    if (!p) return null;
    const point = { lat: Number(p.latitude), lng: Number(p.longitude) };
    return Number.isFinite(point.lat) && Number.isFinite(point.lng) && inUS(point) ? point : null;
  } catch {
    return null;
  }
}

async function byName(place: string): Promise<Point | null> {
  try {
    const q = new URLSearchParams({ q: place, format: "json", countrycodes: "us", limit: "1" });
    const data = (await getJson(`https://nominatim.openstreetmap.org/search?${q}`, {
      // OpenStreetMap asks every caller to identify itself. One lookup per person,
      // cached on their profile afterwards, sits well inside the usage policy.
      headers: { "User-Agent": "CareerQuest/1.0 (job search radius; contact via careerquest-app.vercel.app)" },
    })) as { lat: string; lon: string }[];
    const r = data[0];
    if (!r) return null;
    const point = { lat: Number(r.lat), lng: Number(r.lon) };
    return Number.isFinite(point.lat) && Number.isFinite(point.lng) && inUS(point) ? point : null;
  } catch {
    return null;
  }
}

/**
 * A city in a known state, to coordinates. This is what places a job listing,
 * because the boards we use do not send coordinates. It is one small request
 * per city, and the caller keeps the answer so no city is asked for twice.
 */
export async function geocodeCity(city: string, state: string): Promise<Point | null> {
  try {
    const data = (await getJson(`https://api.zippopotam.us/us/${encodeURIComponent(state.toLowerCase())}/${encodeURIComponent(city.trim())}`, undefined, 3_500)) as { places?: { latitude: string; longitude: string }[] };
    const places = data.places ?? [];
    if (!places.length) return null;
    // A city has several ZIP codes. Their average is close enough to its middle for a commute radius.
    const lat = places.reduce((s, p) => s + Number(p.latitude), 0) / places.length;
    const lng = places.reduce((s, p) => s + Number(p.longitude), 0) / places.length;
    const point = { lat, lng };
    return Number.isFinite(lat) && Number.isFinite(lng) && inUS(point) ? point : null;
  } catch {
    return null;
  }
}

/** Coordinates for a US place written the way a person would write it. Null when we cannot tell. */
export async function geocodeUS(place: string): Promise<Point | null> {
  const text = place.trim();
  if (!text || /^remote$/i.test(text)) return null;
  const zip = text.match(ZIP)?.[1];
  return (zip ? await byZip(zip) : null) ?? (await byName(text));
}
