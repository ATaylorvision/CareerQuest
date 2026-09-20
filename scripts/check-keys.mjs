// Verifies every service key in .env.local with a harmless read-only call.
// Prints OK or a plain reason for each service. Never prints a key.
import { config } from "dotenv";
import Anthropic from "@anthropic-ai/sdk";

config({ path: ".env.local" });
const env = process.env;
const results = [];

async function check(name, required, fn) {
  const missing = required.filter((k) => !env[k] || !env[k].trim());
  if (missing.length) {
    results.push({ name, ok: false, note: `missing ${missing.join(", ")}` });
    return;
  }
  try {
    const note = await fn();
    results.push({ name, ok: true, note: note ?? "" });
  } catch (e) {
    results.push({ name, ok: false, note: String(e?.message ?? e).slice(0, 180) });
  }
}

async function getJson(url, init) {
  const r = await fetch(url, init);
  const text = await r.text();
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${text.slice(0, 140)}`);
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

await check("Supabase (public anon key)", ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"], async () => {
  const url = env.VITE_SUPABASE_URL.replace(/\/$/, "");
  const s = await getJson(`${url}/auth/v1/settings`, { headers: { apikey: env.VITE_SUPABASE_ANON_KEY } });
  return `auth reachable, email signups ${s?.disable_signup ? "DISABLED" : "enabled"}`;
});

await check("Supabase (service role key)", ["VITE_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"], async () => {
  const url = env.VITE_SUPABASE_URL.replace(/\/$/, "");
  await getJson(`${url}/auth/v1/admin/users?per_page=1`, {
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
  });
  return "admin access works";
});

await check("Supabase (database connection)", ["SUPABASE_DB_URL"], async () => {
  const pg = (await import("pg")).default;
  const client = new pg.Client({ connectionString: env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const r = await client.query("select count(*)::int as n from information_schema.tables where table_schema = 'public'");
  await client.end();
  return `connected, ${r.rows[0].n} tables in public schema`;
});

await check("Anthropic", ["ANTHROPIC_API_KEY"], async () => {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const m = await client.models.retrieve("claude-opus-5");
  return `key valid, ${m.display_name ?? m.id} available`;
});

await check("Adzuna", ["ADZUNA_APP_ID", "ADZUNA_APP_KEY"], async () => {
  const q = new URLSearchParams({ app_id: env.ADZUNA_APP_ID, app_key: env.ADZUNA_APP_KEY, results_per_page: "1", what: "operations manager", where: "Providence, RI" });
  const d = await getJson(`https://api.adzuna.com/v1/api/jobs/us/search/1?${q}`);
  return `${d.count?.toLocaleString?.() ?? d.count} live listings for "operations manager" near Providence`;
});

await check("JSearch (RapidAPI)", ["RAPIDAPI_KEY"], async () => {
  const q = new URLSearchParams({ query: "operations manager in Providence, RI", page: "1", num_pages: "1" });
  const d = await getJson(`https://jsearch.p.rapidapi.com/search-v2?${q}`, {
    headers: { "x-rapidapi-key": env.RAPIDAPI_KEY, "x-rapidapi-host": "jsearch.p.rapidapi.com" },
  });
  return `${d.data?.jobs?.length ?? 0} listings returned`;
});

await check("Stripe", ["STRIPE_SECRET_KEY"], async () => {
  const mode = env.STRIPE_SECRET_KEY.startsWith("sk_live") || env.STRIPE_SECRET_KEY.startsWith("rk_live") ? "LIVE mode (switch to a test key for now)" : "test mode";
  await getJson("https://api.stripe.com/v1/balance", { headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` } });
  return `key valid, ${mode}`;
});

await check("Resend", ["RESEND_API_KEY"], async () => {
  const r = await fetch("https://api.resend.com/domains", { headers: { Authorization: `Bearer ${env.RESEND_API_KEY}` } });
  if (r.status === 401 || r.status === 403) {
    const t = await r.text();
    if (/restricted/i.test(t)) return "sending-only key (fine for sending email)";
    throw new Error(`HTTP ${r.status}: ${t.slice(0, 120)}`);
  }
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const d = await r.json();
  return `key valid, ${d.data?.length ?? 0} verified domain(s)`;
});

for (const r of results) console.log(`${r.ok ? "OK  " : "FAIL"}  ${r.name.padEnd(32)} ${r.note}`);
process.exit(results.every((r) => r.ok) ? 0 : 1);
