import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, BadgeCheck, Check, Flame, Lock, Quote, Receipt, ShieldCheck, Sparkles, X } from "lucide-react";
import { MarketingLayout } from "@/components/layout/MarketingLayout";
import { Button } from "@/components/ui/button";
import { PricingTiers } from "@/components/PricingTiers";
import { CompanyLogo, ScoreRing } from "@/components/common";
import { LegitBadgeView, MethodBadge, Pill, SampleTag, TruthModeBadge } from "@/components/status";
import { demoJobById as jobById, DEMO_JOBS as JOBS } from "@/data/jobs";
import { useDocTitle } from "@/hooks/useDocTitle";
import { useStore } from "@/store/AppStore";

function HeroPreview() {
  const job = jobById("j05")!;
  return (
    <div className="relative mx-auto w-full max-w-[520px]">
      <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-primary/10 via-transparent to-success/10 blur-2xl" aria-hidden />
      {/* Translator card */}
      <div className="card-base p-5 animate-fade-up">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-primary">Career Translator</span>
          <SampleTag />
        </div>
        <div className="rounded-lg border bg-muted/40 p-3 text-sm">
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">You wrote</div>
          <p className="mt-1">Managed 40 rental vehicle locations across three states</p>
        </div>
        <div className="my-2 flex justify-center" aria-hidden>
          <ArrowRight className="h-4 w-4 rotate-90 text-primary" />
        </div>
        <div className="rounded-lg border border-primary/25 bg-primary-soft p-3">
          <div className="text-[11px] font-medium uppercase tracking-wide text-primary">Operations hiring managers read</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {["Multi site operations leadership", "P&L ownership", "Distributed team management"].map((p) => (
              <span key={p} className="rounded-md bg-background px-2 py-1 text-xs font-medium shadow-sm">
                {p}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Job card */}
      <div className="card-base relative z-10 -mt-3 ml-6 p-4 animate-fade-up sm:ml-12" style={{ animationDelay: "120ms" }}>
        <div className="flex gap-3">
          <CompanyLogo company={job.company} size={40} />
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold">{job.title}</div>
            <div className="truncate text-xs text-muted-foreground">
              {job.company.name} · {job.location}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <LegitBadgeView badge={job.legit.badge} score={job.legit.score} size="xs" withTip={false} />
              <Pill size="xs" tone="muted">Posted 3 days ago</Pill>
            </div>
          </div>
          <ScoreRing value={job.match} size={48} sub="match" />
        </div>
      </div>

      {/* Receipt chip */}
      <div className="card-base relative z-20 -mt-2 mr-4 flex items-center gap-3 p-3.5 animate-fade-up sm:-ml-4 sm:mr-16" style={{ animationDelay: "240ms" }}>
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-success-soft text-success">
          <Receipt className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">Receipt saved</div>
          <div className="truncate text-xs text-muted-foreground">Confirmation LB-20931 · resume v2 · 11 fields</div>
        </div>
        <BadgeCheck className="h-5 w-5 text-success" aria-label="Verified" />
      </div>
    </div>
  );
}

function Feature({ id, eyebrow, title, body, points, visual, flip }: { id?: string; eyebrow: string; title: string; body: string; points: string[]; visual: React.ReactNode; flip?: boolean }) {
  return (
    <div id={id} className="grid grid-cols-1 scroll-mt-24 items-center gap-10 py-14 lg:grid-cols-2 lg:gap-16">
      <div className={flip ? "lg:order-2" : ""}>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">{eyebrow}</div>
        <h3 className="font-display text-2xl font-semibold sm:text-3xl text-balance">{title}</h3>
        <p className="mt-3 text-muted-foreground leading-relaxed">{body}</p>
        <ul className="mt-5 space-y-2.5">
          {points.map((p) => (
            <li key={p} className="flex gap-2.5 text-sm">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
              {p}
            </li>
          ))}
        </ul>
      </div>
      <div className={flip ? "lg:order-1" : ""}>{visual}</div>
    </div>
  );
}

function ProofVisual() {
  return (
    <div className="card-base space-y-3 p-5">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">Every application, labeled honestly</div>
        <SampleTag />
      </div>
      {[
        { t: "Fulfillment Operations Manager", c: "Lumen & Birch", m: "submitted" as const },
        { t: "DC Operations Supervisor", c: "Oakmere Distribution", m: "prefilled" as const },
        { t: "Procurement Specialist", c: "Copperline Manufacturing", m: "manual" as const },
      ].map((r) => (
        <div key={r.t} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{r.t}</div>
            <div className="text-xs text-muted-foreground">{r.c}</div>
          </div>
          <MethodBadge method={r.m} size="xs" />
        </div>
      ))}
      <div className="flex items-center justify-between rounded-lg bg-success-soft px-3 py-2.5 text-sm">
        <span className="font-medium text-success">Proof Score</span>
        <span className="num font-semibold text-success">83% verified</span>
      </div>
    </div>
  );
}

function TruthVisual() {
  return (
    <div className="card-base p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="text-sm font-semibold">Side by side, line by line</div>
        <TruthModeBadge />
      </div>
      <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
        <div className="rounded-lg border p-3">
          <div className="mb-1 font-medium text-muted-foreground">Your resume</div>
          <p className="diff-del rounded px-2 py-1.5">Oversaw day to day operations for 6 stores ... $38M.</p>
        </div>
        <div className="rounded-lg border p-3">
          <div className="mb-1 font-medium text-muted-foreground">Tailored</div>
          <p className="diff-add rounded px-2 py-1.5">Led day to day operations for 6 sites ... $38M.</p>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Changed "stores" to "sites" so screening software reads it as multi site operations. Same facts, same numbers.</p>
      <div className="mt-3 flex gap-2">
        <span className="inline-flex items-center gap-1 rounded-md bg-success px-2.5 py-1 text-xs font-medium text-white dark:text-[hsl(224_40%_8%)]"><Check className="h-3 w-3" /> Accept</span>
        <span className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium"><X className="h-3 w-3" /> Reject</span>
      </div>
      <div className="mt-4 rounded-lg border border-warning-border bg-warning-soft p-3 text-xs">
        <div className="font-semibold text-warning">Gaps we did not fill</div>
        <p className="mt-1 text-foreground/80">Warehouse management system experience. Not in your resume, so we did not add it. Likely trainable.</p>
      </div>
    </div>
  );
}

function ShieldVisual() {
  const picks = ["j03", "j04", "j10", "j07"].map((id) => jobById(id)!);
  return (
    <div className="card-base space-y-2.5 p-5">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">Legitimacy score on every listing</div>
        <SampleTag />
      </div>
      {picks.map((j) => (
        <div key={j.id} className="flex items-center gap-3 rounded-lg border p-3">
          <CompanyLogo company={j.company} size={32} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{j.title}</div>
            <div className="truncate text-xs text-muted-foreground">{j.company.name}</div>
          </div>
          <LegitBadgeView badge={j.legit.badge} score={j.legit.score} size="xs" withTip={false} />
        </div>
      ))}
      <p className="pt-1 text-xs text-muted-foreground">Signals: days since posted, reposts, company careers page, agency or employer, salary range, applicant trend.</p>
    </div>
  );
}

function MomentumVisual() {
  return (
    <div className="card-base p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-semibold">Today's Plan</div>
        <span className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2.5 py-1 text-xs font-semibold text-warning">
          <Flame className="h-3.5 w-3.5" /> 9 day streak
        </span>
      </div>
      {[
        { t: "Review 3 new matches from overnight", d: true },
        { t: "Tailor your resume for the Ops Manager role at Northvale. 91 percent match, closes Friday.", d: false },
        { t: "Send a note to Marcus Reyes. He worked at your old company and is now at Cedarline.", d: false },
      ].map((i) => (
        <div key={i.t} className="flex gap-3 border-b py-2.5 last:border-0">
          <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${i.d ? "border-success bg-success text-white" : "border-muted-foreground/40"}`}>
            {i.d && <Check className="h-3 w-3" strokeWidth={3} />}
          </span>
          <span className={`text-sm ${i.d ? "text-muted-foreground line-through" : ""}`}>{i.t}</span>
        </div>
      ))}
      <p className="mt-3 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">Missed a few days? "You took a couple days. Normal. Here is today's smallest win."</p>
    </div>
  );
}

const TESTIMONIALS = [
  { quote: "I spent eleven years managing hotels. The translator showed me I had been doing operations work the whole time. I had the words, I just did not know it.", name: "Hotel general manager to operations manager", tag: "Sample testimonial" },
  { quote: "After my layoff I applied to 60 jobs and heard nothing. The ghost scores explained a lot. Half of what I had applied to was not real.", name: "Laid off program manager, 7 months searching", tag: "Sample testimonial" },
  { quote: "The receipts are the thing. I know exactly which resume went where, and I can prove it when a recruiter says they never got it.", name: "Former teacher moving into customer success", tag: "Sample testimonial" },
];

export default function Landing() {
  useDocTitle("");
  const nav = useNavigate();
  const { update } = useStore();
  const ghostCount = JOBS.filter((j) => j.legit.badge === "ghost").length;

  const startPro = () => nav("/signup?plan=pro");

  return (
    <MarketingLayout>
      {/* Hero */}
      <section className="relative overflow-hidden border-b">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--primary)/0.08),transparent_55%)]" aria-hidden />
        <div className="container grid grid-cols-1 items-center gap-12 py-14 sm:py-20 lg:grid-cols-[1.1fr_1fr] lg:py-24">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden />
              For career changers and people restarting after a layoff
            </div>
            <h1 className="font-display text-4xl font-semibold leading-[1.08] sm:text-5xl lg:text-[3.5rem] text-balance">
              Your experience counts. We will show you where.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
              CareerQuest translates what you have already done into the language of the job you want. It tells you which listings are real. And it keeps a receipt for every application you send.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" asChild>
                <Link to="/signup">
                  Start free <ArrowRight />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => {
                  update((s) => {
                    s.mode = "demo";
                    s.authed = true;
                    s.onboarded = true;
                  });
                  nav("/app");
                }}
              >
                Explore the demo account
              </Button>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">Free forever plan. Pro is $24 a month, or $180 a year. No card needed to start.</p>
          </div>
          <HeroPreview />
        </div>
      </section>

      {/* Two questions */}
      <section className="border-b bg-canvas">
        <div className="container py-14">
          <p className="mx-auto max-w-2xl text-center text-sm font-medium text-muted-foreground">Everything in CareerQuest answers one of two questions.</p>
          <div className="mx-auto mt-6 grid grid-cols-1 max-w-4xl gap-4 md:grid-cols-2">
            {[
              { q: "Does my experience actually count here?", a: "Career Translator, Truth Mode tailoring, and a Transferable Fit score on every match." },
              { q: "Did that application go anywhere?", a: "A receipt for every application, honest status labels, and a Proof Score you can check." },
            ].map((x) => (
              <div key={x.q} className="card-base p-6">
                <div className="font-display text-xl font-semibold">"{x.q}"</div>
                <p className="mt-2 text-sm text-muted-foreground">{x.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Career Translator band */}
      <section className="border-b">
        <div className="container py-16">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">Career Translator</div>
            <h2 className="font-display text-3xl font-semibold sm:text-4xl text-balance">You have done this work. It just had a different name.</h2>
            <p className="mt-3 text-muted-foreground">Pick your past role and the role you want. CareerQuest maps each thing you did to the words that field uses, so you can see the overlap and so can a recruiter.</p>
          </div>
          <div className="mx-auto mt-10 grid max-w-4xl gap-3">
            {[
              { from: "Managed weekly inventory counts and replenishment orders for 6 locations", to: ["Inventory planning and replenishment", "Stockout reduction (22%)"] },
              { from: "Worked with 14 vendors on delivery schedules and damaged goods claims", to: ["Vendor and supplier management", "Claims recovery ($210K)"] },
              { from: "Coordinated seasonal floor sets and a full store remodel", to: ["Project delivery on fixed timelines", "Launch readiness"] },
            ].map((r) => (
              <div key={r.from} className="grid grid-cols-1 items-center gap-3 rounded-xl border bg-card p-4 shadow-card md:grid-cols-[1fr_auto_1fr]">
                <p className="text-sm">{r.from}</p>
                <ArrowRight className="mx-auto h-4 w-4 rotate-90 text-primary md:rotate-0" aria-hidden />
                <div className="flex flex-wrap gap-1.5">
                  {r.to.map((t) => (
                    <span key={t} className="rounded-md bg-primary-soft px-2 py-1 text-xs font-medium text-primary">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            ))}
            <p className="text-center text-xs text-muted-foreground">Sample from a retail operations manager moving into supply chain.</p>
          </div>
        </div>
      </section>

      {/* Four differentiators */}
      <section id="features" className="scroll-mt-16">
        <div className="container py-10">
          <div className="mx-auto max-w-2xl pt-8 text-center">
            <h2 className="font-display text-3xl font-semibold sm:text-4xl text-balance">Four things we do differently</h2>
            <p className="mt-3 text-muted-foreground">These are features you can click, not marketing claims.</p>
          </div>
          <div className="divide-y">
            <Feature
              eyebrow="1. Proof of Application"
              title="A receipt for every application. No mystery auto-apply."
              body="Every application gets its own receipt: the exact resume and cover letter sent, every form answer, where it went, when, and what happened next. If we could not submit it, we say so and tell you why."
              points={["Three honest labels: Submitted by CareerQuest, Prefilled and you submitted, or Manual required", "Full event timeline, from submitted to viewed to a decision", "A Proof Score that shows what share of your applications have a verified confirmation"]}
              visual={<ProofVisual />}
            />
            <Feature
              flip
              eyebrow="2. Truth Mode tailoring"
              title="Your resume, rearranged for the job. Never invented."
              body="The tailor can only reorder, reword, re-emphasize, and reformat what is already in your resume. You see every change side by side with a reason, and nothing goes in until you accept it."
              points={["Truth Mode is always on and cannot be turned off", "Requirements you do not meet go in a separate Gaps panel, with an honest way to address each one", "Live ATS compatibility score with an itemized breakdown"]}
              visual={<TruthVisual />}
            />
            <Feature
              id="shield"
              eyebrow="3. Real listings only"
              title="Know which jobs are real before you spend an evening on them."
              body={`Before a listing reaches you we look for it on the employer's own careers page and check how long it has been circulating. In our sample feed, ${ghostCount} of ${JOBS.length} listings do not survive that check and are left out.`}
              points={["Verified Live means we found it on the company's own careers page in the last 24 hours", "Every listing carries a plain label, and the signals behind it are on the page", "A Verify on company site button on every listing"]}
              visual={<ShieldVisual />}
            />
            <Feature
              flip
              eyebrow="4. Momentum"
              title="Small daily actions, not a wall of listings."
              body="Each morning you get three to five specific actions sized to your search. A streak that never shames you. A Sunday check in that tells you honestly how you are doing against people like you."
              points={["Today's Plan, tied to real deadlines and real people", "Weekly Check In with a realistic benchmark for your field", "A Skill Gap Roadmap built from the jobs you actually saved"]}
              visual={<MomentumVisual />}
            />
          </div>
        </div>
      </section>

      {/* Who it is for */}
      <section id="who" className="scroll-mt-16 border-y bg-canvas">
        <div className="container py-16">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-semibold sm:text-4xl">Who this is for</h2>
            <p className="mt-3 text-muted-foreground">People with real work history who need it to count somewhere new.</p>
          </div>
          <div className="mx-auto mt-10 grid grid-cols-1 max-w-4xl gap-5 md:grid-cols-2">
            <div className="card-base p-6">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary-soft text-primary">
                <Sparkles className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold">Career changers</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                You managed stores, taught classrooms, ran restaurants, or served in the military. You want operations, supply chain, program management, customer success, or healthcare administration. Your experience fits. It just does not look like it fits yet.
              </p>
            </div>
            <div className="card-base p-6">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-success-soft text-success">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold">Recently laid off professionals</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Your role was cut and you are restarting. You need to move with some urgency without wasting time on fake listings, and you need to know that what you send actually arrives.
              </p>
            </div>
          </div>
          <p className="mx-auto mt-6 max-w-2xl text-center text-sm text-muted-foreground">
            If you are a new grad looking for a first internship, other tools will serve you better. That is fine. We built this for people 28 to 50 with a history to translate.
          </p>
        </div>
      </section>

      {/* Testimonials */}
      <section>
        <div className="container py-16">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <h2 className="font-display text-3xl font-semibold">What it can feel like</h2>
            <p className="mt-2 text-sm text-muted-foreground">These are sample testimonials written for this prototype. They are not from real customers.</p>
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {TESTIMONIALS.map((t) => (
              <figure key={t.name} className="card-base flex flex-col p-6">
                <div className="mb-4 flex items-center justify-between">
                  <Quote className="h-5 w-5 text-primary/50" aria-hidden />
                  <SampleTag>{t.tag}</SampleTag>
                </div>
                <blockquote className="flex-1 text-[15px] leading-relaxed">{t.quote}</blockquote>
                <figcaption className="mt-4 border-t pt-3 text-sm text-muted-foreground">{t.name}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="scroll-mt-16 border-t bg-canvas">
        <div className="container py-16">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <h2 className="font-display text-3xl font-semibold sm:text-4xl">Simple pricing, all of it visible</h2>
            <p className="mt-3 text-muted-foreground">One price, everything included. We do not sell the interview questions separately.</p>
          </div>
          <PricingTiers onFree={() => nav("/signup")} onPro={startPro} />
          <p className="mt-8 text-center text-sm text-muted-foreground">
            Cancel in one click, no phone call, no email.{" "}
            <Link to="/pricing" className="font-medium text-primary hover:underline">
              See full pricing and refund policy
            </Link>
          </p>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t">
        <div className="container py-16 text-center">
          <h2 className="mx-auto max-w-2xl font-display text-3xl font-semibold text-balance">Start with your resume. See what it already qualifies you for.</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">Setup takes about five minutes. You will see your first matches, with honest scores, before you finish your coffee.</p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <Link to="/signup">
                Create a free account <ArrowRight />
              </Link>
            </Button>
            <Button size="lg" variant="ghost" asChild>
              <Link to="/login">
                <Lock /> I already have an account
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
