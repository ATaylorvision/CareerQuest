import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import {
  ArrowRight,
  Bookmark,
  Briefcase,
  CalendarClock,
  CalendarRange,
  Clock,
  Flame,
  FileDown,
  Languages,
  MessageCircle,
  Printer,
  Send,
  Sparkles,
  Sprout,
  Target,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { Card, Chip, CompanyLogo, PageHeader, ScoreRing, SectionTitle } from "@/components/common";
import { LegitBadgeView, Pill, SampleTag } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useStore } from "@/store/AppStore";
import { ProfileQuestions } from "@/components/ProfileQuestions";
import { buildResume, downloadText, printResume, resumeToText } from "@/lib/resumeBuild";
import { buildPlan, INTENSITY_META } from "@/data/plan";
import { buildLivePlan } from "@/lib/livePlan";
import { jobById, JOBS } from "@/data/jobs";
import { visibleFor } from "@/lib/matchRules";
import { gapAggregate, streakOf, visibleJobs } from "@/lib/selectors";
import { daysUntilWeekday, fmtDate, diffDays, startOfToday } from "@/lib/date";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";
import { useDocTitle } from "@/hooks/useDocTitle";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

const RESPONSE_TYPES = new Set(["screen", "interview", "offer"]);

function CheckCircle({ done, onClick, label }: { done: boolean; onClick: () => void; label: string }) {
  return (
    <button
      role="checkbox"
      aria-checked={done}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200",
        done ? "border-success bg-success text-white dark:text-[hsl(224_40%_8%)]" : "border-muted-foreground/35 hover:border-success hover:bg-success-soft",
      )}
    >
      {done && (
        <svg viewBox="0 0 24 24" className="h-4 w-4 animate-pop" aria-hidden>
          <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="24" className="animate-draw" />
        </svg>
      )}
    </button>
  );
}

/** One number with its context. The top row of the dashboard is nothing but these. */
function Tile({ icon: Icon, label, value, sub, tone }: { icon: React.ComponentType<{ className?: string }>; label: string; value: React.ReactNode; sub: string; tone?: "success" | "warning" }) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon className="h-4 w-4" /> {label}
      </div>
      <div className={cn("num mt-1.5 font-display text-2xl font-semibold sm:text-3xl", tone === "success" && "text-success", tone === "warning" && "text-warning")}>{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
    </Card>
  );
}

/**
 * The one place to run the search from. This used to be two pages: "Today",
 * which held the daily plan, and a separate "Weekly Check In" that owned the
 * numbers. Splitting the plan from the evidence meant neither page could
 * answer "how is this going", so they are one screen now.
 */
