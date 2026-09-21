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
npm run test:ats               # the ATS scorer and keyword tools, no network needed
npm run test:tracker           # the tracker's counts and follow up rules, no network needed
npm run test:stripe            # the check that a payment message really came from Stripe
npm run test:agent             # the rules Wren's proposed edits must pass, no network needed
npm run test:fit               # page fitting, font and spacing controls, no network needed
npm run test:matches           # which listings appear on Matches and in what order, no network needed
npm run test:links             # links on Roadmap steps, no network needed
npm run test:apify             # reading LinkedIn scraper results and the spending limits, no network needed
node scripts/e2e-linkedin.mjs  # one real LinkedIn search through everything, about five cents
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
| ATS score | Measured from the resume itself in `src/lib/ats.ts`, out of 100: keyword coverage 35, line quality 25, structure 20, length 10, sections 10. It follows every keystroke and lists what to fix, ranked by points recovered. It is labelled an estimate, since we are not running anyone's real screening system. With no posting to compare against it scores the other four parts out of 100. |
| Wren, resume editor | `src/components/studio/WrenPanel.tsx`, `agent` and `writeLine` in `api/studio.ts`, rules in `api/_lib/agentGuard.ts`. The person chats, or points at a line on the resume, where a card shows Wren's suggestion for it (or offers to write one); Wren answers with edit cards (replace a line, the summary or the skills, or add a line) that are accepted or skipped one at a time, and each can be undone. A proposal is dropped unless it points at a real line on the page, carries only numbers already on the resume or just typed by the person, and adds a skill or a new line only from what the person said. The posting is used for wording, never as evidence. "Write a line" turns rough notes into three options, numbers only from the notes. Both share a daily limit. |
| Apply | `src/components/LiveApply.tsx`. Real accounts choose a resume (base or a saved version, previewed and editable in place), write or edit a cover letter, and download either as PDF or text, or copy it. Taking a document out marks the job Applied in the tracker as something the person did themselves (the receipt says it is unverified), fires confetti, and can be undone. Then it opens the employer's application. "View company site" goes to the employer's own careers page when we have confirmed the role there, otherwise to the top result for its official site (`src/lib/companySite.ts`). The sample account keeps the simulated flow in `ApplyFlow.tsx`. |
| Keyword panel | The terms a posting asks for, sorted into on your resume, you may have this, and not found. A model reads each posting once and the answer is saved on the job; every term must appear in the posting and is shown in the posting's own words. Clicking a term we could not find asks "Have you done this?", and it only goes on the resume in the person's own words. |
| Add a job | `src/components/ImportJobDialog.tsx`, `importJob` in `api/studio.ts`. Someone pastes a posting they found or already applied to (link optional, never fetched), and it lands in the Tracker or opens in the Studio. It is stored as a private job (`jobs.owner_id`, id `mine:<uuid>`): visible only to its owner by row level security and by 404 checks on every endpoint, left out of matches and the admin job cache, and removable from the tracker card. Applications moved forward from Saved are recorded as manual, with nothing claimed about a receipt. |
| Tracker | Columns: Saved, Applied, Screening, Interview, Offer, Rejected, Withdrawn. The summary on top (`src/lib/tracker.ts`) counts how far each application got, the share that heard back, interviewed or received an offer, and lists ones with no answer after 14 days. |
| Templates and page fit | Twelve resume layouts and twelve cover letter layouts (`src/data/resumeTemplates.ts`, `letterTemplates.ts`), all black, white and grey and made of real text. `src/lib/resumeFormat.ts` applies font, size (9.5 to 12 pt), line spacing and margins to any layout by rewriting its point sizes. `src/lib/fit.ts` measures the real page in a hidden frame and reports pages, how full the last page is and lines over or spare. Auto adjust spends line spacing and margins before type size, never goes below 9.5 pt, and never deletes anything: when it cannot fit, it lists lines the person could cut. Past 15 years of experience a second page is allowed, and preferred over shrinking type. Layouts that run to the page edge keep fixed margins. |
| Matches | `src/lib/matchRules.ts`. A listing shows only if it is not already applied to or dismissed, looks real (legitimacy is always on and never shown as a filter), was posted in the last 30 days, sits within the person's range of the nearest place they named (a listing that does not say where counts as onsite), meets their pay floor (listings with no pay stay, marked as unlisted), avoids their dealbreakers and hard requirements, and scores at least 60. Weaker ones are behind a switch, and if fewer than six pass, the best of the weaker ones (45 and up) fill the list. A match that has been shown to someone stays theirs (`job_matches.kept`, set the first time it passes; existing rows were kept when this was added): later rule changes never remove it, only applying or dismissing does. Order is newest to the person first (`job_matches.first_shown_at`), not by posting date. Boards send no reliable coordinates, so `api/jobs/search.ts` places each listing from its city and state (`geocodeCity`, cached in `geo_cache`) and saves the distance from the nearest of the person's places (`profiles.anchors`) on each match. |
| Job page | For real listings the page reads in the order someone decides in: a short description with View full post, what the posting asks for checked against the resume, gaps, the Career Translator, then the score breakdown, with legitimacy detail last. Each requirement the resume does not show has "I have this": the person says what they did, it counts as met for them, and it can go onto their resume as a line in their own words (`resume.claims`). Roadmap steps link to a real page where we know one, and otherwise to the provider's own search (`src/data/resourceLinks.ts`). |
| LinkedIn search | Apify actor `curious_coder/linkedin-jobs-scraper` (`api/_lib/apify.ts`, actions `linkedinStart` and `linkedinPoll` in `api/jobs/search.ts`). Off until staff switch it on in Admin, System (`app_settings.linkedin_enabled`). A search is started while the first results are being scored, collected in the background (the scraper takes 30 seconds or so, longer than one request may last), and its listings go through the same placement, distance, duplicate and legitimacy steps as every other source. Hard limits: 25 listings and a $0.25 price cap per run, 3 runs per person per day, 40 per day in total, all recorded in `linkedin_runs`; Apify's own monthly limit is the last backstop. LinkedIn's terms of service forbid scraping, so this is a business decision that staff can reverse with one switch. |
| Commute radius | Search starts from the home base and passes the person's own radius to the job board. Onsite and hybrid listings out of range are dropped, by coordinates where both ends have them (`api/_lib/geo.ts`). There is no nationwide fallback. |
| Payments | Stripe Payment Links (`src/live/billing.ts`) carry the account id. Only a signed webhook (`api/stripe.ts`) can switch on Pro or the Connections add on, and only a cancelled or lapsed subscription switches it off. Cards, invoices and cancelling happen on Stripe's billing portal. Events to send: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.updated`, `customer.subscription.deleted`. |
| Add ons | Insider Connections is bought separately from any plan (`billing.addOns`, written by the server only). |
| Data control | Settings exports everything from the database and can delete the account, its rows, and its files. |
| Admin panel | `/admin`, staff only. Live metrics, every account, the job cache with its legitimacy verdicts, the application feed, and a service health check. Staff can change a plan, reset onboarding, grant admin, and delete an account. Every change is written to an audit log. |

## Not built yet for real accounts

Insider Connections needs contacts the user imports themselves, which is not built, so it sits behind its add on page. Billing works in Stripe test mode once the three Stripe keys are set. Applications are recorded as "Manual required" because CareerQuest cannot submit to employer systems for the user yet.

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

### Most listings are only an excerpt

Adzuna, the main job source, returns about 500 characters of each posting. In the job cache that is 169 of
186 listings; only the JSearch listings and jobs on Greenhouse, Lever or Ashby boards carry the full text.
Keyword reading and any check that needs the whole posting (required degree, clearance, years) are therefore
working from a fragment for most jobs. The keyword panel says so and lets the person paste the full posting.
Anything that depends on hard requirements should assume this until a full-text source is added.

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
