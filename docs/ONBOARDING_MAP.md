# CareerQuest Onboarding: Complete Map (Draft v1)

Goal: get everything needed to find real, fitting, nearby jobs, build a strong resume, and start the daily plan. Target is 15 screens. Every field is tagged:

- **[R]** required to continue  **[O]** optional  **[A]** auto-filled from resume (user confirms)
- **→ Used for**: why we ask (if we cannot say why, we cut the field)

Today the app has 6 steps (Resume, Career, Translator, Targets, Pace, Matches). This map expands that to 15 screens. Existing screens are marked **EXISTS**, changed ones **EXPAND**, new ones **NEW**.

---

## 0. Global rules (apply to every screen)

- Progress bar at top: "Step X of 15" plus a named step list. Completed steps are clickable to go back.
- Buttons on every screen: **Back**, **Continue** (disabled until required fields are valid, with a one-line reason next to it), **Save and finish later** (saves draft, emails a resume link).
- Autosave after every field change. Returning users land on the last unfinished screen.
- Every screen: "Why we ask" link that expands one sentence.
- Sensitive fields (EEO, disability, veteran, criminal record, salary history) always have **Prefer not to say** and are never shown to employers, never used to filter jobs.
- Nothing is sent to any employer during onboarding.
- Full keyboard and screen-reader support, plain 8th-grade wording.

---

## THE DECISION TREE

```
START
 │
 ├─ 1 Welcome / Account ─────────────── new user ──► 2
 │                                       returning ─► resume at last screen
 │
 ├─ 2 Your situation
 │     ├─ Career changer ──────────────► shows 5b (why changing) + 6 (translator)
 │     ├─ Recently laid off ───────────► shows 5c (layoff details: date, severance, unemployment)
 │     ├─ Employed and looking ────────► shows 5d (current employer privacy: hide from current employer)
 │     ├─ Returning to work ───────────► shows 5e (gap: how long, what you did, refresher skills)
 │     ├─ New grad / first job ────────► skips work-history depth, expands education + projects
 │     └─ Veteran / military transition ► shows 5f (MOS/rank translator) + veteran benefits
 │
 ├─ 3 Resume
 │     ├─ Upload file ─► parse ─► success ─► 4
 │     │                       └─ fail ───► "Try again" or "Build one with me" ─► 3b
 │     ├─ Paste text ──► parse ─► 4
 │     ├─ Import LinkedIn ─► parse ─► 4
 │     └─ No resume ───► 3b guided builder (10 questions) ─► 4
 │
 ├─ 4 Confirm what we read (work, education, skills, certs)
 │     └─ missing dates / gaps > 6 months ─► flag inline, ask "what happened?" (optional, feeds gap narrative)
 │
 ├─ 5 Where you live (must confirm location) ─► 5b–5f conditional screens per situation
 │
 ├─ 6 Career direction
 │     ├─ Same field ──────────────────► 8
 │     └─ Different field ─► 7 Translator ─► 8
 │
 ├─ 7 Translator (only if changing fields or resume shows weak fit)
 │
 ├─ 8 Target roles + level
 ├─ 9 Work setup + distance + travel
 ├─ 10 Pay + benefits
 ├─ 11 Must-haves and dealbreakers
 ├─ 12 Work authorization + logistics (start date, license, background)
 ├─ 13 Application answers vault (reused across applications)
 ├─ 14 Pace + schedule + notifications
 └─ 15 Review, first matches, plan  ─► DASHBOARD
```

Branch summary: **screens 1, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13, 14, 15 always show. Screens 5b–5f and 7 appear only when the answer on screen 2 or 6 calls for them.** A career changer sees 16 screens; a plain job seeker sees 14 to 15.

---

## SCREEN-BY-SCREEN

### 1. Welcome and account — NEW (some exists in Auth)
| Field / control | Type | Req | Used for |
|---|---|---|---|
| Sign up with Google / Apple / Email | buttons | R | Account |
| Email | text | R | Login, receipts, reminders |
| Password (if email) | password, 8+ chars, show/hide | R | Login |
| Terms and Privacy checkbox | checkbox | R | Legal consent |
| "How did you hear about us?" | dropdown (Search, Friend, Social, Career center, Workforce agency, Other) | O | Marketing, partner tracking |
| Referral / partner code | text | O | Discounts, agency partnerships |
| Promise card: "We never apply without your OK" | info | — | Trust |

Buttons: **Create account**, **Log in instead**, **Continue with Google**.

