import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Check, Loader2, MapPin, RefreshCcw, Rocket, Search, Sparkles } from "lucide-react";
import { ScoreRing } from "@/components/common";
import { Segmented } from "@/components/common";
import { PagePreview } from "@/components/studio/FormatBar";
import { ResumeDocument } from "@/components/studio/ResumeDocument";
import { TemplatePicker } from "@/components/TemplatePicker";
import { Button } from "@/components/ui/button";
import { useStore } from "@/store/AppStore";
import { BASE_RESUME, type Resume } from "@/data/user";
import { TARGET_FIELDS } from "@/data/translator";
import { RESUME_TEMPLATES, renderResumeHtml } from "@/data/resumeTemplates";
import { measureInFrame } from "@/lib/fit";
import { PAGE_H } from "@/lib/resumeFormat";
import { withManualEdits, type BuiltResume } from "@/lib/resumeBuild";
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
  const targetMeta = TARGET_FIELDS.find((t) => t.id === target) ?? TARGET_FIELDS[0];
  const goal = state.prefs.targetOther?.trim() || targetMeta.label;

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
        sub={`Three lines from your own resume, rewritten in ${goal.toLowerCase()} language. Nothing is added: these only rename work you already did.`}
      />
      <div className="card-base mb-5 flex flex-wrap items-center gap-x-3 gap-y-1 p-4 text-sm">
        <span className="text-muted-foreground">Translating</span>
        <span className="font-medium">{prev || "your experience"}</span>
        <ArrowRight className="h-4 w-4 text-primary" aria-hidden />
        <span className="font-medium">{goal}</span>
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
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary">{goal} language</div>
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

/* ---------------- Choose a design, and see the resume as it will look ---------------- */

/** Three layouts, so this page stays clean. All of them are in the Studio later, along with nine more. */
const DESIGNS = ["rail", "classic", "minimal"];

const asBuilt = (r: Resume): BuiltResume => ({ ...r, certsOwnSection: r.certifications.length > 0, changedIds: new Set(), editedIds: new Set() });
const stripBuilt = (b: BuiltResume): Resume => {
  const { certsOwnSection: _c, changedIds: _a, editedIds: _e, ...rest } = b;
  return rest as Resume;
};

/**
 * The resume, laid out. It can be looked at and it can be changed, but not downloaded: the download comes
 * with the first tailored resume, once they have made an account.
 */