export default function Dashboard() {
  useDocTitle("Dashboard");
  const { state, update } = useStore();
  const { theme } = useTheme();
  const [feel, setFeel] = useState<string | null>(null);

  const streak = streakOf(state);
  const gaps = gapAggregate(state);
  const wms = gaps.items.find((g) => g.gap.id === "wms");
  const live = state.mode === "live";
  const northvale = jobById("j01");
  const fri = daysUntilWeekday(5);
  const closesDay = fri === 0 ? "today" : fri === 1 ? "tomorrow" : "Friday";

  const demoPlan = useMemo(
    () => (live ? [] : buildPlan({ northvaleMatch: northvale?.match ?? 0, closesDay, wmsCount: wms?.jobs.length ?? 0, savedTotal: gaps.total }).slice(0, INTENSITY_META[state.prefs.intensity].actions)),
    [live, northvale?.match, closesDay, wms?.jobs.length, gaps.total, state.prefs.intensity],
  );
  const plan = live ? buildLivePlan(state) : demoPlan;
  const doneCount = plan.filter((p) => state.planDone[p.id]).length;
  const allDone = plan.length > 0 && doneCount === plan.length;

  const baseDoc = useMemo(() => buildResume([], {}, { contact: state.resume.contact }), [state.resume.contact]);

  const weekStart = startOfToday();
  weekStart.setDate(weekStart.getDate() - 6);

  const stats = useMemo(() => {
    const apps = state.applications.filter((a) => a.receipt?.submittedAt);
    const sentThisWeek = apps.filter((a) => diffDays(a.receipt!.submittedAt!) <= 6).length;
    const responsesThisWeek = state.applications.flatMap((a) => a.events.filter((e) => !e.future && RESPONSE_TYPES.has(e.type) && diffDays(e.at) <= 6)).length;
    const responded = apps.filter((a) => a.events.some((e) => !e.future && RESPONSE_TYPES.has(e.type))).length;
    const rate = apps.length ? Math.round((responded / apps.length) * 100) : 0;
    const saved = state.applications.filter((a) => !a.receipt?.submittedAt).length;
    return { sentThisWeek, responsesThisWeek, total: apps.length, responded, rate, saved };
  }, [state.applications]);

  const weeks = useMemo(() => {
    const sent = live ? [0, 0, 0, 0, 0, stats.sentThisWeek] : [1, 2, 1, 1, 2, stats.sentThisWeek];
    const resp = live ? [0, 0, 0, 0, 0, stats.responsesThisWeek] : [0, 0, 1, 1, 1, stats.responsesThisWeek];
    return sent.map((s, i) => {
      const d = startOfToday();
      d.setDate(d.getDate() - (5 - i) * 7);
      return { week: i === 5 ? "This week" : fmtDate(d.toISOString()), Sent: s, Responses: resp[i] };
    });
  }, [stats.sentThisWeek, stats.responsesThisWeek, live]);

  const axis = theme === "dark" ? "hsl(218 13% 68%)" : "hsl(220 9% 40%)";
  const grid = theme === "dark" ? "hsl(222 16% 19%)" : "hsl(220 16% 90%)";

  const toggle = (id: string) => {
    const was = !!state.planDone[id];
    update((s) => {
      s.planDone[id] = !was;
      if (!was) {
        s.activity[0] = true;
        if (s.streakBrokenDemo) s.streakBrokenDemo = false;
      }
    });
    if (!was) {
      const left = plan.length - doneCount - 1;
      toast.success(left === 0 ? "That is everything for today." : "Nice. One more down.", { description: left === 0 ? "Rest counts too. See you tomorrow." : `${left} left, and none of them are big.` });
    }
  };

  const upcoming = state.applications
    .flatMap((a) => a.events.filter((e) => e.future).map((e) => ({ e, a, job: jobById(a.jobId)! })))
    .sort((x, y) => new Date(x.e.at).getTime() - new Date(y.e.at).getTime());
  const offer = state.applications.find((a) => a.column === "offer");

  const open = visibleJobs(state);
  const newMatches = visibleFor(state).filter((j) => j.isNew).slice(0, 3);
  const isSunday = startOfToday().getDay() === 0;
  const smallest = [...plan].filter((p) => !state.planDone[p.id]).sort((a, b) => a.minutes - b.minutes)[0];
  const w = state.weekly;
  const suggested = INTENSITY_META[state.prefs.intensity];

  return (
    <div>
      <PageHeader
        eyebrow={startOfToday().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        title={`${greeting()}, ${state.profile.name.split(" ")[0] || "there"}.`}
        sub={
          plan.length === 0
            ? "Your search at a glance."
            : allDone
              ? "You finished today's plan. That is real progress."
              : `${plan.length} small things today. ${doneCount === 0 ? "Start with whichever feels easiest." : `${doneCount} already done.`}`
        }
      />

  <Card className="mb-5">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <div className={cn("flex h-14 w-14 items-center justify-center rounded-2xl", streak.broken ? "bg-muted text-muted-foreground" : "bg-warning-soft text-warning")}>
              <Flame className="h-7 w-7" />
            </div>
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="num font-display text-4xl font-semibold">{streak.current}</span>
                <span className="text-sm text-muted-foreground">day streak</span>
              </div>
              <div className="text-xs text-muted-foreground">Best so far: {streak.best} days</div>
            </div>
          </div>
          <div className="flex-1 sm:pl-4">
            <div className="mb-2 text-xs text-muted-foreground">Last 3 weeks. A filled dot means at least one action.</div>
            <div className="flex flex-wrap gap-1.5" aria-label="Activity over the last 21 days">
              {[...state.activity].reverse().map((d, i, arr) => {
                const isToday = i === arr.length - 1;
                const on = d && !(state.streakBrokenDemo && i >= arr.length - 3);
                return (
                  <span
                    key={i}
                    title={isToday ? "Today" : `${arr.length - 1 - i} days ago`}
                    className={cn("h-5 w-5 rounded-md transition-colors sm:h-6 sm:w-6", on ? "bg-success" : "bg-muted", isToday && "ring-2 ring-primary ring-offset-2 ring-offset-card")}
                  />
                );
              })}
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              {streak.broken ? "Streaks restart the moment you do one small thing. No penalty, no guilt." : "Consistency beats intensity. Missing a day never erases what you have done."}
            </p>
          </div>
        </div>
      </Card>

      {/* Then the numbers, so the state of the search is readable without scrolling. */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile icon={Briefcase} label="Open matches" value={open.length} sub={`${newMatches.length} new since yesterday`} />
        <Tile icon={Send} label="Applications" value={stats.total} sub={`${stats.sentThisWeek} sent this week`} />
        <Tile icon={TrendingUp} label="Response rate" value={`${stats.rate}%`} sub={`${stats.responded} of ${stats.total} replied`} />
        <Tile icon={Bookmark} label="Saved, not sent" value={stats.saved} sub="Waiting on you" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-6">
          {live && !state.activity.some(Boolean) && (
            <div className="flex gap-3 rounded-xl border border-success-border bg-success-soft p-4 animate-fade-up">
              <Sprout className="h-6 w-6 shrink-0 text-success" />
              <div>
                <div className="font-semibold">Welcome. This is day one.</div>
                <div className="text-sm text-foreground/80">Finish any one action below and your streak starts. They are all small.</div>
              </div>
            </div>
          )}

          {streak.broken && (
            <div className="flex flex-col gap-3 rounded-xl border border-info-border bg-info-soft p-4 sm:flex-row sm:items-center animate-fade-up">
              <Sprout className="h-6 w-6 shrink-0 text-info" />
              <div className="flex-1">
                <div className="font-semibold">You took a couple days. Normal. Here is today's smallest win.</div>
                {smallest && (
                  <div className="text-sm text-foreground/80">
                    {smallest.title}. About {smallest.minutes} minutes.
                  </div>
                )}
              </div>
              {smallest && (
                <Button size="sm" onClick={() => toggle(smallest.id)}>
                  Mark it done
                </Button>
              )}
            </div>
          )}

          {plan.length > 0 && (
            <Card className="p-0 sm:p-0">
              <div className="flex items-center gap-4 border-b p-5 sm:p-6">
                <ScoreRing value={Math.round((doneCount / plan.length) * 100)} size={56} tone="success" label="Plan progress, percent" display={`${doneCount}/${plan.length}`} />
                <div className="flex-1">
                  <h2 className="text-lg font-semibold">Today's Plan</h2>
                  <p className="text-sm text-muted-foreground">
                    <span className="num">{doneCount}</span> of <span className="num">{plan.length}</span> done · {suggested.label} pace ·{" "}
                    <Link to="/app/settings" className="text-primary hover:underline">
                      change
                    </Link>
                  </p>
                </div>
              </div>
              <ul>
                {plan.map((p) => {
                  const done = !!state.planDone[p.id];
                  return (
                    <li key={p.id} className={cn("flex gap-4 border-b p-5 transition-colors last:border-0 sm:px-6", done ? "bg-muted/30" : "hover:bg-accent/40")}>
                      <CheckCircle done={done} onClick={() => toggle(p.id)} label={p.title} />
                      <div className="min-w-0 flex-1">
                        <div className={cn("font-medium leading-snug transition-colors", done && "text-muted-foreground line-through decoration-muted-foreground/50")}>{p.title}</div>
                        <p className={cn("mt-0.5 text-sm", done ? "text-muted-foreground/70" : "text-muted-foreground")}>{p.detail}</p>
                        <div className="mt-2.5 flex flex-wrap items-center gap-3">
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3.5 w-3.5" /> {p.minutes} min
                          </span>
                          {!done && (
                            <Button asChild size="xs" variant="soft">
                              <Link to={p.to}>
                                {p.cta} <ArrowRight />
                              </Link>
                            </Button>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
              {allDone && (
                <div className="flex items-center gap-3 border-t bg-success-soft p-5 text-sm sm:px-6 animate-fade-up">
                  <Trophy className="h-5 w-5 text-success" />
                  <span>
                    <b className="text-success">Done for today.</b> Tomorrow's plan shows up at 7 a.m.
                  </span>
                </div>
              )}
            </Card>
          )}

          <Card>
            <SectionTitle icon={CalendarRange} sub="Applications you sent and responses you got, by week.">
              Last six weeks
            </SectionTitle>
            <div className="h-64" role="img" aria-label={`Bar chart. This week you sent ${stats.sentThisWeek} applications and received ${stats.responsesThisWeek} responses.`}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeks} barGap={4} margin={{ left: -20, right: 8, top: 8 }}>
                  <CartesianGrid vertical={false} stroke={grid} />
                  <XAxis dataKey="week" tick={{ fill: axis, fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: axis, fontSize: 12 }} axisLine={false} tickLine={false} />
                  <RTooltip cursor={{ fill: "hsl(var(--muted))" }} contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12, color: "hsl(var(--foreground))" }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
                  <Bar dataKey="Sent" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="Responses" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {newMatches.length > 0 && (
            <Card>
              <SectionTitle
                icon={Sparkles}
                sub="Posted in the last few days, and each one cleared our legitimacy checks."
                right={
                  <Button asChild variant="ghost" size="sm">
                    <Link to="/app/matches">
                      All matches <ArrowRight />
                    </Link>
                  </Button>
                }
              >
                New since yesterday
              </SectionTitle>
              <ul className="divide-y">
                {newMatches.map((j) => (
                  <li key={j.id}>
                    <Link to={`/app/jobs/${j.id}`} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-accent">
                      <CompanyLogo company={j.company} size={38} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{j.title}</div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span className="truncate">{j.company.name}</span>
                          <LegitBadgeView badge={j.legit.badge} score={j.legit.score} size="xs" withTip={false} />
                        </div>
                      </div>
                      <ScoreRing value={j.match} size={42} label="Match" />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}

        </div>

        {/* Right rail */}
        <div className="space-y-6">
          <ProfileQuestions />

          {/* Your resume, without going anywhere first. */}
          <Card>
            <SectionTitle icon={FileDown} sub="Plain headings, real text, no tables. The version screening software reads cleanly.">
              Your resume, ATS ready
            </SectionTitle>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => {
                  if (!printResume(baseDoc, `${baseDoc.name.replace(/\s+/g, "_")}_Resume`, state.resume.templateId, state.profile.headline, state.resume.format))
                    toast.error("Your browser blocked the print window. Allow pop ups and try again.");
                }}
              >
                <Printer /> Download PDF
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  downloadText(`${baseDoc.name.replace(/\s+/g, "_")}_Resume.txt`, resumeToText(baseDoc));
                  toast.success("Plain text resume downloaded");
                }}
              >
                <FileDown /> Plain text
              </Button>
              <Button asChild size="sm" variant="ghost">
                <Link to="/app/studio">
                  Tailor it for a job <ArrowRight />
                </Link>
              </Button>
            </div>
          </Card>

          <Card>
            <SectionTitle icon={CalendarClock}>Coming up</SectionTitle>
            <ul className="space-y-3">
              {offer && (
                <li>
                  <Link to={`/app/receipts/${offer.id}`} className="block rounded-lg border border-success-border bg-success-soft p-3 transition-colors hover:border-success">
                    <div className="text-xs font-semibold uppercase tracking-wide text-success">{live ? "Offer on the table" : "Offer, response due in 5 days"}</div>
                    <div className="mt-0.5 font-medium">{jobById(offer.jobId)!.title}</div>
                    <div className="text-sm text-muted-foreground">{jobById(offer.jobId)!.company.name}</div>
                  </Link>
                </li>
              )}
              {!offer && upcoming.length === 0 && (
                <li className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Nothing scheduled yet. When you get a call or an interview, log it on that application's receipt and it shows up here.</li>
              )}
              {upcoming.map(({ e, a, job }) => (
                <li key={e.id}>
                  <Link to={`/app/receipts/${a.id}`} className="block rounded-lg border p-3 transition-colors hover:border-primary/40 hover:bg-accent/40">
                    <div className="text-xs font-semibold uppercase tracking-wide text-primary">
                      {fmtDate(e.at, { weekday: "long", month: "short", day: "numeric" })} · in {-diffDays(e.at)} days
                    </div>
                    <div className="mt-0.5 font-medium">{e.note?.split(",")[0] ?? "Interview"}</div>
                    <div className="text-sm text-muted-foreground">
                      {job.title}, {job.company.name}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>

          <Card className={cn(isSunday && "border-primary/40 ring-2 ring-primary/15")}>
            <SectionTitle icon={Target} sub={isSunday ? `It is Sunday. Suggested for your ${suggested.label.toLowerCase()} pace: ${suggested.apps}.` : `Suggested for your ${suggested.label.toLowerCase()} pace: ${suggested.apps}.`}>
              Next week's target
            </SectionTitle>
            <div className="space-y-6">
              {[
                { k: "applications" as const, label: "Applications", max: 15, unit: "" },
                { k: "networking" as const, label: "Networking notes", max: 10, unit: "" },
                { k: "learningHours" as const, label: "Hours on skill gaps", max: 10, unit: "h" },
              ].map((s) => (
                <div key={s.k}>
                  <div className="mb-2 flex justify-between text-sm">
                    <span className="font-medium" id={`lbl-${s.k}`}>
                      {s.label}
                    </span>
                    <span className="num font-semibold">
                      {w[s.k]}
                      {s.unit}
                    </span>
                  </div>
                  <Slider aria-labelledby={`lbl-${s.k}`} value={[w[s.k]]} min={0} max={s.max} step={1} onValueChange={([v]) => update((d) => void (d.weekly[s.k] = v))} />
                </div>
              ))}
            </div>
            <Button
              className="mt-6 w-full"
              onClick={() => {
                update((d) => void (d.weekly.savedAt = new Date().toISOString()));
                toast.success("Next week is set", { description: `${w.applications} applications, ${w.networking} notes, ${w.learningHours} hours. Your daily plans will pace to it.` });
              }}
            >
              {w.savedAt ? "Update target" : "Set next week's target"}
            </Button>
            {w.savedAt && <p className="mt-2 text-center text-xs text-muted-foreground">Saved {fmtDate(w.savedAt, { weekday: "long", hour: "numeric", minute: "2-digit" })}</p>}
          </Card>

          <Card>
            <SectionTitle icon={Sparkles}>How did this week feel?</SectionTitle>
            <div className="flex flex-wrap gap-2">
              {["Rough", "Okay", "Pretty good"].map((f) => (
                <Chip key={f} active={feel === f} onClick={() => setFeel(f)}>
                  {f}
                </Chip>
              ))}
            </div>
            {feel && (
              <p className="mt-3 rounded-lg bg-muted/50 p-3 text-sm animate-fade-up">
                {feel === "Rough" && "That is honest, and it is allowed. Whatever you sent this week still counts. Next week, keep the target modest."}
                {feel === "Okay" && "Okay is a good week in a job search. Steady beats spiky. Keep the same rhythm."}
                {feel === "Pretty good" && "Hold on to that. Write down what you did differently, because it is worth repeating."}
              </p>
            )}
          </Card>

          <Card>
            <SectionTitle icon={MessageCircle}>Also this week</SectionTitle>
            <ul className="space-y-2.5 text-sm">
              <li className="flex justify-between gap-3">
                <span className="text-muted-foreground">Responses</span>
                <span className="num font-medium">{stats.responsesThisWeek}</span>
              </li>
              <li className="flex justify-between gap-3">
                <span className="text-muted-foreground">Networking notes sent</span>
                <span className="num font-medium">{state.connections.filter((c) => ["sent", "replied", "meeting"].includes(c.status)).length}</span>
              </li>
              <li className="flex justify-between gap-3">
                <span className="text-muted-foreground">Skill resources finished</span>
                <span className="num font-medium">{Object.values(state.roadmap).filter((v) => v === "done").length}</span>
              </li>
              <li className="flex justify-between gap-3">
                <span className="text-muted-foreground">Days with an action</span>
                <span className="num font-medium">{state.activity.slice(0, 7).filter(Boolean).length} of 7</span>
              </li>
            </ul>
          </Card>

          <Link to="/app/studio" className="card-base card-hover block overflow-hidden p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <Languages className="h-4 w-4" /> Career Translator
            </div>
            <p className="mt-2 text-sm">
              {live ? (
                "See how the work on your resume reads in the field you want, line by line, in the words hiring managers use."
              ) : (
                <>
                  "Managed weekly inventory counts and replenishment orders" reads as <b>inventory planning and replenishment</b> in supply chain. See all 11 of your lines translated.
                </>
              )}
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary">
              Open translator <ArrowRight className="h-4 w-4" />
            </span>
          </Link>

          {!live && (
            <div className="flex justify-center">
              <SampleTag>Sample account: Renee Castillo is fictional</SampleTag>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