### 2. Your situation — EXISTS (EXPAND)
| Field | Type | Req | Used for |
|---|---|---|---|
| Situation | 6 cards (Changer, Laid off, Employed, Returning, New grad, Veteran) | R | Drives the branch tree |
| Urgency | 4 cards: "Need income now", "Within 3 months", "Within 6 months", "No rush" | R | Pace default, Wren tone, filter strictness |
| Preferred first name | text | R | Greeting, letters |
| Age range 18+ confirm | checkbox | R | Legal |

### 3. Your resume — EXISTS
| Control | Type | Req | Notes |
|---|---|---|---|
| Upload | drag/drop or picker (PDF, DOCX, TXT, up to 10 MB) | one of four | Parses roles, dates, bullets, skills |
| Paste text | textarea | | Same parser |
| Import LinkedIn | URL or PDF export | | Same parser |
| "I don't have a resume" | button | | Goes to 3b |
| Progress panel | info | | "Reading roles, dates, bullets..." |

**3b Guided builder (NEW, only if no resume):** for each job (up to 5): title, employer, city, start month/year, end month/year or "Current", 3 prompts ("What did you do daily? What did you fix or improve? Any numbers?"). Then education, skills, certifications. Wren turns answers into bullets.

### 4. Confirm what we read — EXPAND
Editable cards, all **[A]**:
| Section | Fields |
|---|---|
| Contact | Full name **[R]**, email **[R]**, phone **[R]**, city/state **[R]**, LinkedIn URL [O], portfolio/website [O] |
| Work history (each) | Job title, employer, city, start, end/current, bullets (add, edit, delete, reorder) |
| Education (each) | School, degree/credential, field, graduation year, "in progress" toggle, GPA [O, hidden by default] |
| Certifications & licenses (each) | Name, issuer, year earned, expiry [O], license number [never shown on resume] |
| Skills | tag editor, suggested skills chips, mark "top 5" |
| Languages | language + level |
| Summary | 2 to 3 sentence text, "Write it for me" button |
| Extras | Volunteer, military, awards, publications, projects [all O] |

Flags shown inline: "Gap of 14 months between X and Y", "No dates on this job", "Bullet has no result".
Buttons: **Looks right**, **Add a job**, **Re-upload**, **Fix with Wren**.

### 5. Where you live — EXISTS (EXPAND)
| Field | Type | Req | Used for |
|---|---|---|---|
| Home base | place picker (must confirm on map) | R | Real distance filter |
| Street address / ZIP | text | O | Exact commute time (ZIP is enough) |
| Willing to relocate? | No / Within state / Anywhere / Only for the right offer | R | Widens search |
| Relocation cities | tag editor | O | Extra search areas |
| Has reliable transportation | Yes / Public transit only / No | R | Commute filter, transit-friendly jobs |
| Has own vehicle | yes/no | O | Driving-required roles |

### 5b–5f Situation branches (each appears only if picked on screen 2)
**5b Career changer:** Why changing (multi-select: burnout, pay, growth, layoff, passion, health, schedule, other); years of experience you want to carry over; open to taking a pay cut for a new field (Yes/No/Some, with $ amount).
**5c Laid off:** Last day worked (date); received severance (Y/N, weeks) [O]; filing unemployment (Y/N) [O]; reason for leaving wording ("Position eliminated", "Company closed", "Downsizing"), so Wren writes it truthfully in letters; job search deadline (weeks of runway) [O].
**5d Employed:** Hide search from current employer (toggle; blocks their company name in matches and skips confidential postings); notice period (none, 2 weeks, 4 weeks, custom); current pay for negotiation [O, private]; can interview during work hours (Y/N).
**5e Returning:** Time away (dropdown); reason (family, health, school, travel, other) [O]; what you did meanwhile (volunteer, courses, freelance) [O]; wants "returnship" / re-entry programs (Y/N); confidence check-in ("How rusty do you feel?" 1–5) sets gentler pace.
**5f Veteran/military:** Branch, rank, MOS/rating, years served, discharge type [O], security clearance (none / active / expired, level) [O]; interested in veteran-hiring employers (Y/N); military skills translator runs at screen 7.

### 6. Career direction — EXISTS (EXPAND)
| Field | Type | Req | Used for |
|---|---|---|---|
| Path | "Stay in my field" / "Move to a related field" / "Totally new field" | R | Skips or shows translator |
| Fields you're drawn to | 5 field cards + 16 idea chips + "Something else" text | R (unless "stay") | Field targets |
| Anything you definitely do NOT want to do | tag editor | O | Filter |
| Interest in self-employment / gig / freelance | yes/no | O | Adds contract roles |

### 7. Translator — EXISTS (only if changing fields)
Shows: your past skills mapped to new field, transferable strengths, gaps, quick wins (courses, certs). Controls: **Accept**, **Edit**, **Remove a line**, **Ask Wren**. Feeds resume rewrite; user picks resume layout and previews (existing "Design" panel).

