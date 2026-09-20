import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  Building2,
  CheckCircle2,
  CircleDashed,
  ExternalLink,
  FileText,
  Languages,
  Loader2,
  MapPin,
  PenLine,
  Send,
  ShieldCheck,
  Star,
  Users,
  Wallet,
  XCircle,
  MinusCircle,
  PlusCircle,
  Map as MapIcon,
} from "lucide-react";
import { Card, CompanyLogo, PageHeader, PersonAvatar, ScoreBar, ScoreRing, SectionTitle, EmptyState } from "@/components/common";
import { LegitBadgeView, MethodBadge, Pill, TONE_CLASS } from "@/components/status";
import { Button } from "@/components/ui/button";
import { ApplyFlow } from "@/components/ApplyFlow";
import { useSaveJob } from "@/components/JobCard";
import { TranslatorForBullets, topBulletsFor } from "@/components/TranslatorRows";
import { jobById, LEGIT_META, MATCH_WEIGHTS, salaryMarket, salaryText, type Job } from "@/data/jobs";
import { SEVERITY_LABEL } from "@/data/gaps";
import { STORY_LINES, TARGET_FIELDS } from "@/data/translator";
import { COLUMNS } from "@/data/applications";
import { useStore } from "@/store/AppStore";
import { relDays } from "@/lib/date";
import { useDocTitle } from "@/hooks/useDocTitle";
import { api } from "@/live/api";
import { patchJob } from "@/data/jobs";
import { LiveAboutCard, LiveCompanyCard, LiveGapsCard, LiveTranslatorCard, useEnrich } from "./JobDetailLive";

// Results of "Verify on company site" survive the page refresh that follows an update.
const verifyResults = new Map<string, { tone: "success" | "danger" | "warning" | "info"; text: string }>();
import { cn } from "@/lib/utils";

const GAP_PATTERNS: Record<string, RegExp> = {
  wms: /warehouse management|\bwms\b/i,
  dc: /distribution center/i,
  sql: /\bsql\b/i,
  bi: /power bi|tableau|bi tool/i,
  apics: /apics|cpim|cscp/i,
  pmp: /\bpmp\b|\bcapm\b/i,
  salesforce: /salesforce|\bcrm\b/i,
  ehr: /\behr\b|healthcare background|healthcare or ehr/i,
  saas: /saas|software/i,
  forecast: /forecasting models|statistical/i,
  tms: /\btms\b|transportation management/i,
  revcycle: /billing|revenue cycle/i,
  pmtools: /smartsheet|asana|jira|project tool/i,
};

function reqStatus(req: string, job: Job): { status: "met" | "partial" | "gap"; note?: string } {
  const g = job.gaps.find((x) => GAP_PATTERNS[x.id]?.test(req));
  if (g) return { status: g.severity === "preferred" ? "partial" : "gap", note: SEVERITY_LABEL[g.severity] };
  if (/forecast/i.test(req)) return { status: "partial", note: "You have replenishment planning. Forecasting is a stretch." };
  if (/grocery|food|perishables/i.test(req)) return { status: "partial", note: "Adjacent. You ran home goods, not food." };
  return { status: "met" };
}

