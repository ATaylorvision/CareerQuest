# CareerQuest: handoff

Written 2026-09-21. Everything below was verified in this working copy unless marked **not verified**.

## State of the repo

- Path: `C:\Users\alesh\OneDrive\Desktop\CoWork OS\CareerQuest\careerquest-app`
- Branch `master`, working tree clean at `123b028`. **No git remote is configured.** Nothing below has been pushed.
- Live site: `https://careerquest-app-nine.vercel.app`. **It is almost certainly still running the code from before this work.** The last deploy predates these commits, and nothing here has been deployed.
- Vercel project `careerquest-app`, id `prj_n2YigBtHByUc3fIqmXgyuSdOpyXH`, team `team_ewF3krdJE6ZG4uzO21TsjSSE` (scope `ataylorvisions-projects`).
- Supabase project ref `xqgegirgqgmombjslxlm`.
- Stack: Vite + React + TypeScript SPA (HashRouter), Vercel serverless functions in `api/`, Supabase (auth, Postgres, storage), Anthropic API, Adzuna for listings.
- Secrets live in `.env.local` (gitignored, verified excluded from every commit). Never paste them into a chat or commit them.

## Read this first: two things that will break production

1. **The database migration has NOT been applied.** `api/jobs/search.ts` now writes `jobs.latitude/longitude` and reads/writes `profiles.home_lat/home_lng/home_geocoded_for`. I checked the live database: none of those columns exist. Deploying the new code first makes job search fail. Order: run `npm run db:migrate` (idempotent, uses `SUPABASE_DB_URL`), then deploy. This is the user's live database, so get their explicit yes before running it.
2. **The user's own account cannot get local matches yet.** `g2gintelligence@gmail.com` has an empty home base and no target roles. Search would fall back to remote-only. Their other three profiles are test accounts.

## Work completed (commits, oldest first)

Base: `4276014` "real studios, admin portal, and per-user data isolation" (earlier work).

### `b79ae6f` Search where the person lives, drop Shield branding
- **Root cause of the wrong-state jobs:** `api/jobs/search.ts` read the optional `locations` list, never `location` (home base) or `max_distance_miles`. An empty list fell back to `[""]`, a nationwide search.
- Search now starts from the home base, passes the person's own radius to Adzuna (was a hardcoded 40), and drops anything out of reach. A listing with no coordinates that skipped the board's radius search must name one of the person's places. There is **no nationwide fallback**.
- New `api/_lib/geo.ts`: haversine distance and a US geocoder (zippopotam.us for ZIPs, Nominatim for names). Home base is geocoded once and cached on the profile.
- `api/_lib/sources.ts`: `RawJob` carries latitude/longitude; `adzunaSearch` takes `distanceMiles`.
- Job cards show "N mi from home" (per-user distance computed client side in `src/live/mapJob.ts`).
- Settings gained the missing Home base field and a commute slider (there was none, so "widen your range" pointed nowhere).
- **Ghost Job Shield removed as a named feature.** Removed the sidebar control, the filter-panel section, the Settings threshold slider, and the marketing copy (Landing, Pricing, PricingTiers, README, admin labels). Scoring, the per-listing badge, and the silent filtering of listings below `legitThreshold` remain.

### `63a58af` One Studio
- `src/pages/app/Studio.tsx` replaces Resume Studio, Cover Letters, and the Career Translator. Old files deleted.
- The resume document is the page and every line is editable in place (`src/components/studio/EditableText.tsx`, `ResumeDocument.tsx`). Emptying a line deletes it. A retyped line is marked as the writer's own, not as tailored.
- Beside it (`src/components/studio/panels.tsx`): ATS score (replaces the Truth Mode panel), tailor suggestions with reasons, gaps, Career Translator (including free-text translate), saved versions. Cover letter is the second document under the same job picker.
- `src/lib/resumeBuild.ts`: `buildResume` takes manual edits; store gained `resume.edits` (per job) and `resume.contact` (account-wide). Wording is per version; name and contact sync to the account.
- Nav is six: Dashboard, Matches, Tracker, Studio, Skill Gap Roadmap, Copilot. Interview Prep and Insider Connections are now cards on the Tracker. `/app/resume`, `/app/cover-letter`, `/app/translator` redirect to `/app/studio`, keeping the query string. All internal links updated.