### 8. Target roles and level — EXISTS (EXPAND)
| Field | Type | Req | Used for |
|---|---|---|---|
| Target job titles | tag editor with suggestions from resume | R (1+) | Match query |
| Seniority | Entry / Mid / Senior / Lead / Manager / Director+ | R | Level fit |
| Open to a step down | Yes / No | O | Widens match |
| Open to stretch roles one level up | Yes / No | O | Widens match |
| Employment type | Full-time / Part-time / Contract / Temp / Seasonal / Internship (multi) | R | Filter |
| Industries to prefer / avoid | two tag editors | O | Ranking, filter |
| Company size | Startup / Small / Mid / Large / No preference | O | Ranking |
| Companies to target | tag editor | O | Watchlist |
| Companies to never show | tag editor | O | Blocklist |

### 9. Work setup, distance, schedule — EXISTS (EXPAND)
| Field | Type | Req | Used for |
|---|---|---|---|
| Work style | Remote / Hybrid / Onsite / Open to all | R | Filter |
| Max distance | slider 5–100 mi | R (if not remote) | Filter |
| Max commute time | slider 10–90 min | O | Filter |
| Days per week onsite (if hybrid) | 1–5 | O | Filter |
| Other places you'd work | tag editor | O | Extra areas |
| Shift preference | Days / Evenings / Nights / Weekends / Rotating / Flexible (multi) | R for hourly/trade roles | Filter |
| Hours per week | 10–20 / 20–30 / 30–40 / 40+ | R | Filter |
| Travel tolerance | None / up to 10% / 25% / 50% / Any | O | Filter |
| Overnight travel OK | yes/no | O | Filter |
| Work-hours flexibility needs | text | O | Ranking |

### 10. Pay and benefits — EXISTS (EXPAND)
| Field | Type | Req | Used for |
|---|---|---|---|
| Pay type | Hourly / Salary | R | Range display |
| Minimum pay | slider / number | R | Hard filter |
| Target pay | slider / number | O | Ranking, negotiation |
| Show jobs with no posted pay | Yes / No | R | Filter |
| Benefits must have | multi: health, dental, vision, 401k match, PTO, paid sick leave, parental leave, tuition help, remote stipend, childcare help | O | Ranking, must-haves |
| Health insurance needed for dependents | yes/no | O | Ranking |
| Bonus / equity important | yes/no | O | Ranking |
| Salary history | **never asked** (illegal in many states; we tell the user not to share it) | — | — |

### 11. Must-haves and dealbreakers — EXISTS
Two tag editors with suggestions: Must-haves (e.g., 4-day week, no weekends, growth path, union, mission-driven, women-led, fair-chance employer) and Dealbreakers (e.g., commission-only, on-call, night shift, MLM, pay not posted, no benefits, staffing agency). Also toggles: **Hide staffing agencies**, **Hide jobs older than N days** (default 14), **Hide jobs I've applied to** (default on), **Only verified employers** (default on).

### 12. Work authorization and logistics — NEW
| Field | Type | Req | Used for |
|---|---|---|---|
| Authorized to work in US | Yes / No / Need sponsorship now or later | R | Auto-answers, filters sponsorship-only roles |
| Country / visa type | dropdown | O (if sponsorship) | Filter |
| Earliest start date | date / "Immediately" / "2 weeks" / "1 month" | R | Applications |
| Driver's license (state, class, CDL endorsements) | dropdown | O | Driving/trade jobs |
| Willing to pass background check | Yes / Has concerns | O | Filters; concerns route to fair-chance employers, never shared |
| Drug test OK | Yes / No / Prefer not to say | O | Filter |
| Physical requirements OK (lift 25/50 lb, stand long, climb) | multi | O | Trade/warehouse fit |
| Reasonable accommodation needs | text | O, private | Wren advice only, never shared |
| Age 18+ / 21+ eligibility | auto | — | Filter |
| Union member / trade card | text | O | Trade jobs |

### 13. Application answers vault — NEW
One-time answers reused in applications (all editable in Settings):
| Field | Type | Req |
|---|---|---|
| Phone, mailing address | text | R (pre-filled) |
| LinkedIn, portfolio, GitHub | URL | O |
| Preferred pronouns | text | O |
| References (up to 3: name, relationship, employer, phone, email, OK to contact) | repeater | O |
| "Why do you want to work here?" starter | textarea, Wren drafts | O |
| "Tell me about yourself" starter | textarea, Wren drafts | O |
| "Greatest strength / weakness" starters | textarea | O |
| Salary expectation answer | "Negotiable" / number / range | R |
| Referred by an employee? | default No | O |
| Previous employer at target company? | default No | O |
| Cover letter tone | Warm / Direct / Formal / Bold | R |
| Signature name for letters | text | R |
| **Voluntary EEO** (gender, race, veteran, disability), each with "Prefer not to say" | dropdowns | O |
| Consent: "Wren may fill and submit forms only after I approve each one" | checkbox | R |