export function LiveStepDesign({ resume, setResume }: { resume: Resume; setResume: (r: Resume) => void }) {
  const { state, update } = useStore();
  const [mode, setMode] = useState<"preview" | "edit">("preview");
  const [pages, setPages] = useState(1);
  const templateId = DESIGNS.includes(state.resume.templateId) ? state.resume.templateId : DESIGNS[0];
  const built = useMemo(() => asBuilt(resume), [resume]);
  const html = renderResumeHtml(built, templateId, "Your resume", state.profile.headline, undefined, true);

  useEffect(() => {
    let alive = true;
    void measureInFrame(html).then((h) => alive && setPages(Math.min(3, Math.max(1, Math.ceil((h - 8) / PAGE_H)))));
    return () => {
      alive = false;
    };
  }, [html]);

  const edit = (fieldId: string, value: string) => setResume(stripBuilt(withManualEdits(built, { fields: { [fieldId]: value } })));
  const editContact = (f: "name" | "email" | "phone" | "location", value: string) => setResume({ ...resume, [f]: value });

  return (
    <div className="card-base mt-8 space-y-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">Your resume, laid out</h2>
          <p className="text-sm text-muted-foreground">Pick a design, look it over, and change anything that is not right.</p>
        </div>
        <Segmented<"preview" | "edit"> value={mode} onChange={setMode} options={[{ value: "preview", label: "Preview" }, { value: "edit", label: "Edit" }]} />
      </div>

      <TemplatePicker
        label="Design"
        items={RESUME_TEMPLATES.filter((t) => DESIGNS.includes(t.id)).map((t) => ({ id: t.id, name: t.name, blurb: t.blurb, bestFor: t.bestFor, html: renderResumeHtml(built, t.id, t.name, state.profile.headline) }))}
        value={templateId}
        onChange={(id) => update((d) => void (d.resume.templateId = id))}
      />

      {mode === "preview" ? <PagePreview html={html} pages={pages} /> : <ResumeDocument r={built} highlight={false} onEdit={edit} onContactEdit={editContact} />}

      <p className="text-xs text-muted-foreground">You can download your resume in the next steps, once it is tailored to a job you pick.</p>
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

/** A match this strong is worth someone's first resume. */
const STRONG = 80;

export function LiveStepResults({ headingRef, onFinish }: { headingRef: HRef; onFinish: () => void }) {
  const { state, update } = useStore();
  const nav = useNavigate();
  const { flushProfile, user } = useLive();
  const guest = !!user?.is_anonymous;
  const [progress, setProgress] = useState<Progress>({ stage: "search", message: "Starting" });
  const [jobs, setJobs] = useState<Job[]>([]);
  const [phase, setPhase] = useState<"running" | "done" | "error">("running");
  const [error, setError] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
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

  const real = jobs.filter((j) => !j.imported && j.legit.score >= state.legitThreshold && j.legit.badge !== "ghost");
  const strong = real.filter((j) => j.match >= STRONG).sort((a, b) => b.match - a.match).slice(0, 8);
  // If nothing reaches 80 we say so, and show the best there is with its real score. We never dress a score up.
  const shown = strong.length ? strong : [...real].sort((a, b) => b.match - a.match).slice(0, 3);
  const current = ORDER.indexOf(progress.stage);
  const choice = shown.find((j) => j.id === picked) ?? shown[0];

  const writeResume = async () => {
    if (!choice) return;
    update((s) => void (s.onboarded = true));
    await flushProfile();
    nav(`/first-resume?job=${encodeURIComponent(choice.id)}&tailor=1`);
  };

  if (phase === "running" || phase === "error") {
    return (
      <div className="mx-auto max-w-lg py-6">
        <h1 ref={headingRef} tabIndex={-1} className="mb-2 font-display text-3xl font-semibold outline-none">
          Finding your first matches
        </h1>
        <p className="mb-6 text-sm text-muted-foreground">This is real. We are pulling live listings near you and reading each one against your resume. It takes about 30 seconds.</p>
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
                        Found <b className="num text-foreground">{progress.found}</b> listings
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

  if (shown.length === 0) {
    return (
      <div className="mx-auto max-w-lg py-10 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Search className="h-6 w-6 text-muted-foreground" />
        </div>
        <h1 ref={headingRef} tabIndex={-1} className="font-display text-3xl font-semibold outline-none">
          No matches came back
        </h1>
        <p className="mt-2 text-muted-foreground">{progress.message !== "Done" ? progress.message : "Try broader role titles, or a longer distance, then search again."}</p>
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Button variant="outline" onClick={() => void run()}>
            <RefreshCcw /> Search again
          </Button>
          {!guest && <Button onClick={onFinish}>Go to the app anyway</Button>}
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
          {strong.length ? "Your experience counts in more places than you think." : "Here are your strongest matches so far."}
        </h1>
        <p className="mx-auto mt-2 max-w-xl text-muted-foreground">
          {strong.length ? `${strong.length} real job${strong.length === 1 ? "" : "s"} near you scored ${STRONG}% or higher against your resume.` : `No listing reached ${STRONG}% today, so these are the best there is, with their real scores. Your matches will grow as new jobs come in.`}
        </p>
      </div>

      <div role="radiogroup" aria-label="Choose a job for your first resume" className="space-y-2.5">
        {shown.map((j) => {
          const on = choice?.id === j.id;
          return (
            <button key={j.id} role="radio" aria-checked={on} onClick={() => setPicked(j.id)} className={cn("card-base flex w-full items-center gap-4 p-4 text-left transition-all", on ? "border-primary ring-2 ring-primary/20" : "hover:border-primary/40")}>
              <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2", on ? "border-primary bg-primary text-primary-foreground" : "border-input")}>{on && <Check className="h-3 w-3" strokeWidth={3} />}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{j.title}</span>
                <span className="block truncate text-sm text-muted-foreground">
                  {j.company.name} <span aria-hidden>·</span> <MapPin className="mb-0.5 inline h-3 w-3" aria-hidden /> {j.location}
                  {j.distanceMiles != null && j.mode !== "Remote" ? ` · ${j.distanceMiles < 1 ? "under a mile" : `${j.distanceMiles} mi`} away` : ""}
                  {j.mode === "Remote" ? " · Remote" : ""}
                </span>
                {j.why && <span className="mt-1 line-clamp-2 block text-xs text-foreground/70">{j.why}</span>}
              </span>
              <ScoreRing value={j.match} size={48} sub="match" label={`${j.match} percent match`} />
            </button>
          );
        })}
      </div>

      {choice && (
        <div className="mt-8 rounded-2xl border border-primary/30 bg-primary-soft/50 p-5 text-center">
          <h2 className="font-display text-xl font-semibold">Your first resume is on us.</h2>
          <p className="mx-auto mt-1 max-w-lg text-sm text-foreground/80">
            We will tailor your resume for {choice.title} at {choice.company.name}: reordering, rewording, and re-emphasizing what you already have. You look it over, make your final changes, preview it, and download it.
          </p>
          <Button size="lg" className="mt-4" onClick={() => void writeResume()}>
            <Sparkles /> Write my resume for {choice.company.name}
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">Your original stays exactly as it is. You will make a free account to download it.</p>
        </div>
      )}

      {!guest && (
        <div className="mt-6 flex flex-col items-center gap-3">
          <Button size="lg" variant="outline" onClick={onFinish}>
            <Rocket /> Skip to my plan
          </Button>
        </div>
      )}
    </div>
  );
}
