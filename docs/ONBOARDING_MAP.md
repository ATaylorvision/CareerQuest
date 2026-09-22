# Resumati Onboarding: Design & Map (v3)

> This doc uses **Resumati** as the working name for the app. Nothing in the live code has been renamed yet — say the word and it's a small, mechanical change (copy, page titles, emails, README). Until then the running app is still called CareerQuest.

This is built from two rounds of onboarding research that sound like they disagree and don't:

- **Round one:** don't waste a single screen. A field only belongs in onboarding if skipping it visibly hurts the next thing the user sees. Most of what a first draft wants to ask belongs in Settings or at the moment it's actually needed, not on day one.
- **Round two:** length itself doesn't predict success. The average successful app has around 25 onboarding screens; some of the best-performing ones (Duolingo, around 60) don't feel long at all, because every screen shows something personal, real, or delightful before it asks for the next thing. Some of the shortest, best flows are AI products that ask almost nothing up front and let the product learn from behavior instead.

Combined, the rule is: **cut anything that doesn't earn its place, and on everything that survives, make it feel like it's working for the user, not the other way around.** A screen that shows a real, personalized payoff immediately earns its place even if "round one" alone might have cut it as optional. A screen that's just a form asking for data nobody will see the benefit of yet does not, no matter how short it is.

---

## 1. Three kinds of onboarding, and which Resumati uses

| Kind | What it is | Does Resumati use it? |
|---|---|---|
| **Welcome / read-only screens** | Swipeable slides pitching the app before anything happens | **No.** The first screen is the resume upload — already doing the thing, not being pitched at. This matches the apps that let people try the core experience before signing up, which is rare specifically among AI products and stands out when done. |
| **Information-gathering screens** | Screens that collect what the app needs to actually work, or that make the next screen more personal | **Yes.** The 6-step flow below. Every field has to either be load-bearing for the resume/matches, or immediately show what it unlocked. |
| **Tutorial-style walkthrough** | Speech bubbles pointing at features, click-through required | **No, not as a gate.** Replaced by on-demand tips plus a persistent first-week checklist (Section 5) — teaching in context, not up front. |

---

## 2. Governing rules

1. **No mandatory account until the user has gotten something real.** Guest onboarding through Supabase anonymous sign-in, real matches and a tailored resume shown before any account exists, sign-up only at Download. This is exactly what the strongest AI-product and "try before you sign up" examples do, and it's already correct — protect it.
2. **A field earns its place one of two ways: it visibly changes the very next thing the user sees, or it makes something later demonstrably more personal and shows that payoff immediately.** "It might be useful data" is not enough on its own. But "picking your career direction changes the actual sentences on your resume, and you see it happen on the very next screen" is enough, even though it's "just" a preference question.
3. **Never force a single choice where a real person plausibly has more than one true answer.** Headspace let users pick more than one goal instead of forcing one, and saw a 10% lift in conversion because it matched how people actually think about their situation. Resumati's situation picker and career-direction picker should allow more than one selection where that's genuinely true (someone can be both "recently laid off" and "a career changer" at the same time).
4. **Every question with no obviously right answer for a first-time user gets a "not sure yet" path with a sensible default.** Salary range and Pace, specifically (Section 4).
5. **Show the personalized payoff of an answer immediately, not just at the end.** The Translator step already does this well — three real lines from the user's own resume, rewritten live, before the flow is even done. That pattern should repeat wherever it can: right after the resume is parsed, right after location is confirmed, right after targets are set.
6. **Teach in context, never up front.** No walkthrough. A tip appears exactly once, exactly when a feature is first touched, plus one persistent checklist for the first week that replaces a tour entirely (Section 5).
7. **Ask for a permission with a one-line reason immediately before the system prompt, never cold.** Applies today to the browser's own location permission inside "Use my location," and to any future notification or email opt-in.
8. **Nothing is ever lost.** Autosave on every field, guest account is a real row from screen one, returning users resume exactly where they left off.
9. **Copy sells the outcome, never lists the feature.** Not "3 templates" — "pick the one that gets you read." Not "AI-scored matches" — "here's exactly why this job fits you."
10. **A soft, dismissible monetization moment is fine right after the first real payoff — never before it, and never blocking.** Grammarly's personalized plan recommendation after a quiz lifted upgrades by ~20%; the lesson isn't "add a paywall," it's "the ask lands better right after value than at any other point."
11. **Track the numbers.** Section 7 defines what "working" means so future changes get judged by data.

---

## 3. The decision tree (current, minimal)

