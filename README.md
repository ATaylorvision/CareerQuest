# CareerQuest

An AI job search copilot for career changers and people restarting after a layoff.

Two modes live in one app:

- **Real accounts.** Sign up, upload a resume, and get real matches from real, current job listings. Data is stored per user in Supabase.
- **Sample account.** "Open the sample account" on the login page runs a fictional user (Renee Castillo) entirely in the browser. Nothing is saved.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

Keys go in `.env.local`. The easy way: open **http://localhost:5173/setup**, paste the keys into the form, press Save, Test, then "Create the database tables". That page only works on your own computer.

```bash
npm run check-keys   # tests every key, prints OK or FAIL, never prints a key
npm run db:migrate   # applies supabase/schema.sql
node scripts/e2e-backend.mjs   # full backend test with a throwaway account (dev server must be running)
node scripts/e2e-admin.mjs     # tests the admin panel API, including that a normal account is refused
node scripts/e2e-studio.mjs    # tests tailoring, cover letters and interview prep against a real cached job
npm run security               # two accounts, then tries every way one could read or change the other
```

## What is real

| Feature | How it works |
|---|---|
| Accounts | Supabase Auth, email and password, password reset. |
| Resume parsing | The real file goes to Claude (`api/resume/parse.ts`). PDF, .docx, .txt. Text is copied verbatim. People with no file answer plain questions instead (`src/pages/onboarding/ResumeBuilder.tsx`). |
| Job listings | Adzuna, plus JSearch once the RapidAPI key is subscribed. Titles only, freshest first, agencies and internships flagged or filtered. |
| Listing legitimacy | `src/lib/legit.ts`. Signals: days posted, reposts we observed, on the company's own careers page (Greenhouse, Lever, Ashby feeds), agency vs employer, salary listed. Applicant counts are shown as "Not available" because job boards do not share them. |
| Matching | Two stages. `score` rates every listing quickly. `detail` writes the translation, requirement checks, and gaps for the top matches and any job you open. A truth guard rejects any number the model did not get from the resume or posting. |
| Studio | `src/pages/app/Studio.tsx`. One page per job: the document itself is editable in place, with the ATS score, the tailor's suggestions, the gaps, the Career Translator, and saved versions beside it. The cover letter is the second document under the same job picker. |
| Career Translator | `api/translate.ts`. Relabels resume lines, never adds facts. Lives as a panel in the Studio. |
| Wren (copilot) | `api/chat.ts`. Streams Claude replies with the user's resume, matches, and applications as context. |
| Proof of Application | Applying to a real job records a receipt. Confirmation evidence (pasted email or screenshot) is read by Claude before anything counts as verified (`api/receipt/verify.ts`). |
| Dashboard | One screen to run the search. Streak on top, then counts, today's plan, the six week chart, and next week's target. A profile question a day sharpens matching, and the resume downloads straight from here. |
| Templates | Five resume layouts and five cover letter layouts in `src/data/resumeTemplates.ts` and `letterTemplates.ts`. Each thumbnail is the real template rendered with the user's own content. All are one page, black and white, and made of selectable text so an ATS can read them. |
| Commute radius | Search starts from the home base and passes the person's own radius to the job board. Onsite and hybrid listings out of range are dropped, by coordinates where both ends have them (`api/_lib/geo.ts`). There is no nationwide fallback. |
| Add ons | Insider Connections is bought separately from any plan (`billing.addOns`, written by the server only). |
| Data control | Settings exports everything from the database and can delete the account, its rows, and its files. |
| Admin panel | `/admin`, staff only. Live metrics, every account, the job cache with its legitimacy verdicts, the application feed, and a service health check. Staff can change a plan, reset onboarding, grant admin, and delete an account. Every change is written to an audit log. |

## Not built yet for real accounts

Insider Connections needs contacts the user imports themselves, which is not built, so it sits behind its add on page. Billing is not switched on: plans are shown honestly and nothing is charged. Applications are recorded as "Manual required" because CareerQuest cannot submit to employer systems for the user yet.

## Admin panel

`#/admin`, for staff only. An account becomes staff in one of two ways, and both are decided on the server:

