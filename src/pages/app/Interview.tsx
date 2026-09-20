import { useEffect, useMemo, useRef, useState } from "react";
import InterviewLive from "./InterviewLive";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ArrowRight, Building2, ChevronDown, Lightbulb, ListChecks, Lock, Mic, Pause, Play, RotateCcw, Sparkles, Timer, Users } from "lucide-react";
import { AiWorking, Card, Chip, CompanyLogo, PageHeader, ScoreBar, ScoreRing, SectionTitle } from "@/components/common";
import { Pill } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useStore } from "@/store/AppStore";
import { PREP_COMPANIES, QUESTIONS, ROLE_TYPES, scoreAnswer, type Question } from "@/data/interview";
import { COMPANIES } from "@/data/companies";
import { isPro } from "@/lib/selectors";
import { useDocTitle } from "@/hooks/useDocTitle";
import { cn } from "@/lib/utils";

const FREE_SAMPLE = new Set(["q1", "q2", "q3", "q5", "q16"]);

function QuestionItem({ q, locked, onPractice, practiced }: { q: Question; locked: boolean; onPractice: () => void; practiced?: number }) {
  const [open, setOpen] = useState(false);
  return (
    <li className={cn("rounded-xl border bg-card transition-all", open && "shadow-card")}>
      <button className="flex w-full items-start gap-3 p-4 text-left" onClick={() => !locked && setOpen((o) => !o)} aria-expanded={open} disabled={locked}>
        <div className="min-w-0 flex-1">
          <div className={cn("font-medium leading-snug", locked && "blur-[3px]")}>{q.text}</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Pill size="xs" tone={q.category === "Layoff" || q.category === "Career change" ? "primary" : "muted"}>{q.category}</Pill>
            {q.reported && <Pill size="xs" tone="success" icon={Users}>Reported by recent candidates</Pill>}
            {practiced !== undefined && <Pill size="xs" tone="info">Practiced · {practiced}</Pill>}
          </div>
        </div>
        {locked ? <Lock className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" aria-label="Pro" /> : <ChevronDown className={cn("mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />}
      </button>
      {open && !locked && (
        <div className="space-y-3 border-t px-4 pb-4 pt-3 text-sm animate-fade-up">
          <p>
            <span className="font-semibold">Why they ask: </span>
            <span className="text-muted-foreground">{q.why}</span>
          </p>
          <p className="flex gap-2 rounded-lg bg-warning-soft/60 p-3">
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <span>{q.tip}</span>
          </p>
          <div>
            <div className="mb-1.5 font-semibold">Your answer, built from your experience</div>
            <ol className="list-decimal space-y-1 pl-5 text-foreground/85">
              {q.outline.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ol>
          </div>
          <Button size="sm" onClick={onPractice}>
            <Mic /> Practice this one
          </Button>
        </div>
      )}
    </li>
  );
}

function Practice({ set, onExit }: { set: Question[]; onExit: () => void }) {
  const { update } = useStore();
  const [i, setI] = useState(0);
  const [answer, setAnswer] = useState("");
  const [secs, setSecs] = useState(0);
  const [running, setRunning] = useState(true);
  const [phase, setPhase] = useState<"answer" | "thinking" | "feedback">("answer");
  const [result, setResult] = useState<ReturnType<typeof scoreAnswer> | null>(null);
  const q = set[i];
  const tick = useRef<number>();

  useEffect(() => {
    if (running && phase === "answer") tick.current = window.setInterval(() => setSecs((s) => s + 1), 1000);
    return () => window.clearInterval(tick.current);
  }, [running, phase]);

  const next = () => {
    setI((n) => n + 1);
    setAnswer("");
    setSecs(0);
    setRunning(true);
    setPhase("answer");
    setResult(null);
  };

  if (!q) {
    return (
      <Card className="py-10 text-center">
        <Sparkles className="mx-auto h-8 w-8 text-success" />
        <h2 className="mt-3 font-display text-2xl font-semibold">Set complete</h2>
        <p className="mt-1 text-sm text-muted-foreground">You practiced {set.length} questions. Saying them out loud twice more is worth more than writing them ten times.</p>
        <Button className="mt-5" onClick={onExit}>
          Back to the question bank
        </Button>
      </Card>
    );
  }

  const mm = String(Math.floor(secs / 60)).padStart(1, "0");
  const ss = String(secs % 60).padStart(2, "0");

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Question <span className="num font-semibold text-foreground">{i + 1}</span> of {set.length}
          </span>
          <Button variant="ghost" size="sm" onClick={onExit}>
            Exit practice
          </Button>
        </div>
        <div className="mb-1.5 h-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary transition-all" style={{ width: `${(i / set.length) * 100}%` }} />
        </div>
        <h2 className="mt-5 font-display text-2xl font-semibold leading-snug">{q.text}</h2>
        <div className="mt-2 flex gap-1.5">
          <Pill size="xs" tone="muted">{q.category}</Pill>
          {q.companyId && <Pill size="xs" tone="primary">{COMPANIES[q.companyId].name}</Pill>}
        </div>

        {phase === "answer" && (
          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <Label htmlFor="ans">Type your answer, or talk it through and jot the key points</Label>
              <div className="flex items-center gap-2">
                <span className={cn("num inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-semibold", secs > 120 ? "bg-warning-soft text-warning" : "bg-muted")} aria-live="off">
                  <Timer className="h-4 w-4" /> {mm}:{ss}
                </span>
                <Button size="icon-sm" variant="ghost" onClick={() => setRunning((r) => !r)} aria-label={running ? "Pause timer" : "Resume timer"}>
                  {running ? <Pause /> : <Play />}
                </Button>
              </div>
            </div>
            <Textarea id="ans" rows={8} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Start with the situation in one sentence. Then what you did. Then the result, with a number." />
            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>
                <span className="num">{answer.split(/\s+/).filter(Boolean).length}</span> words · aim for 150 to 220
              </span>
              <span>Target: under 2 minutes spoken</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                disabled={answer.trim().split(/\s+/).length < 8}
                onClick={() => {
                  setPhase("thinking");
                  setRunning(false);
                }}
              >
                <Sparkles /> Get feedback
              </Button>
              <Button variant="ghost" onClick={next}>
                Skip
              </Button>
            </div>
          </div>
        )}

        {phase === "thinking" && (
          <div className="mt-6">
            <AiWorking
              title="Reviewing your answer"
              stepMs={450}
              steps={["Checking structure", "Looking for specifics and numbers", "Comparing to what this interviewer wants"]}
              onDone={() => {
                const r = scoreAnswer(answer, q);
                setResult(r);
                setPhase("feedback");
                update((s) => void (s.practice[q.id] = r.overall));
              }}
            />
          </div>
        )}

        {phase === "feedback" && result && (
          <div className="mt-6 animate-fade-up">
            <div className="flex flex-wrap items-center gap-6">
              <ScoreRing value={result.overall} size={80} sub="overall" label="Answer score" />
              <div className="flex-1 space-y-2.5">
                {[
                  ["Structure", result.structure],
                  ["Specificity", result.specificity],
                  ["Length", result.length],
                ].map(([l, v]) => (
                  <div key={l as string}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span>{l}</span>
                      <span className="num font-semibold">{v}</span>
                    </div>
                    <ScoreBar value={v as number} height={6} label={l as string} />
                  </div>
                ))}
              </div>
            </div>
            <ul className="mt-5 space-y-2">
              {result.notes.map((n) => (
                <li key={n} className="flex gap-2 rounded-lg bg-muted/50 p-3 text-sm">
                  <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {n}
                </li>
              ))}
            </ul>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button onClick={next}>
                Next question <ArrowRight />
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setPhase("answer");
                  setRunning(true);
                }}
              >
                <RotateCcw /> Try again
              </Button>
            </div>
          </div>
        )}
      </Card>
      <Card>
        <SectionTitle icon={ListChecks}>A strong answer here</SectionTitle>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-foreground/85">
          {q.outline.map((o) => (
            <li key={o}>{o}</li>
          ))}
        </ol>
        <p className="mt-4 rounded-lg bg-warning-soft/60 p-3 text-sm">{q.tip}</p>
      </Card>
    </div>
  );
}