```
Guest session starts silently (Supabase anonymous sign-in) — no form, no screen
 │
 ├─ 1  Resume        (upload/paste → personalized "here's what we found" moment → contact + confirm
 │                     location + work history + skills + education + certs)
 ├─ 2  Career         (situation, multi-select + where you're headed, multi-select + free text)
 ├─ 3  Translator     (3 real lines rewritten live + pick 1 of 3 templates + preview/edit, no download)
 ├─ 4  Targets        (roles, work style, distance, salary range, must-haves, dealbreakers)
 ├─ 5  Pace           (one choice: Casual / Active / Urgent, defaults if skipped)
 └─ 6  Matches        (live scored search, 80%+ shown, pick a job → tailor it)
       │
       └─ First resume (Studio, pre-tailored)
             └─ Download → sign-up gate (name, email, password) → account converts in place
                   → download fires → email copy sent → soft plan tease (dismissible) → first-week checklist appears
```

Still six required screens plus one soft gate. Length was never the target either direction — the six screens stay because each one is load-bearing or shows a personalized payoff live; nothing gets added just to look thorough, and nothing gets cut just to look short.

---

## 4. Screen-by-screen

Tags: **[R]** required · **[O]** optional, skippable in place · **[D]** has a "not sure / decide later" default · **[A]** auto-filled from the resume, user confirms · **[P]** shows a personalized payoff immediately, not just collects data.

### Step 1 — Resume
| Field | Type | Tag | Why it's here |
|---|---|---|---|
| Upload file, paste text, or "I don't have one yet" | file / textarea / button | R | Nothing else can happen without a resume |
| **"Here's what we found" summary** (roles read, years of experience, skills found, one line of proof it actually read the resume) | display, appears the instant parsing finishes | **P** | This is the Endel/BitePal move: show what the very first answer already unlocked, before asking for anything else. Costs nothing extra to build — the data already exists the moment parsing finishes, it just isn't shown as its own moment yet. |
| Name, Email, Phone | text, auto-filled | A | Contact line on the resume |
| Where do you live? | place picker, must confirm an exact match | R | Every distance shown anywhere depends on this |
| "Use my location" | button triggering the browser's own permission prompt | O | **Add a one-line prime directly above the button** ("We only use this once, to find your city — nothing is tracked") before the OS permission dialog fires, not after |
| Work history, skills, education, certifications | repeatable cards / tag lists / lines | A, edit freely | The actual content being tailored |
| Summary | — | not asked | Written by the AI after Step 1, from everything above |

### Step 2 — Career
| Field | Type | Tag | Notes |
|---|---|---|---|
| Your situation | **multi-select** cards (Career changer / Recently laid off / Employed and looking / Returning to work) | R (1+) | Changed from single-select: a person can be laid off *and* a career changer at once, and forcing one hides half of who they are from the very tone Wren writes in |
| I am coming from | free text | O | |
| I want to move into | **multi-select** of the 5 fields, plus "something else" free text, plus idea chips | R (1+) | Same logic as situation — most career changers are genuinely weighing more than one direction at this stage, not one |
| Which of these is closest to it? (only for free-text entries) | dropdown | R when shown | |

### Step 3 — Translator
| Field | Type | Tag |
|---|---|---|
| 3 rewritten lines, live, in the user's own words vs. the new field's language | display | **P** |
| Template (Signature / Classic / Minimal) | picker | R |
| Preview / Edit toggle | toggle | O |

This step is the model for the rest of the flow: it shows the payoff of Steps 1 and 2 immediately, in the user's own words, before asking for anything more. No download here — the payoff is visible, the value isn't yet portable, which is exactly the gap the sign-up gate later closes.

### Step 4 — Targets
| Field | Type | Tag |
|---|---|---|
| Target roles | tag editor, pre-filled | R (1+) |
| How do you want to work? | radio | R |
| Home base | place picker, editable | A |
| Max distance | slider | R (unless Remote only) |
| Anywhere else you would work | tag editor | O |
| Salary range | two-handle slider | **D** — defaults to the pay floor implied by the resume's most recent role, labeled "You can change this any time" |
| Must haves / Dealbreakers | tag editors with suggestions | O |

### Step 5 — Pace
| Field | Type | Tag |
|---|---|---|
| Casual / Active / Urgent | 3 cards | **D** — defaults to Active if skipped |

### Step 6 — Matches
Read-only until a job is picked. The payoff screen for the entire flow: 80%+ shown, honest fallback (best 3, real scores) when nothing clears 80.

### After Step 6 — sign-up gate, then two soft moments
| Moment | What happens | Tag |
|---|---|---|
| Sign-up gate | Name, email, password — the one mandatory-account moment, kept exactly here | R |
| Soft plan tease | One dismissible card, right after the download fires: "You have 2 of 3 free tailored resumes left." No blocking, no repeat. | O |
| First-week checklist | Appears on the dashboard, replaces a tour entirely (Section 5) | O |

**On splitting the sign-up gate:** one study found splitting a signup form across two screens (email first, then password) lifted conversion 15% — friction in one place can lower it somewhere else. Worth an A/B test later; not assumed correct without data, since it can just as easily go the other way for a form this short.

---

