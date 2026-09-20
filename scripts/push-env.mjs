// Copies the keys CareerQuest needs from .env.local up to Vercel.
// Run after `vercel login` and `vercel link`:  node scripts/push-env.mjs
//
// Safe to run again: each variable is written with --force, which overwrites in
// place. Nothing is ever removed first, so a failed write cannot leave the
// project with a missing key. Values are passed to the Vercel CLI and are
// never printed here.
import { execFileSync, spawnSync } from "node:child_process";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

// Everything the deployed app reads. SUPABASE_DB_URL is left out on purpose:
// only the local migration script uses it, so it never needs to leave this machine.
const REQUIRED = ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "ANTHROPIC_API_KEY", "ADZUNA_APP_ID", "ADZUNA_APP_KEY"];
const OPTIONAL = ["RAPIDAPI_KEY", "RESEND_API_KEY", "ADMIN_EMAILS", "STRIPE_SECRET_KEY", "VITE_STRIPE_PUBLISHABLE_KEY", "STRIPE_WEBHOOK_SECRET"];
const TARGETS = ["production", "preview", "development"];

const vercel = (args) => spawnSync("npx", ["vercel", ...args], { encoding: "utf8", shell: process.platform === "win32" });
const lastLine = (s) => (s || "").trim().split("\n").filter(Boolean).slice(-1)[0] ?? "no output";

try {
  execFileSync("npx", ["vercel", "whoami"], { stdio: "ignore", shell: process.platform === "win32" });
} catch {
  console.error("Not logged in. Run `npx vercel login` first, then `npx vercel link`.");
  process.exit(1);
}

const missing = REQUIRED.filter((k) => !process.env[k]?.trim());
if (missing.length) {
  console.error(`These are empty in .env.local and the app needs them: ${missing.join(", ")}`);
  process.exit(1);
}

let done = 0;
let skipped = 0;
let failed = 0;

for (const key of [...REQUIRED, ...OPTIONAL]) {
  const value = process.env[key]?.trim();
  if (!value) {
    console.log(`  skip   ${key} (empty in .env.local)`);
    skipped++;
    continue;
  }

  // A VITE_ value is compiled into the browser bundle, so it is public by
  // definition. Storing it as config rather than a secret is both honest and
  // stops Vercel pausing to ask whether we really meant to expose it.
  const kind = key.startsWith("VITE_") ? "--no-sensitive" : "--sensitive";

  const bad = [];
  for (const target of TARGETS) {
    const r = vercel(["env", "add", key, target, kind, "--force", "--value", value]);
    if (r.status !== 0) bad.push(`${target}: ${lastLine(r.stderr)}`);
  }

  if (bad.length) {
    console.error(`  FAIL   ${key}`);
    for (const b of bad) console.error(`         ${b}`);
    failed++;
  } else {
    console.log(`  set    ${key}`);
    done++;
  }
}

console.log(`\n${done} set, ${skipped} skipped, ${failed} failed.`);
if (failed) {
  console.error("Fix the failures above before deploying: the app will not work without every required key.");
  process.exitCode = 1;
} else {
  console.log("Now run:  npx vercel --prod");
}