function DemoInterview() {
  useDocTitle("Interview Prep");
  const { state } = useStore();
  const pro = isPro(state);
  const [tab, setTab] = useState("company");
  const [companyId, setCompanyId] = useState("pinecrest");
  const [roleType, setRoleType] = useState<string>("Operations management");
  const [practice, setPractice] = useState<Question[] | null>(null);

  const companyQs = useMemo(() => {
    const c = PREP_COMPANIES.find((x) => x.id === companyId)!;
    const own = QUESTIONS.filter((q) => q.companyId === companyId);
    const role = QUESTIONS.filter((q) => !q.companyId && (q.roleType === "All" || (companyId === "pinecrest" ? q.roleType === "Healthcare administration" : companyId === "quarrylane" ? q.roleType === "Program management" : companyId === "harborlight" ? q.roleType === "Operations management" : q.roleType === "Supply chain")));
    return { c, list: [...own, ...role] };
  }, [companyId]);
  const roleQs = QUESTIONS.filter((q) => q.roleType === roleType || q.roleType === "All");

  const locked = (q: Question) => !pro && !FREE_SAMPLE.has(q.id);
  const startPractice = (qs: Question[]) => {
    const usable = qs.filter((q) => !locked(q)).slice(0, 5);
    if (!usable.length) return toast("Practice mode for these questions is part of Pro");
    setPractice(usable);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (practice) {
    return (
      <div>
        <PageHeader eyebrow="Practice mode" title="One question at a time" sub="Answer like you would out loud. We check structure, specifics, and length, then show you what a strong answer includes." />
        <Practice set={practice} onExit={() => setPractice(null)} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Interview Prep"
        sub="Questions organized by company and role type, with answers built from your real experience. Included in Pro, never sold separately."
        actions={
          <Button onClick={() => startPractice(tab === "company" ? companyQs.list : roleQs)}>
            <Mic /> Start practice mode
          </Button>
        }
      />
      {!pro && (
        <div className="mb-5 flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center">
          <Lock className="h-5 w-5 text-muted-foreground" />
          <p className="flex-1 text-sm">You are seeing 5 sample questions. The full bank of {QUESTIONS.length} questions and unlimited practice are included in Pro.</p>
          <Button asChild size="sm">
            <Link to="/app/billing">See Pro</Link>
          </Button>
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-5">
          <TabsTrigger value="company">
            <Building2 className="mr-1.5 h-4 w-4" /> By company
          </TabsTrigger>
          <TabsTrigger value="role">
            <Users className="mr-1.5 h-4 w-4" /> By role type
          </TabsTrigger>
        </TabsList>

        <TabsContent value="company">
          <div className="mb-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {PREP_COMPANIES.map((c) => (
              <button
                key={c.id}
                onClick={() => setCompanyId(c.id)}
                aria-pressed={companyId === c.id}
                className={cn("card-base flex items-center gap-3 p-3 text-left transition-all hover:border-primary/40", companyId === c.id && "border-primary ring-2 ring-primary/15")}
              >
                <CompanyLogo company={COMPANIES[c.id]} size={36} />
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{c.name}</div>
                  <div className={cn("truncate text-xs", /in \d/.test(c.when) ? "font-medium text-primary" : "text-muted-foreground")}>{c.when}</div>
                </div>
              </button>
            ))}
          </div>
          <Card className="mb-4 p-4 sm:p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold">
                  {companyQs.c.role} at {companyQs.c.name}
                </h2>
                <p className="text-sm text-muted-foreground">{companyQs.list.length} questions, including ones recent candidates reported.</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => startPractice(companyQs.list)}>
                <Play /> Practice this set
              </Button>
            </div>
          </Card>
          <ul className="space-y-2.5">
            {companyQs.list.map((q) => (
              <QuestionItem key={q.id} q={q} locked={locked(q)} practiced={state.practice[q.id]} onPractice={() => startPractice([q])} />
            ))}
          </ul>
        </TabsContent>

        <TabsContent value="role">
          <div className="mb-5 flex flex-wrap gap-2">
            {ROLE_TYPES.map((r) => (
              <Chip key={r} active={roleType === r} onClick={() => setRoleType(r)}>
                {r}
              </Chip>
            ))}
          </div>
          <ul className="space-y-2.5">
            {roleQs.map((q) => (
              <QuestionItem key={q.id} q={q} locked={locked(q)} practiced={state.practice[q.id]} onPractice={() => startPractice([q])} />
            ))}
          </ul>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** The sample account keeps its scripted bank; a real account gets questions written for it. */
export default function Interview() {
  const { state } = useStore();
  return state.mode === "live" ? <InterviewLive /> : <DemoInterview />;
}