### `861954e` Dashboard
- Streak card first; Proof Score removed from the dashboard (it stays on the Tracker); "Saved, not sent" tile added.
- Direct resume download (PDF via print, or .txt) from the dashboard.
- New `src/components/ProfileQuestions.tsx`: one skippable profile question at a time (home base, commute, target title, remote, salary floor, dealbreaker). Uses a new optional `answered` map in the store.

### `e5dac60` Onboarding
- `src/pages/onboarding/ResumeBuilder.tsx`: "I do not have one yet" builds a base resume from plain questions. Nothing is invented for the person.
- Layout previews (rendered with their own content) shown during setup.
- Setup ends with the free tailored resume, handing off to `/app/studio?job=…&tailor=1`, which auto-runs the tailor.
- **Two bugs fixed along the way:** the demo translator step crashed on any non-sample resume (read bullet ids that no longer existed); `saveResume` only updated an existing row, so a built (never uploaded) resume had nothing to update. It now inserts.

### `123b028` README brought in line; add-on page gets its own title.

### Other changes
- `vite.config.ts` reads `PORT`, and `.claude/launch.json` has `autoPort: true`, so a second dev server does not collide on 5173.
- `supabase/schema.sql` has the new columns appended (idempotent).

## Diagnostics run 2026-09-21

**Passed:** `npm run security` 35/35 (two-account isolation, admin injection, job cache read-only, signed-out sees nothing). RLS enabled on every public table. All of `jobs/search`, `admin`, `chat`, `resume/parse`, `account/delete` return 401 unauthenticated. Resume template HTML is escaped. Upload caps are 3 MB. Admin promotion requires a confirmed email. HSTS is set. `npm run build` and both typechecks are clean.

**Live location test (Adzuna, real API):** Providence, New York, Austin, Boise at 15 and 30 mile radii. The radius is honored and coordinates come back on 70–100% of listings. Boise at 15 miles returned listings 24 miles out, which the coordinate filter now catches. Boise at 15 miles returned only 9 results.

**Not verified:** an authenticated end-to-end search (no user session available), the deployed code version, production env vars, production runtime errors. The Vercel API returned 403 for this session's token.

## Findings, by severity