## 5. Teaching in context, not up front

No walkthrough screen, no speech-bubble tour. Two mechanisms instead, and they do different jobs:

**One-time tips**, dismissed forever once seen, appearing the first time each moment actually happens:

| Moment | Tip |
|---|---|
| First hover over a resume line in Studio | "Point at any line to see Wren's suggestion." |
| First time opening Studio for a tailored resume | "Auto adjust fits your resume to one page for you." |
| First time on the Matches board (not the ranked matches) | "This is every job we've found near you — open one and tell us if it fits, and your matches get sharper." |
| First unscored job card | "We haven't scored this one yet — Check my fit takes a few seconds." |
| First time on the Skill Gap Roadmap | "Already have something on this list? Tell us — it counts toward jobs that ask for it." |

**A persistent first-week checklist** on the dashboard, replacing a tour the way Mural replaced pop-ups with a checklist and saw a 10% lift in one-week retention. Unlike a tip, it stays visible and dismissible-but-returnable until each item is done:

- [ ] Confirm your location *(already done by the time this shows, checked automatically)*
- [ ] Save or check fit on 3 jobs
- [ ] Try the Skill Gap Roadmap
- [ ] Look at the full job board, not just your matches
- [ ] Set your pace in Settings if Active doesn't fit
- [ ] Come back tomorrow to see new matches

Six items, all real actions the product already supports, nothing invented for the checklist's sake.

---

## 6. A human touch, optionally

Some of the onboarding flows that stick tie a real moment to a real person: a founder's note at account creation, a CEO video the first time someone lists a space, a handwritten signature on a welcome screen. It works because it makes the product feel like it was built with intention, not assembled.

This is a genuine option for Resumati, not a requirement — it only works if it's true. If there's a real, short story behind why this app exists, one plain note at one moment (most likely right after the first tailored resume downloads, or at account creation) could do more than any UI polish. Worth deciding deliberately rather than defaulting to generic congratulations copy. This is your call on tone and whether to put a name to it — flag it if you want a draft.

---

## 7. What to measure

**Key action:** the first tailored resume is downloaded, or the first real, scored match is opened. Everything before that is onboarding; everything after is retention.

Track, per user:
- Time from guest session start to key action. If more than half of guests haven't hit it within 24 hours, onboarding is the problem, not the product.
- Which step they were on when they last touched the app, for anyone who doesn't return within 24 hours — the drop-off screen, and the next thing to fix.
- Sign-up gate conversion: guests who reach Download versus guests who complete the account.
- Whether the Pace default (Active) and Salary default get changed by users who don't skip them — tells us if the default matches the common case or is just what people didn't bother to touch.
- Whether allowing multi-select on situation and career direction actually gets used by more than one selection, and whether it changes match quality for those users.
- First-week checklist completion rate per item, since an item nobody finishes is a sign it doesn't belong on the list.

None of this requires new screens — it's event logging on the flow that already exists.

---

## 8. Where the old, longer draft's extra questions actually live

None of that data was wrong to want. It just doesn't belong as a mandatory day-one screen. Each item moves to one of three places:

| Field | Now lives in | When it's actually asked |
|---|---|---|
| Layoff details, severance, "reason for leaving" wording | Settings, optional; or right when Wren drafts a cover letter that needs it | Only if relevant to the letter being written |
| Employer-hiding (confidential search) | Settings toggle | Anytime, off by default |
| Returning-to-work gap narrative | Inline on the resume itself | When a gap over 6 months shows up, ask right there |
| Military/veteran translator | A button in Studio ("Translate military experience") | On request |
| Work authorization, background check, drug test, physical requirements | Just-in-time | Only the first time a specific posting actually asks |
| Standard application-answer vault, references, EEO | Settings, entirely optional | Built out gradually, never a gate |
| Notification channels, quiet hours, calendar sync | Settings | Preferences, not requirements |
| "How did you hear about us," referral code | Cut | Doesn't change this user's resume or matches at all |

---

## 9. Build order

1. Add the "here's what we found" personalized moment right after resume parsing (Step 1) — the data already exists, this is a display, not new collection.
2. Change situation and career-direction to multi-select.
3. Prime the location permission with a one-line reason before the browser prompt fires.
4. Ship the Salary and Pace decide-later defaults with visible "Not sure yet" affordance.
5. Build the six one-time tips and the six-item first-week checklist (Section 5).
6. Add the soft, dismissible plan tease right after the first download — never before, never blocking.
7. Add the event logging in Section 7.
8. Decide on, then (if yes) draft, the human-touch moment in Section 6.
9. A/B test splitting the sign-up gate into two screens once there's enough signal to read it.
10. Everything in Section 8 gets built opportunistically, never as a gate.

**Still not doing:** a mandatory upfront tutorial, a paywall before the first real value is shown, or any field that doesn't either change the next screen or make a later one visibly more personal.
