import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, Lightbulb, Loader2, Mic, MessagesSquare, Sparkles, Target } from "lucide-react";
import { Card, PageHeader, ScoreRing, SectionTitle } from "@/components/common";
import { Pill } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStore } from "@/store/AppStore";
import { visibleJobs } from "@/lib/selectors";
import { api, ApiError } from "@/live/api";
import { supabase } from "@/live/supabase";
import { useDocTitle } from "@/hooks/useDocTitle";
import { cn } from "@/lib/utils";

interface LiveQuestion {
  id: string;
  text: string;
  category: string;
  why: string;
  tip: string;
  outline: string[];
}

interface Feedback {
  score: number;
  strengths: string[];
  improvements: string[];
  rewrite: string;
}

/**
 * Interview prep for a real account. Questions come from the person's own
 * resume read against one real posting, so there is no question bank and
 * nothing to unlock: what you get depends on which job you are preparing for.
 */
export default function InterviewLive() {
  useDocTitle("Interview Prep");
  const { state } = useStore();

  // Jobs worth preparing for: anything being tracked, then the strongest matches.
  const jobs = useMemo(() => {
    const tracked = state.applications.map((a) => a.jobId);
    const all = visibleJobs(state);
    const ranked = [...all].sort((a, b) => b.match - a.match);
    const ids = Array.from(new Set([...tracked, ...ranked.map((j) => j.id)]));
    return ids.map((id) => all.find((j) => j.id === id)).filter((j): j is NonNullable<typeof j> => !!j).slice(0, 25);
  }, [state.applications, state]);

  const [jobId, setJobId] = useState(() => jobs[0]?.id ?? "");
  const job = jobs.find((j) => j.id === jobId) ?? jobs[0];
  const [questions, setQuestions] = useState<LiveQuestion[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [practicing, setPracticing] = useState<LiveQuestion | null>(null);

  useEffect(() => {
    if (!job) return;
    let current = true;
    setLoading(true);
    setError(null);
    setQuestions(null);
    api<{ questions: LiveQuestion[] }>("studio", { action: "questions", jobId: job.id })
      .then((out) => current && setQuestions(out.questions))
      .catch((e) => current && setError(e instanceof ApiError ? e.message : "We could not prepare questions. Please try again."))
      .finally(() => current && setLoading(false));
    return () => {
      current = false;
    };
  }, [job?.id]);

  if (!jobs.length) {
    return (
      <div>
        <PageHeader title="Interview Prep" sub="Questions written from your own resume and the job you are actually preparing for." />
        <Card className="text-center">
          <MessagesSquare className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">Nothing to prepare for yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">Once you have matches, pick the job you are interviewing for and we will write questions from your resume against that posting.</p>
          <Button asChild variant="outline" size="sm" className="mt-4">
            <Link to="/app/matches">Find your matches</Link>
          </Button>
        </Card>
      </div>
    );
  }

  if (practicing) return <Practice q={practicing} onExit={() => setPracticing(null)} />;

  return (
    <div>
      <PageHeader
        title="Interview Prep"
        sub="Questions this employer is likely to ask, written from your resume against this posting. Nothing generic, nothing invented."
        actions={
          <Select value={job?.id ?? ""} onValueChange={setJobId}>
            <SelectTrigger className="w-full sm:w-[340px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {jobs.map((j) => (
                <SelectItem key={j.id} value={j.id}>
                  {j.title} · {j.company.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      {loading && (
        <Card className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Reading the posting against your resume
        </Card>
      )}

      {error && (
        <Card className="border-danger/30 bg-danger/5">
          <p className="text-sm">{error}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => setJobId((id) => id)}>
            Try again
          </Button>
        </Card>
      )}

      {questions && questions.length > 0 && (
        <ul className="space-y-3">
          {questions.map((q, i) => (
            <QuestionCard key={q.id} q={q} index={i} practiced={state.practice[q.id]} onPractice={() => setPracticing(q)} />
          ))}
        </ul>
      )}

      {questions && questions.length === 0 && (
        <Card className="text-center text-sm text-muted-foreground">We could not read enough of this posting to write useful questions. Try another job.</Card>
      )}
    </div>
  );
}

function QuestionCard({ q, index, practiced, onPractice }: { q: LiveQuestion; index: number; practiced?: number; onPractice: () => void }) {
  const [open, setOpen] = useState(index === 0);
  return (
    <li className={cn("card-base overflow-hidden transition-all", open && "ring-2 ring-primary/15")}>
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-accent/40 sm:p-5" aria-expanded={open}>
        <span className="num mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">{index + 1}</span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium">{q.text}</span>
          <span className="mt-1.5 flex flex-wrap items-center gap-2">
            <Pill size="xs" tone="muted">
              {q.category}
            </Pill>
            {practiced !== undefined && (
              <Pill size="xs" tone="info">
                Practiced · {practiced}
              </Pill>
            )}
          </span>
        </span>
        <ChevronDown className={cn("h-5 w-5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="border-t px-4 pb-5 pt-4 sm:px-5 animate-fade-up">
          <p className="text-sm text-muted-foreground">
            <b className="text-foreground">What they are really asking.</b> {q.why}
          </p>
          {q.outline.length > 0 && (
            <>
              <h3 className="mb-2 mt-4 flex items-center gap-2 text-sm font-semibold">
                <Target className="h-4 w-4 text-primary" /> Beats to hit, from your own history
              </h3>
              <ul className="space-y-1.5">
                {q.outline.map((o) => (
                  <li key={o} className="flex gap-2 rounded-lg bg-muted/50 p-2.5 text-sm">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    {o}
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="mt-4 flex gap-2 rounded-lg border border-primary/20 bg-primary-soft/50 p-3 text-sm">
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            {q.tip}
          </p>
          <Button size="sm" className="mt-4" onClick={onPractice}>
            <Mic /> Practice this answer
          </Button>
        </div>
      )}
    </li>
  );
}

function Practice({ q, onExit }: { q: LiveQuestion; onExit: () => void }) {
  const { update } = useStore();
  const [answer, setAnswer] = useState("");
  const [phase, setPhase] = useState<"answer" | "thinking" | "feedback">("answer");
  const [result, setResult] = useState<Feedback | null>(null);
  const [error, setError] = useState<string | null>(null);
  const words = answer.trim().split(/\s+/).filter(Boolean).length;

  const submit = async () => {
    setPhase("thinking");
    setError(null);
    try {
      const out = await api<Feedback>("studio", { action: "feedback", question: q.text, answer });
      setResult(out);
      setPhase("feedback");
      update((s) => void (s.practice[q.id] = out.score));
      // Keep the attempt so progress survives this browser.
      const uid = (await supabase?.auth.getUser())?.data.user?.id;
      if (uid && supabase) {
        await supabase.from("practice_attempts").insert({ user_id: uid, question_id: q.id, question: q.text, answer, feedback: out as unknown as Record<string, unknown> });
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "We could not review that answer. Please try again.");
      setPhase("answer");
    }
  };

  return (
    <div>
      <PageHeader eyebrow="Practice mode" title="One question at a time" sub="Answer like you would out loud. We check it against what you actually did, then show you a tighter version." />
      <Card>
        <SectionTitle icon={MessagesSquare}>{q.text}</SectionTitle>

        {phase !== "feedback" && (
          <>
            <Textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={9}
              placeholder="Say it the way you would in the room. Aim for 60 to 90 seconds, about 150 to 220 words."
              aria-label="Your answer"
              disabled={phase === "thinking"}
            />
            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
              <span className="num">{words} words</span>
              <span>{words < 40 ? "A bit short so far" : words > 240 ? "Getting long" : "Good length"}</span>
            </div>
            {error && <p className="mt-3 rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm">{error}</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={() => void submit()} disabled={words < 10 || phase === "thinking"}>
                {phase === "thinking" ? <Loader2 className="animate-spin" /> : <Sparkles />}
                {phase === "thinking" ? "Reviewing your answer" : "Get feedback"}
              </Button>
              <Button variant="ghost" onClick={onExit}>
                Exit practice
              </Button>
            </div>
          </>
        )}

        {phase === "feedback" && result && (
          <div className="animate-fade-up">
            <div className="flex flex-wrap items-center gap-6">
              <ScoreRing value={result.score} size={80} sub="overall" label="Answer score" />
              <p className="flex-1 text-sm text-muted-foreground">Scored on how this would actually land, not on word count.</p>
            </div>

            {result.strengths.length > 0 && (
              <>
                <h3 className="mb-2 mt-5 text-sm font-semibold text-success">What worked</h3>
                <ul className="space-y-2">
                  {result.strengths.map((n) => (
                    <li key={n} className="rounded-lg bg-success-soft/60 p-3 text-sm">
                      {n}
                    </li>
                  ))}
                </ul>
              </>
            )}

            {result.improvements.length > 0 && (
              <>
                <h3 className="mb-2 mt-5 text-sm font-semibold">What to change</h3>
                <ul className="space-y-2">
                  {result.improvements.map((n) => (
                    <li key={n} className="flex gap-2 rounded-lg bg-muted/50 p-3 text-sm">
                      <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {n}
                    </li>
                  ))}
                </ul>
              </>
            )}

            <h3 className="mb-2 mt-5 text-sm font-semibold">Your answer, tightened</h3>
            <p className="rounded-lg border bg-background p-4 text-sm leading-relaxed">{result.rewrite}</p>
            <p className="mt-2 text-xs text-muted-foreground">Only your own facts. Nothing was added.</p>

            <div className="mt-5 flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setPhase("answer");
                  setResult(null);
                }}
              >
                Try again
              </Button>
              <Button variant="ghost" onClick={onExit}>
                Back to questions
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
