# CareerQuest: what was built (recap)

Live site: https://careerquest-app-nine.vercel.app

## Payments and plans (Phase 2)
- Stripe Payment Links and a signed webhook. Pro is $24 a month or $180 a year, with a 7-day trial. The Connections add-on is $12 a month.
- Plan and add-on state is written only by the server, never by the browser.
- Billing page shows real plan and usage.

## Apply flow
- "Verify on company site" is now **View company site**.
- The Apply popup lets you pick which resume and cover letter, downloads copies, marks the job Applied, adds it to the tracker and plays confetti.

## Wren, the resume agent (Phase 3)
- Hover a line on your original resume to see Wren's suggestion, or ask for one.
- Wren never changes text while you are editing unless you approve it. Guards stop made-up numbers, stretched scope and invented names.

## Templates and format (Phase 4)
- 12 resume and 12 cover letter layouts; font, size, spacing and margin controls; page meter; Auto adjust; cut suggestions.
- "Truth check" is no longer shown to customers. It runs in the background.

## Match rules (Phase 5)
- Legitimacy filters are always on in the background. No legitimacy section on Matches.
- Applied and "Not for me" jobs disappear. New jobs come first, by when they were shown to you.
- A match you were shown stays, even if it later drifts out of range.
- Real distance from home (and any other place you would work).

## LinkedIn through Apify (Phase 6)
- Hard limits: 25 items and $0.25 per run, 3 runs per person per day, 40 a day overall.
- Admin switch, **currently OFF**. Turn it on in Admin, System, when you decide.

## Job page
- Short description with "view full post", requirements checked against your resume, Roadmap links, and "I have this" on requirements.

## Latest batch

### Matches tab
- **Your matches** sit at the top in a highlighted panel.
- **Job board** below shows every job in our cache within your reach, with its own location filter (distance from home, include remote, sort by newest, closest, best match or pay).
- Jobs not yet scored show "Check my fit"; that scores them against your resume on demand.
- **Learning:** opening, saving, applying to, or rejecting any job is recorded and used the next time your matches are scored.
- **Live usage:** counts like "2 of 3 free tailored resumes left" come from the server's monthly counters. Admin sees the same numbers per user.

### Skill Gap Roadmap
- **I have this** on any missing skill (for example "PowerPoint deck creation"): asks your level, where you used it (a past job or outside work), what you did, and anything else. It can show ways it could read on your resume.
- Your answers count as covered on jobs that ask for it and feed resume tailoring.

### Location confirmation
- Setup and Settings check the place you type (misspellings are rejected, ZIP works, "Use my location" works) and you confirm it. Searches start from that confirmed point.

### New onboarding
1. **Resume:** upload, edit everything, confirm location, add education, certifications and licences. No summary field, since the AI writes it.
2. **Career:** more choices plus "what career are you looking to get into?" in your own words.
3. **Translator and layout:** 3 templates, preview or edit inside the app. No download here.
4. **Targets:** salary range, max distance. Education moved to step 1.
5. **Pace:** no notes.
6. **Matches:** 80% and up only. If nothing reaches 80, the best three appear with their real scores and an honest note.
- **Your first resume is on us:** pick a job, we tailor the resume, you edit and preview, and you **make a free account to download**. On sign-up, a copy is emailed to you.
- Guests are real anonymous accounts, so nothing is lost when they sign up. Guests get smaller allowances and cannot use chat or some paid features.

### Landing page
- Demo and sample-account buttons, sample testimonials and sample numbers are hidden. They come back only if `VITE_ALLOW_DEMO=1`.

### Fixed while testing
- Place picker silently stopped looking things up after a failed save.
- Saving your confirmed home point was blocked by database permissions; now allowed for your own row.
- "Village of Farmingdale" now shows as "Farmingdale, NY".
- Translator heading now uses the career you typed.

## Things you must do
1. **Turn on anonymous sign-ins** (needed for guest onboarding): Supabase dashboard, Authentication, Sign In / Providers, switch on **Allow anonymous sign-ins**, Save. Until then, new visitors are sent to create an account first.
2. **Emailing a copy of the resume:** the sender is Resend's test address, which only delivers to the Resend account owner. To email real customers, verify a domain in Resend, then set `EMAIL_FROM` to an address on it.
3. Consider turning on CAPTCHA (Supabase, Authentication, Attack Protection) once guests are live.
4. Old guests can be cleared in Admin, System, Guest accounts.
5. Decide when to switch LinkedIn search on.
6. A Vercel AI Gateway key appeared in your terminal earlier. Rotate it if you have shared your screen.