1. **High, no rate limiting on paid endpoints.** Only `chat` and `studio` are metered. `jobs/search`, `resume/parse`, `receipt/verify`, `translate`, `jobs/match` are not. Signup is open and email confirmation is off, so anyone can create accounts and burn Anthropic and Adzuna credits.
2. **High, email confirmation is off.** Admin protection (`api/_lib/admin.ts` requires a confirmed email) is defeated because Supabase stamps confirmation automatically. Only matters if a second address is ever added to `ADMIN_EMAILS`, but real users also never prove ownership of their address.
3. **High, geocoder fragility.** Nominatim often blocks cloud IPs. The Census geocoder returns nothing for a bare "Providence, RI" (tested). Failure degrades gracefully (Adzuna's radius still applies, distance labels disappear), but it should not depend on either.
4. **High, thin markets and free-text home base.** One page of 20 per role and place. No confirmation that the home base was understood, so a typo silently degrades results.
5. **Medium, no security headers** (CSP, X-Frame-Options, nosniff, Referrer-Policy). Fixable in `vercel.json`.
6. **Medium, `npm audit`:** 3 vulnerabilities (1 low, 2 moderate). Only the react-router SSR-hydration advisory was triaged; it is not exploitable in this browser-only app. The other two are untriaged.
7. **Low, prompt injection:** resumes and job text reach model prompts. Blast radius is small (a numeric truth guard checks output, and results return only to the same user).
8. **Low, work mode:** 143 of 186 cached jobs have `remote_type = unknown`. They are treated as onsite, so filtering stays safe, but the label reads "Not stated".

Functional gaps: **no Privacy Policy or Terms pages** (the app stores resumes, so this is a launch blocker); Stripe keys are empty (billing is off, plans are shown honestly); Supabase Site URL was still `localhost` when last checked, so password reset is broken; no error monitoring; Vercel is at 10 of 12 functions (Stripe needs 2); three test accounts still count in admin metrics; Adzuna is US-only and is the only job source (JSearch is unsubscribed).

## Outstanding work

### A. Needs the user (I could not do these)
1. **Vercel access.** Re-authenticate to scope `ataylorvisions-projects` (`vercel login`, or reconnect the connector). Then read env vars and runtime errors and deploy.
2. **Approve the migration** (`npm run db:migrate`) against the live database.
3. **Supabase dashboard:** set Site URL to `https://careerquest-app-nine.vercel.app` and add `https://careerquest-app-nine.vercel.app/**` to Redirect URLs. Verify a sending domain in Resend (DNS records), set Resend as custom SMTP in Supabase, then turn "Confirm email" back on. Enable CAPTCHA (Cloudflare Turnstile is free) and provide the site key.
4. **Adzuna:** confirm the plan's monthly call limit so searches can be sized to it. **JSearch:** optionally subscribe on RapidAPI for a second source.
5. **Anthropic Console:** set a monthly spend limit.
6. **GitHub:** create an empty private repo, then `git remote add origin <url>`, `git branch -M main`, `git push -u origin main` (`gh` is not installed).
7. **Decisions:** launch free-only or wire Stripe now; get Privacy and Terms reviewed (ideally by a lawyer).
8. **Approve deleting the three test accounts** (`cq-ui-test-1`, `cq-e2e-…`, `cq-speed-…` at example.com). Deletion is permanent.
9. **Acceptance testing:** provide 3–5 real places to cover (at least one rural), and set a real home base and target role on their own account.

### B. Buildable without credentials
1. **Bundled US places/ZIP table with coordinates** (Census, public domain) replacing the external geocoder. This is the core of making location matching dependable.
2. **Home-base confirmation at onboarding** ("We understood: Farmingdale, New York"); block if unresolved.
3. **Pagination plus a widen-your-range prompt** ("12 within 15 miles, 41 within 30").
4. **Per-user daily caps** on every paid endpoint, stored in `usage_counters`.
5. **Security headers** in `vercel.json`.
6. **Privacy, Terms, Contact pages** (draft only, needs legal review).
7. **Error logging.**
8. **Automated location acceptance test:** for profiles in about five metros plus one rural area, every non-remote result is within the radius and metros return at least 10 results.
9. Triage the two remaining `npm audit` advisories.

### C. Launch sequence
1. Phase B work, then A1–A5.
2. Run the migration (A2).
3. Push to GitHub (A6) and deploy.
4. Smoke test with a fresh real account: signup, onboarding with a real home base, location-correct matches, Studio edit, PDF download.
5. Delete the test accounts (A8).

## Acceptance bar for the MVP

Location-specific matching is non-negotiable. Done means: for each test profile, 100% of onsite and hybrid results fall within the person's radius of their home base, remote roles appear only when the person allows remote, metros return at least 10 results, and a thin market says so plainly and offers to widen.

## Useful commands

```bash
npm run build          # typecheck + production build
npm run security       # two-account isolation suite (creates and removes throwaway accounts)
npm run db:migrate     # applies supabase/schema.sql (idempotent)
npx tsc -p tsconfig.api.json --noEmit   # typecheck the serverless functions
```

## Gotchas

- The dev server proxies `/api` via `dev/apiPlugin.ts` and reads `.env.local`. The demo account ("Explore the demo account" on the landing page) needs no credentials and is how UI changes were verified.
- Files are edited with LF; Git warns about CRLF conversion on Windows. This is harmless.
- `dist/` is gitignored. Vercel builds with `npm run build:fast`.