1. Its email is listed in `ADMIN_EMAILS` (comma separated). The account is marked as staff the first time it opens the panel. This is how the first admin exists.
2. An existing admin grants it from the Users screen.

`profiles.is_admin` can only be written by the server. The update grant is revoked from signed in users, so nobody can promote themselves. Every admin request re-checks access; the hidden nav link is a convenience, not the lock.

Resume contents are deliberately never returned to the panel. Staff see that a resume exists and what it is called, nothing more.

## Deploying

Live at **https://careerquest-app-nine.vercel.app** (Vercel project `careerquest-app`).

```bash
npx vercel login      # once per machine
npx vercel link --yes # once per checkout
npm run push-env      # copies the keys from .env.local to Vercel, all three targets
npx vercel --prod
```

**If a deploy shows `BLOCKED` or sits on `UNKNOWN`:** Vercel refuses a deployment whose git commit
author is not a member of the Vercel account, and it reads the author from this folder's git history.
Deploys worked before the folder became a repo. Until the commit email matches a Vercel member (or the
GitHub integration is connected), deploy without git metadata:

```bash
GIT_DIR=/nonexistent npx vercel --prod --yes
```

`npx vercel inspect <url>` only says `UNKNOWN`. The real reason is in the deployment's `readyStateReason`
field on the API, which is where this was found.

`push-env` is safe to re-run: it overwrites each variable in place and never removes one first.
`VITE_` values are stored as plain config because they are compiled into the browser bundle
and are public by definition. Everything else is stored as a secret.

Supabase needs the deployed URL in **Authentication > URL Configuration**, as the Site URL and
in Redirect URLs, or confirmation and password reset emails will send people to localhost.

## Security

`npm run security` creates two throwaway accounts, gives one of them real rows, and then tries to
reach or change that data as the other, through every route a browser has. It checks cross account
reads and writes, privilege escalation, private file access, the admin API, the shared job cache,
and that a signed out visitor sees nothing. It also confirms a person's own data survives a fresh
sign in, which is what the tracker depends on.

Two rules worth knowing before changing the schema:

1. **A column level `REVOKE` does nothing on its own.** Supabase grants `authenticated` UPDATE on the
   whole table, and a table wide grant supersedes a column one. Revoke the table grant first, then
   grant back only the columns a person may edit.
2. **`guard_profile_columns` is the backstop.** Grants are easy to widen by accident, so a trigger
   refuses any change to `is_admin`, the billing columns, `add_ons`, `email` or `id` unless the
   caller is the service role. Server code keeps working; a browser session cannot get past it.

### Daily limits and headers

Every endpoint that spends money takes from `take_quota()` before it does any work: one atomic counter
per person, per kind of work, per UTC day (`api_usage`). Limits live next to each endpoint. The security
suite proves the limit bites, that it is per person, and that a browser cannot call or write it.

`vercel.json` sets a content security policy that refuses inline scripts, plus nosniff, frame denial, a
referrer policy and a permissions policy. Anything that needs a script must be a same origin file (see
`public/theme-init.js`); print windows are started from the opener rather than by a script in the page.
The Supabase project host is written into `connect-src`, so a new project needs that line updated.

### npm audit, triaged

Nine advisories, one of which ships to browsers. `react-router-dom` (moderate, open redirect through a
backslash in a link target) is not exploitable here: every link is a fixed path or a fixed prefix plus our
own id, and nothing reads a `next` or `redirect` parameter. Fixing it means a major router upgrade. The
other eight (`vite`, `esbuild`, `@vercel/node` and what it pulls in) are dev server or build tooling and
are never in the production bundle. Revisit if anything starts navigating to a URL a person can supply.

## Layout

- `src/` React app. `src/live/` is the real-account layer (auth, database, job pipeline).
- `api/` serverless functions (Vercel format). Locally they run inside the Vite dev server (`dev/apiPlugin.ts`).
- `supabase/schema.sql` the database, with row level security on every table.
- `src/pages/admin/` the staff panel. `api/admin.ts` is its only endpoint, and `api/_lib/admin.ts` is the guard.
- `vercel.json` function settings for deploy.

All companies, people, and testimonials in the sample account are fictional.