### 14. Pace, schedule, notifications — EXISTS (EXPAND)
| Field | Type | Req | Used for |
|---|---|---|---|
| Intensity | Light / Steady / All-in (actions per day) | R | Daily plan size |
| Hours per day you can give | 15 min / 30 / 1 hr / 2+ hr | R | Plan size |
| Best time of day | Morning / Afternoon / Evening | R | Reminder time |
| Days off | multi day picker | O | Skips plan |
| Reminder channels | Email / Text / Push | R (1+) | Delivery |
| Phone for text (if chosen) + consent | text, checkbox | conditional | SMS |
| Quiet hours | time range | O | Notifications |
| Daily digest time | time | O | Email |
| Weekly progress report | toggle | O | Email |
| Interview calendar sync | Google / Outlook / None | O | Availability |
| Availability windows for interviews | day/time grid | O | Scheduling |
| Accountability partner email | email | O | Shares weekly summary |

### 15. Review, first matches, plan — EXISTS (Matches step, EXPAND)
Read-only summary cards, each with **Edit** button that jumps back:
Profile, Resume, Direction, Roles, Location and distance, Pay, Must-haves and dealbreakers, Authorization, Pace.
Then: loading state "Finding jobs near you", first 10 real matches with fit reason and distance, **Save**, **Not for me** (asks why, refines filters), **Open** buttons. Then: "Your first week plan" preview.
Final buttons: **Go to my dashboard**, **Download my resume**, **Upgrade** (soft, optional), **Share progress**.
Edge cases: zero matches → suggests widening distance, pay, or titles with one-click buttons; too few verified → says so.

---

## DATA WE COLLECT (field checklist to avoid missing anything)

**Identity:** preferred name, full name, email, phone, city/state, ZIP, address [O], pronouns [O], age 18+ confirm.
**Account:** password/social, terms, referral code, how heard.
**Situation:** situation type, urgency, why changing, layoff date/details, employer-hiding, notice period, gap details, military details.
**Resume:** file/paste/LinkedIn, jobs (title, employer, city, dates, bullets), education, certs/licenses, skills, languages, summary, volunteer, projects, awards.
**Direction:** stay/related/new field, fields of interest, exclusions, gig interest.
**Targets:** titles, seniority, step down/up, employment types, industries, company size, company watch/block lists.
**Location & setup:** home base, relocation, transportation, work style, max distance, commute time, hybrid days, extra places, shifts, hours, travel.
**Pay:** pay type, min, target, unposted-pay toggle, benefits list, dependents, bonus/equity.
**Filters:** must-haves, dealbreakers, hide agencies, job age, applied hidden, verified only.
**Authorization & logistics:** work auth, sponsorship, start date, license, background, drug test, physical, accommodations, union.
**Application vault:** references, standard answers, salary answer, tone, signature, EEO (all optional), approval consent.
**Pace & comms:** intensity, hours/day, best time, days off, channels, SMS consent, quiet hours, digest, weekly report, calendar sync, availability, accountability partner.
**System/analytics (automatic, not asked):** device, timestamp of each step, drop-off screen, source/UTM, consent record.

---

## OPEN QUESTIONS FOR YOU (need your decision before building)

1. Is 15 screens the hard cap, or can conditional screens (5b to 5f, 7) be on top of it?
2. Should account creation come first (screen 1) or after the resume upload, so people see value before signing up? (I recommend after the resume parse: fewer drop-offs.) The app already has a SignupGate component that supports this.
3. Do we ask for phone/SMS at onboarding, or only in Settings later?
4. EEO and background-check questions: keep in onboarding, or move to Settings? (Recommend keep optional, collapsed.)
5. Which screens should be skippable with "Do this later"? Recommended: 12, 13, and the optional parts of 14.
6. Free vs paid: does any screen (e.g., 13 vault, calendar sync) sit behind a plan?

## BUILD ORDER (suggested)

1. Add new profile and prefs fields to `AppStore` and `supabase/schema.sql`.
2. Build screens 12, 13, 14 (new data, self-contained).
3. Expand 2, 5, 8, 9, 10, 11 (extend what exists).
4. Add the conditional branch screens 5b to 5f.
5. Rebuild the stepper for 15 screens with branching logic and Save-and-finish-later.
6. Review screen 15 with Edit jump-links, then match-quality tuning using the new filters.