function Breakdown({ job }: { job: Job }) {
  const rows = [
    { k: "experience", label: "Experience", help: "Years and level of responsibility compared to what they ask for.", w: MATCH_WEIGHTS.experience },
    { k: "skills", label: "Skills", help: "Skills in your resume that appear in the posting.", w: MATCH_WEIGHTS.skills },
    { k: "industry", label: "Industry", help: "How close your past industry is to theirs. Weighted lightly on purpose.", w: MATCH_WEIGHTS.industry },
    { k: "transferable", label: "Transferable Fit", help: "How well what you have done maps to this role, even under a different title.", w: MATCH_WEIGHTS.transferable, ours: true },
  ] as { k: keyof Job["breakdown"]; label: string; help: string; w: number; ours?: boolean }[];
  return (
    <Card>
      <SectionTitle sub="How we got to the overall match. Industry counts for only 10 percent, because what you did matters more than where.">Match score, broken down</SectionTitle>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <div className="flex flex-col items-center">
          <ScoreRing value={job.match} size={104} stroke={8} sub="overall" label="Overall match" />
        </div>
        <div className="flex-1 space-y-4">
          {rows.map((r) => {
            const v = job.breakdown[r.k];
            return (
              <div key={r.k} className={cn(r.ours && "-mx-3 rounded-lg bg-primary-soft/60 px-3 py-2.5")}>
                <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-2 font-medium">
                    {r.label}
                    {r.ours && <span className="rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">CareerQuest</span>}
                  </span>
                  <span className="text-muted-foreground">
                    <span className="num font-semibold text-foreground">{v}</span> · weight {Math.round(r.w * 100)}%
                  </span>
                </div>
                <ScoreBar value={v} label={`${r.label} score`} />
                <p className="mt-1 text-xs text-muted-foreground">{r.help}</p>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

function WhyThisScore({ job }: { job: Job }) {
  const [check, setCheck] = useState<"idle" | "checking" | "done">(verifyResults.has(job.id) ? "done" : "idle");
  const [liveResult, setLiveResult] = useState(verifyResults.get(job.id) ?? null);
  const runVerify = async () => {
    setCheck("checking");
    if (!job.live) {
      setTimeout(() => setCheck("done"), 1600);
      return;
    }
    try {
      const r = await api<{ status: string; message: string; legit: Job["legit"]; signals: Job["signals"]; applyUrl?: string; description?: string }>("jobs/verify", { jobId: job.id });
      const res = { tone: (r.status === "confirmed" ? "success" : r.status === "missing" ? "danger" : "info") as "success" | "danger" | "info", text: r.message };
      verifyResults.set(job.id, res);
      setLiveResult(res);
      setCheck("done");
      patchJob({ ...job, legit: r.legit, signals: r.signals, applyUrl: r.applyUrl ?? job.applyUrl, descriptionText: r.description ?? job.descriptionText, checkedAt: new Date().toISOString() });
    } catch (e) {
      const res = { tone: "warning" as const, text: (e as Error).message };
      setLiveResult(res);
      setCheck("done");
    }
  };
  const meta = LEGIT_META[job.legit.badge];
  const result =
    job.signals.companySite === "confirmed"
      ? { tone: "success" as const, text: `Found on the ${job.company.name} careers page just now. Same title, same location, still accepting applications.` }
      : job.signals.companySite === "missing"
        ? { tone: "danger" as const, text: `No matching role on the ${job.company.isAgency ? "agency's site or any named client" : `${job.company.name} careers page`}. We would not apply here.` }
        : job.company.isAgency
          ? { tone: "warning" as const, text: "The agency does not name its client, so there is no company page to check against. Treat with caution." }
          : { tone: "info" as const, text: `We found a similar role on the ${job.company.name} careers page posted around the same time. It is likely the same opening. We will mark it Verified at the next scheduled check.` };
  return (
    <Card>
      <SectionTitle icon={ShieldCheck} sub="Every signal we used, and how much it moved the score.">Why this score</SectionTitle>
      <div className="mb-4 flex items-center gap-4">
        <ScoreRing value={job.legit.score} size={68} tone={meta.tone === "info" ? "primary" : meta.tone} label="Legitimacy score" />
        <div>
          <LegitBadgeView badge={job.legit.badge} />
          <p className="mt-1.5 text-xs text-muted-foreground">{meta.help}</p>
        </div>
      </div>
      <ul className="divide-y text-sm">
        {job.legit.factors.map((f) => (
          <li key={f.label} className="py-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                {f.tone === "good" ? <CheckCircle2 className="h-4 w-4 text-success" aria-label="Good signal" /> : f.tone === "bad" ? <XCircle className="h-4 w-4 text-danger" aria-label="Risk signal" /> : f.tone === "warn" ? <AlertTriangle className="h-4 w-4 text-warning" aria-label="Caution signal" /> : <MinusCircle className="h-4 w-4 text-muted-foreground" aria-label="Neutral signal" />}
                <span className="font-medium">{f.label}</span>
              </span>
              <span className={cn("num shrink-0 text-xs font-semibold", f.impact < 0 ? "text-danger" : "text-success")}>{f.impact === 0 ? "+0" : f.impact}</span>
            </div>
            <div className="ml-6 mt-0.5 text-foreground/80">{f.value}</div>
            <div className="ml-6 text-xs text-muted-foreground">{f.note}</div>
          </li>
        ))}
      </ul>
      <div className="mt-3 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">Scores start at 100. Each risk signal subtracts points. The badge follows fixed rules, not a black box.</div>
      <Button variant="outline" className="mt-4 w-full" onClick={() => void runVerify()} disabled={check === "checking"}>
        {check === "checking" ? <Loader2 className="animate-spin" /> : <ExternalLink />}
        {check === "checking" ? `Checking ${job.company.name}` : "Verify on company site"}
      </Button>
      {check === "done" && (
        <div className={cn("mt-3 rounded-lg border p-3 text-sm animate-fade-up", TONE_CLASS[(job.live ? liveResult : result)?.tone ?? "info"])} role="status">
          <span className="font-semibold">Checked just now. </span>
          {(job.live ? liveResult : result)?.text}
        </div>
      )}
    </Card>
  );
}

function SalaryCard({ job }: { job: Job }) {
  const { state } = useStore();
  if (job.live) {
    const floor = state.prefs.salaryFloor;
    return (
      <Card>
        <SectionTitle icon={Wallet}>Salary</SectionTitle>
        <div className="mb-1 text-2xl font-semibold num">{salaryText(job.salary)}</div>
        <div className="text-xs text-muted-foreground">{job.salary ? "Range posted by the employer" : "This employer did not post a range. Real roles increasingly do, so treat that as a small caution."}</div>
        {job.salary && job.salary[1] < floor && <p className="mt-3 text-xs text-warning">The top of this range is below your ${floor.toLocaleString()} floor.</p>}
        {job.salary && job.salary[1] >= floor && <p className="mt-3 text-xs text-success">The top of this range is at or above your ${floor.toLocaleString()} floor.</p>}
      </Card>
    );
  }
  const m = salaryMarket(job);
  const lo = Math.min(m.p25, job.salary?.[0] ?? m.p25, state.prefs.salaryFloor) * 0.9;
  const hi = Math.max(m.p75, job.salary?.[1] ?? m.p75) * 1.08;
  const pos = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`;
  const k = (n: number) => `$${Math.round(n / 1000)}K`;
  return (
    <Card>
      <SectionTitle icon={Wallet} sub={`Market data for similar roles in this area, from ${m.sample} recent postings and offers.`}>Salary</SectionTitle>
      <div className="mb-1 text-2xl font-semibold num">{salaryText(job.salary)}</div>
      <div className="mb-6 text-xs text-muted-foreground">{job.salary ? "Posted range" : "This employer did not post a range"}</div>
      <div className="relative mb-8 mt-2 h-3 rounded-full bg-muted" aria-hidden>
        <div className="absolute inset-y-0 rounded-full bg-primary/15" style={{ left: pos(m.p25), width: `calc(${pos(m.p75)} - ${pos(m.p25)})` }} />
        {job.salary && <div className="absolute inset-y-0.5 rounded-full bg-primary" style={{ left: pos(job.salary[0]), width: `calc(${pos(job.salary[1])} - ${pos(job.salary[0])})` }} />}
        <div className="absolute -top-1 h-5 w-0.5 bg-foreground/60" style={{ left: pos(m.median) }} />
        <div className="absolute -bottom-6 -translate-x-1/2 text-[10px] text-muted-foreground" style={{ left: pos(m.median) }}>
          median {k(m.median)}
        </div>
        <div className="absolute -top-1.5 h-6 w-0.5 bg-warning" style={{ left: pos(state.prefs.salaryFloor) }} />
        <div className="absolute -top-6 -translate-x-1/2 whitespace-nowrap text-[10px] font-medium text-warning" style={{ left: pos(state.prefs.salaryFloor) }}>
          your floor
        </div>
      </div>
      <dl className="grid grid-cols-3 gap-2 text-center text-sm">
        {[
          ["25th pct", m.p25],
          ["Median", m.median],
          ["75th pct", m.p75],
        ].map(([l, v]) => (
          <div key={l as string} className="rounded-lg bg-muted/50 py-2">
            <dt className="text-[11px] text-muted-foreground">{l}</dt>
            <dd className="num font-semibold">{k(v as number)}</dd>
          </div>
        ))}
      </dl>
      {job.salary && job.salary[1] < state.prefs.salaryFloor && <p className="mt-3 text-xs text-warning">The top of this range is below your ${state.prefs.salaryFloor.toLocaleString()} floor.</p>}
    </Card>
  );
}

export default function JobDetail() {
  const { id = "" } = useParams();
  const job = jobById(id);
  const nav = useNavigate();
  const [params] = useSearchParams();
  const { state } = useStore();
  const save = useSaveJob();
  const [apply, setApply] = useState(params.get("apply") === "1");
  useDocTitle(job ? `${job.title} at ${job.company.name}` : "Job not found");
  const enrich = useEnrich(job);

  useEffect(() => {
    if (params.get("apply") === "1") setApply(true);
  }, [params]);

  if (!job) {
    return <EmptyState icon={Building2} title="We could not find that job" body="It may have been removed by the employer." action={<Button asChild><Link to="/app/matches">Back to matches</Link></Button>} />;
  }

  const app = state.applications.find((a) => a.jobId === job.id);
  const applied = !!app?.receipt?.submittedAt;
  const isLive = !!job.live;
  const people = state.connections.filter((c) => c.companyId === job.company.id);
  const target = TARGET_FIELDS.find((t) => t.id === job.target)!;
  const bullets = topBulletsFor(job.target, 4);
  const hidden = job.legit.score < state.legitThreshold;

  return (
    <div>
      <button onClick={() => nav(-1)} className="mb-4 inline-flex items-center gap-1.5 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      {hidden && (
        <div className="mb-4 flex gap-3 rounded-xl border border-danger-border bg-danger-soft p-4 text-sm">
          <AlertTriangle className="h-5 w-5 shrink-0 text-danger" />
          <div>
            <b className="text-danger">We would normally leave this listing out.</b> Its legitimacy score of {job.legit.score} is below the {state.legitThreshold} we ask for. See why below before spending time on it.
          </div>
        </div>
      )}

      {/* Header */}
      <Card className="mb-6">
        <div className="flex flex-col gap-5 md:flex-row md:items-start">
          <CompanyLogo company={job.company} size={60} />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl font-semibold leading-tight sm:text-3xl">{job.title}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{job.company.name}</span>
              <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{job.location}</span>
              <span>{job.mode}</span>
              <span className="inline-flex items-center gap-1"><Wallet className="h-3.5 w-3.5" />{salaryText(job.salary)}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <LegitBadgeView badge={job.legit.badge} score={job.legit.score} />
              <Pill tone="muted">Posted {relDays(job.postedDaysAgo).toLowerCase()}</Pill>
              {job.applicants !== null && <Pill tone="muted" icon={Users}><span className="num">{job.applicants.toLocaleString()}</span> applicants, {job.signals.applicantTrend}</Pill>}
              {job.careerChangerFriendly && <Pill tone="success">Career changer friendly</Pill>}
              {job.closesInDays !== undefined && <Pill tone="warning">Closes in {job.closesInDays} day{job.closesInDays === 1 ? "" : "s"}</Pill>}
              {app && <Pill tone="primary" icon={BookmarkCheck}>In tracker: {COLUMNS.find((c) => c.id === app.column)!.label}</Pill>}
            </div>
            <p className="mt-3 text-sm text-muted-foreground">Source: {job.source}</p>
          </div>
          <div className="flex shrink-0 flex-row items-center gap-4 md:flex-col md:items-end">
            <ScoreRing value={job.match} size={84} stroke={7} sub="match" label="Match score" />
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2 border-t pt-5">
          {applied ? (
            <Button asChild>
              <Link to={`/app/receipts/${app!.id}`}><FileText /> View receipt</Link>
            </Button>
          ) : (
            <Button onClick={() => setApply(true)}>
              <Send /> Apply
            </Button>
          )}
          <Button variant="outline" asChild>
            <Link to={`/app/studio?job=${job.id}`}><FileText /> Tailor resume</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to={`/app/studio?job=${job.id}`}><PenLine /> Cover letter</Link>
          </Button>
          {!app && (
            <Button variant="ghost" onClick={() => save(job)}>
              <Bookmark /> Save
            </Button>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-6">
          <Breakdown job={job} />

          {isLive ? (
            <LiveTranslatorCard job={job} loading={enrich.loading} failed={enrich.failed} />
          ) : (
          <Card>
            <SectionTitle icon={Languages} sub={`How your experience reads to a ${target.roleTitle} hiring manager.`} right={<Button asChild variant="ghost" size="sm"><Link to={`/app/studio?job=${job.id}`}>Open in Studio</Link></Button>}>
              Career Translator for this role
            </SectionTitle>
            <blockquote className="mb-4 rounded-lg border-l-4 border-primary bg-primary-soft/60 px-4 py-3 text-sm leading-relaxed">
              <span className="text-xs font-semibold uppercase tracking-wide text-primary">Your story in one line</span>
              <p className="mt-1">{STORY_LINES["role-rom"][job.target]}</p>
            </blockquote>
            <TranslatorForBullets ids={bullets} target={job.target} />
          </Card>
          )}

          {isLive ? (
            <LiveAboutCard job={job} loading={enrich.loading} />
          ) : (
          <Card>
            <SectionTitle>About the role</SectionTitle>
            <p className="text-[15px] leading-relaxed text-foreground/85">{job.summary}</p>
            <h3 className="mb-2 mt-6 font-semibold">What you would do</h3>
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-foreground/85">
              {job.responsibilities.map((r) => <li key={r}>{r}</li>)}
            </ul>
            <h3 className="mb-2 mt-6 font-semibold">What they ask for, checked against your resume</h3>
            <ul className="space-y-2 text-sm">
              {job.requirements.map((r) => {
                const s = reqStatus(r, job);
                return (
                  <li key={r} className="flex gap-2.5">
                    {s.status === "met" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-label="You meet this" /> : s.status === "partial" ? <CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-label="Partial match" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-label="Gap" />}
                    <span>
                      {r}
                      {s.note && <span className={cn("ml-2 text-xs", s.status === "gap" ? "text-danger" : "text-warning")}>{s.note}</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
            {job.niceToHave.length > 0 && (
              <>
                <h3 className="mb-2 mt-6 font-semibold">Nice to have</h3>
                <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
                  {job.niceToHave.map((r) => <li key={r}>{r}</li>)}
                </ul>
              </>
            )}
          </Card>
          )}

          {isLive ? (
            <LiveGapsCard job={job} loading={enrich.loading} />
          ) : (
          <Card className="border-warning-border">
            <SectionTitle icon={AlertTriangle} sub="Requirements that are not in your resume. We will never add these for you. Here is how to handle each one honestly." right={<Button asChild variant="ghost" size="sm"><Link to="/app/roadmap"><MapIcon /> Roadmap</Link></Button>}>
              Gaps
            </SectionTitle>
            {job.gaps.length === 0 ? (
              <p className="text-sm text-muted-foreground">No gaps found against the listed requirements.</p>
            ) : (
              <ul className="space-y-3">
                {job.gaps.map((g) => (
                  <li key={g.id} className="rounded-lg border border-warning-border bg-warning-soft/50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{g.label}</span>
                      <Pill size="xs" tone={g.severity === "dealbreaker" ? "danger" : g.severity === "trainable" ? "warning" : "muted"}>{SEVERITY_LABEL[g.severity]}</Pill>
                    </div>
                    <p className="mt-1.5 text-sm text-foreground/80">{g.note}</p>
                    <p className="mt-2 text-sm"><span className="font-medium">In your cover letter: </span><span className="italic text-foreground/80">"{g.coverLetterLine}"</span></p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          )}
        </div>

        <div className="space-y-6">
          <WhyThisScore job={job} />

          <Card>
            <SectionTitle sub="How this application would be sent, stated plainly.">Apply path</SectionTitle>
            <MethodBadge method={job.applyMethod === "auto" ? "submitted" : job.applyMethod === "prefill" ? "prefilled" : "manual"} />
            <p className="mt-3 text-sm text-muted-foreground">
              {job.applyMethod === "auto" && "This role is on the employer's own careers page, and their form allows automated submission. CareerQuest can submit it and capture the confirmation."}
              {job.applyMethod === "prefill" && "This listing is on a third party job board. We fill in the form, you review it and press submit."}
              {job.applyMethod === "manual" && job.manualReason}
            </p>
            {applied ? (
              <Button asChild variant="outline" className="mt-4 w-full"><Link to={`/app/receipts/${app!.id}`}>View your receipt</Link></Button>
            ) : (
              <Button className="mt-4 w-full" onClick={() => setApply(true)}><Send /> Start application</Button>
            )}
          </Card>

          {people.length > 0 && (
            <Card>
              <SectionTitle icon={Users}>People you know here</SectionTitle>
              {people.map((p) => (
                <Link key={p.id} to={`/app/connections?person=${p.id}`} className="-mx-2 flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-accent">
                  <PersonAvatar name={p.name} hue={p.hue} size={38} />
                  <div className="min-w-0">
                    <div className="font-medium">{p.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{p.reason}</div>
                  </div>
                </Link>
              ))}
            </Card>
          )}

          {isLive ? (
            <LiveCompanyCard job={job} />
          ) : (
          <Card>
            <SectionTitle icon={Building2}>Company insights</SectionTitle>
            <p className="text-sm text-muted-foreground">{job.company.about}</p>
            <dl className="mt-4 space-y-2.5 text-sm">
              {[
                ["Industry", job.company.industry],
                ["Size", job.company.size],
                ["Headquarters", job.company.hq],
                ["Founded", String(job.company.founded)],
                ["Layoffs", job.company.layoffs],
                ["Hiring", job.company.hiringTrend],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="text-right">{v}</dd>
                </div>
              ))}
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Employee rating</dt>
                <dd className="inline-flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-warning text-warning" /><span className="num">{job.company.rating.toFixed(1)}</span><span className="text-muted-foreground">({job.company.ratingCount})</span></dd>
              </div>
            </dl>
            <div className="mt-4 flex gap-2 rounded-lg bg-success-soft p-3 text-sm">
              <PlusCircle className="mt-0.5 h-4 w-4 shrink-0 text-success" />
              <span><b className="text-success">Career changers: </b>{job.company.careerChangers}</span>
            </div>
          </Card>
          )}

          <SalaryCard job={job} />
        </div>
      </div>

      <ApplyFlow job={job} open={apply} onOpenChange={(o) => {
        setApply(o);
        if (!o && params.get("apply")) nav(`/app/jobs/${job.id}`, { replace: true });
      }} />
    </div>
  );
}
