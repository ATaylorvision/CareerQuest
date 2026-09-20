import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Check, Loader2, RefreshCcw, Rocket, Search, Sparkles } from "lucide-react";
import { JobCard } from "@/components/JobCard";
import { LegitBadgeView } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStore } from "@/store/AppStore";
import { BASE_RESUME } from "@/data/user";
import { TARGET_FIELDS } from "@/data/translator";
import { setLiveJobs, type Job, type TargetField } from "@/data/jobs";
import { api } from "@/live/api";
import { runPipeline, type Progress } from "@/live/pipeline";
import { useLive } from "@/live/LiveProvider";
import { cn } from "@/lib/utils";

type HRef = React.RefObject<HTMLHeadingElement>;

function Heading({ headingRef, title, sub }: { headingRef: HRef; title: string; sub: string }) {
  return (
    <div className="mb-7">
      <h1 ref={headingRef} tabIndex={-1} className="font-display text-3xl font-semibold outline-none sm:text-4xl text-balance">
        {title}
      </h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">{sub}</p>
    </div>
  );
}

/* ---------------- Translator, on the user's real resume ---------------- */

export function LiveStepTranslator({ headingRef, onBack }: { headingRef: HRef; onBack: () => void }) {
  const { state } = useStore();
  const target = state.prefs.targetField as TargetField;
  const prev = state.prefs.prevField;
  const [rows, setRows] = useState<{ from: string; phrases: string[] }[] | null>(null);
  const [err, setErr] = useState("");
  const [nonce, setNonce] = useState(0);
  const seq = useRef(0);

  const items = useMemo(
    () =>
      BASE_RESUME.roles
        .flatMap((r) => r.bullets.map((b) => b.text))
        .filter((t) => t.trim().length > 20)
        .slice(0, 3),
    [],
  );
  const targetMeta = TARGET_FIELDS.find((t) => t.id === target)!;

  useEffect(() => {
    const id = ++seq.current;
    setRows(null);
    setErr("");
    if (items.length === 0) {
      setRows([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const out = await api<{ rows: { from: string; phrases: string[] }[] }>("translate", { target, items, prevField: prev });
        if (id === seq.current) setRows(out.rows);
      } catch (e) {
        if (id === seq.current) setErr((e as Error).message);
      }
    }, 600);
    return () => clearTimeout(t);
  }, [target, prev, items, nonce]);

  return (
    <div>
      <Heading
        headingRef={headingRef}
        title="Here is how your experience reads"
        sub={`Three lines from your own resume, rewritten in ${targetMeta.label.toLowerCase()} language. Nothing is added: these only rename work you already did.`}
      />
      <div className="card-base mb-5 flex flex-wrap items-center gap-x-3 gap-y-1 p-4 text-sm">
        <span className="text-muted-foreground">Translating</span>
        <span className="font-medium">{prev || "your experience"}</span>
        <ArrowRight className="h-4 w-4 text-primary" aria-hidden />
        <span className="font-medium">{targetMeta.label}</span>
        <button type="button" onClick={onBack} className="ml-auto text-xs font-medium text-primary hover:underline">
          Change
        </button>
      </div>

      <div className="space-y-3" aria-live="polite">
        {items.length === 0 && <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">We did not find any bullet points on your resume to translate. Go back and check the parsed resume.</p>}
        {err && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-danger-border bg-danger-soft p-4 text-sm">
            <span>{err}</span>
            <Button size="sm" variant="outline" onClick={() => setNonce((n) => n + 1)}>
              <RefreshCcw /> Try again
            </Button>
          </div>
        )}
        {(rows ?? items.map((from) => ({ from, phrases: [] as string[] }))).map((r, i) => (
          <div key={r.from} className="grid grid-cols-1 gap-3 rounded-xl border bg-card p-4 shadow-card md:grid-cols-[1fr_auto_1.1fr] md:items-center md:p-5">
            <div>
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">From your resume</div>
              <p className="text-sm">{r.from}</p>
            </div>
            <ArrowRight className="mx-auto h-4 w-4 rotate-90 text-primary md:rotate-0" aria-hidden />
            <div>
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary">{targetMeta.label} language</div>
              {rows === null && !err ? (
                <div className="flex gap-2">
                  <div className="skeleton h-7 w-40" />
                  <div className="skeleton h-7 w-28" />
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {r.phrases.map((p, j) => (
                    <span key={p} className="rounded-md bg-primary-soft px-2.5 py-1 text-xs font-medium text-primary animate-pop" style={{ animationDelay: `${i * 120 + j * 60}ms` }}>
                      {p}
                    </span>
                  ))}
                  {r.phrases.length === 0 && !err && <span className="text-xs text-muted-foreground">No clean translation for this line.</span>}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm text-muted-foreground">These only rename work you already did. Nothing is added. The full Career Translator, in the Studio, covers every line of your resume.</p>
    </div>
  );
}

/* ---------------- First matches, from real listings ---------------- */

const STAGES: { id: Progress["stage"]; label: string }[] = [
  { id: "search", label: "Searching live listings and checking each company's own careers page" },
  { id: "score", label: "Scoring every listing against your resume" },
  { id: "detail", label: "Translating your experience for your best matches" },
];
const ORDER: Progress["stage"][] = ["search", "score", "detail", "done"];

export function LiveStepResults({ headingRef, onFinish }: { headingRef: HRef; onFinish: () => void }) {
  const { state, update } = useStore();
  const nav = useNavigate();
  const onTailor = (id: string) => {
    update((s) => void (s.onboarded = true));
    nav(`/app/studio?job=${id}&tailor=1`);
  };
  const { flushProfile } = useLive();
  const [progress, setProgress] = useState<Progress>({ stage: "search", message: "Starting" });
  const [jobs, setJobs] = useState<Job[]>([]);
  const [phase, setPhase] = useState<"running" | "done" | "error">("running");
  const [error, setError] = useState("");
  const started = useRef(false);

  const run = async () => {
    setPhase("running");
    setError("");
    setProgress({ stage: "search", message: "Starting" });
    try {
      await flushProfile();
      await runPipeline({
        onProgress: setProgress,
        onJobs: (j) => {
          setLiveJobs(j);
          setJobs(j);
        },
      });
      update((s) => void (s.onboarded = true));
      setPhase("done");
    } catch (e) {
      setError((e as Error).message);
      setPhase("error");
    }
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visible = jobs.filter((j) => j.legit.score >= state.legitThreshold);
  const hidden = jobs.filter((j) => j.legit.score < state.legitThreshold);
  const top = [...visible].sort((a, b) => b.match - a.match).slice(0, 5);
  const current = ORDER.indexOf(progress.stage);

  if (phase === "running" || phase === "error") {
    return (
      <div className="mx-auto max-w-lg py-6">
        <h1 ref={headingRef} tabIndex={-1} className="mb-2 font-display text-3xl font-semibold outline-none">
          Finding your first matches
        </h1>
        <p className="mb-6 text-sm text-muted-foreground">This is real. We are pulling live listings and reading each one against your resume. It takes about 30 seconds.</p>
        <div className="card-base p-6">
          <ul className="space-y-4" role="status" aria-live="polite">
            {STAGES.map((st, i) => {
              const done = i < current;
              const active = i === current && phase === "running";
              return (
                <li key={st.id} className={cn("flex items-start gap-3 text-sm transition-opacity", i > current && "opacity-40")}>
                  {done ? (
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success text-white animate-pop">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                  ) : active ? (
                    <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-primary" />
                  ) : (
                    <span className="mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 border-muted" />
                  )}
                  <span>
                    <span className={done ? "text-muted-foreground" : ""}>{st.label}</span>
                    {(done || active) && i === 0 && progress.found !== undefined && (
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        Found <b className="num text-foreground">{progress.found}</b> listings, <b className="num text-foreground">{progress.verified ?? 0}</b> confirmed on the employer's own site
                      </span>
                    )}
                    {active && i === 1 && progress.scored !== undefined && progress.found !== undefined && (
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        Scored <b className="num text-foreground">{progress.scored}</b> of <b className="num text-foreground">{progress.found}</b>
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
          {phase === "error" && (
            <div className="mt-5 rounded-lg border border-danger-border bg-danger-soft p-4 text-sm" role="alert">
              <p>{error}</p>
              <Button size="sm" variant="outline" className="mt-3 bg-background" onClick={() => void run()}>
                <RefreshCcw /> Try again
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="mx-auto max-w-lg py-10 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Search className="h-6 w-6 text-muted-foreground" />
        </div>
        <h1 ref={headingRef} tabIndex={-1} className="font-display text-3xl font-semibold outline-none">
          No listings came back
        </h1>
        <p className="mt-2 text-muted-foreground">{progress.message !== "Done" ? progress.message : "Try broader role titles or a nearby city, then search again."}</p>
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Button variant="outline" onClick={() => void run()}>
            <RefreshCcw /> Search again
          </Button>
          <Button onClick={onFinish}>Go to the app anyway</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-up">
      <div className="mb-7 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success-soft text-success animate-pop">
          <Sparkles className="h-6 w-6" />
        </div>
        <h1 ref={headingRef} tabIndex={-1} className="font-display text-3xl font-semibold outline-none sm:text-4xl text-balance">
          Your experience counts in more places than you think.
        </h1>
        <p className="mx-auto mt-2 max-w-xl text-muted-foreground">These are your five strongest matches from real, current listings. Every score shows its reasoning.</p>
      </div>
      <div className="mb-6 grid grid-cols-3 gap-3">
        {[
          { n: jobs.length, l: "real listings scored" },
          { n: visible.filter((j) => j.careerChangerFriendly).length, l: "career changer friendly" },
          { n: hidden.length, l: "listings set aside" },
        ].map((s) => (
          <div key={s.l} className="card-base p-4 text-center">
            <div className="num font-display text-3xl font-semibold">{s.n}</div>
            <div className="text-xs text-muted-foreground">{s.l}</div>
          </div>
        ))}
      </div>
      {hidden.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border bg-background p-3 text-sm">
          <span className="text-muted-foreground">Hidden for you:</span>
          {hidden.slice(0, 4).map((g) => (
            <span key={g.id} className="inline-flex items-center gap-2">
              <span className="font-medium">{g.company.name}</span>
              <LegitBadgeView badge={g.legit.badge} score={g.legit.score} size="xs" />
            </span>
          ))}
        </div>
      )}
      <div className="space-y-3">
        {top.map((j, i) => (
          <JobCard key={j.id} job={j} index={i} />
        ))}
      </div>
      {top[0] && (
        <div className="mt-8 rounded-2xl border border-primary/30 bg-primary-soft/50 p-5 text-center">
          <h2 className="font-display text-xl font-semibold">Your first tailored resume is free.</h2>
          <p className="mx-auto mt-1 max-w-lg text-sm text-foreground/80">
            We will rewrite your resume for {top[0].title} at {top[0].company.name}: reordering, rewording, and re-emphasizing what you already have. Nothing invented, and you approve every change.
          </p>
          <Button size="lg" className="mt-4" onClick={() => onTailor(top[0].id)}>
            <Sparkles /> Tailor it for {top[0].company.name}
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">Your original stays exactly as it is. Tailoring never changes it.</p>
        </div>
      )}

      <div className="mt-6 flex flex-col items-center gap-3">
        <Button size="lg" variant="outline" onClick={onFinish}>
          <Rocket /> Go to Today's Plan
        </Button>
        <p className="text-xs text-muted-foreground">The rest of your matches are waiting in the feed.</p>
      </div>
    </div>
  );
}
