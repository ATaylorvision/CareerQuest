import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Award, Briefcase, CheckCircle2, FileUp, Flame, GraduationCap, Leaf, Loader2, Plus, RefreshCcw, Trash2, Undo2, UserRound, X, Zap } from "lucide-react";
import { AiWorking, Chip, Logo, Segmented, SkeletonLines } from "@/components/common";
import { PlacePicker } from "@/components/PlacePicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStore, type Situation } from "@/store/AppStore";
import { BASE_RESUME, setBaseResume, type Resume } from "@/data/user";
import { api, fileToBase64 } from "@/live/api";
import { supabase } from "@/live/supabase";
import { saveConfirmedPlace } from "@/live/place";
import { BASE_VERSION, useLive } from "@/live/LiveProvider";
import { ResumeBuilder } from "./ResumeBuilder";
import { LiveStepDesign, LiveStepResults, LiveStepTranslator } from "./LiveSteps";
import { TARGET_FIELDS } from "@/data/translator";
import { INTENSITY_META, type Intensity } from "@/data/plan";
import { cn } from "@/lib/utils";
import { useDocTitle } from "@/hooks/useDocTitle";
import type { TargetField } from "@/data/jobs";

const STEPS = ["Resume", "Career", "Translator", "Targets", "Pace", "Matches"];

/**
 * Setup. Anyone can start it: a visitor gets a temporary guest account behind the scenes, and when they
 * sign up to download their first resume that same account becomes theirs, so nothing has to be moved.
 */
export default function Onboarding() {
  useDocTitle("Set up");
  const { state, update } = useStore();
  const nav = useNavigate();
  const { phase, user, flushProfile } = useLive();
  const [step, setStep] = useState(0);
  const [parsed, setParsed] = useState<Resume | null>(state.uploadedFileName && BASE_RESUME.roles.length ? structuredClone(BASE_RESUME) : null);
  const [saving, setSaving] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const started = useRef(false);

  // No account yet? Make a guest one, so the visitor can try the real thing before signing up.
  useEffect(() => {
    if (phase !== "ready" || user || started.current || !supabase) return;
    started.current = true;
    void supabase.auth.signInAnonymously().then(({ error }) => {
      if (error) setUnavailable(true);
    });
  }, [phase, user]);

  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  const hasRoles = state.prefs.roles.length > 0;
  const hasSomewhere = state.prefs.remote === "remote" || !!state.profile.locationConfirmed;
  const other = state.prefs.targetOther;
  const canNext = step === 0 ? !!parsed && !!state.profile.locationConfirmed && parsed.roles.length > 0 : step === 1 ? other === undefined || other.trim().length >= 3 : step === 3 ? hasRoles && hasSomewhere : true;
  const pct = Math.round((step / (STEPS.length - 1)) * 100);

  /** Writes the resume, including any education, certifications and licenses the person added. */
  const saveResume = async (r: Resume) => {
    setBaseResume(r);
    if (!supabase) return;
    const uid = (await supabase.auth.getUser()).data.user?.id;
    if (!uid) return;
    const { data } = await supabase.from("resumes").update({ parsed: r, updated_at: new Date().toISOString() }).eq("user_id", uid).eq("is_base", true).select("id");
    // Someone who built their resume here has no row yet, because nothing was uploaded.
    if (!data?.length) await supabase.from("resumes").insert({ user_id: uid, file_name: state.uploadedFileName ?? "Built in CareerQuest", parsed: r, is_base: true });
  };

  const goNext = async () => {
    if (step === 0 && parsed) {
      setSaving(true);
      // The summary is written for them from what they did, so nobody starts from a blank box.
      let next = parsed;
      try {
        const out = await api<{ summary: string }>("studio", { action: "summary", resume: { summary: "", skills: parsed.skills, roles: parsed.roles.map((r) => ({ id: r.id, title: r.title, company: r.company, bullets: r.bullets.map((b) => ({ id: b.id, text: b.text })) })) }, target: state.prefs.targetOther ?? "" });
        if (out.summary) next = { ...parsed, summary: out.summary };
      } catch {
        /* the summary is a nicety; setup goes on without it */
      }
      setParsed(next);
      await saveResume(next);
      update((s) => {
        if (!s.profile.name && next.name) s.profile.name = next.name;
        if (!s.profile.headline && next.roles[0]?.title) s.profile.headline = next.roles[0].title;
        if (s.prefs.roles.length === 0) s.prefs.roles = Array.from(new Set(next.roles.map((r) => r.title.trim()).filter(Boolean))).slice(0, 3);
      });
      setSaving(false);
    }
    if (step === 2 && parsed) {
      // Edits made on the design step are saved with everything else.
      setSaving(true);
      await saveResume(parsed);
      setSaving(false);
    }
    if (step >= 1) await flushProfile();
    setStep(step + 1);
  };

  const finish = () => {
    update((s) => void (s.onboarded = true));
    nav("/app");
  };

  if (unavailable && !user) {
    return (
      <div className="min-h-screen bg-canvas">
        <main className="mx-auto max-w-md px-4 py-20 text-center">
          <Logo to="/" />
          <h1 className="mt-8 font-display text-3xl font-semibold">Let us set up your account first</h1>
          <p className="mt-2 text-muted-foreground">We could not start a quick setup for you just now. Create your free account, and you can carry straight on.</p>
          <Button asChild size="lg" className="mt-6">
            <Link to="/signup">Create my free account</Link>
          </Button>
          <p className="mt-3 text-sm text-muted-foreground">
            Already have one?{" "}
            <Link to="/login" className="font-medium text-primary hover:underline">
              Log in
            </Link>
          </p>
        </main>
      </div>
    );
  }

  if (!user || !state.authed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas" role="status">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> Getting things ready
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-4 px-4">
          <Logo compact to="/" />
          <div className="flex-1">
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-medium">
                Step {step + 1} of {STEPS.length}: {STEPS[step]}
              </span>
              <span className="num text-muted-foreground">{pct}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Setup progress">
              <div className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out" style={{ width: `${Math.max(4, pct)}%` }} />
            </div>
          </div>
        </div>
        <ol className="mx-auto hidden max-w-4xl gap-1 px-4 pb-2 sm:flex" aria-label="Setup steps">
          {STEPS.map((s, i) => (
            <li key={s} className="flex-1">
              <button
                disabled={i > step}
                onClick={() => i < step && setStep(i)}
                className={cn("w-full rounded-md px-1 py-1 text-center text-[11px] font-medium transition-colors", i === step ? "text-primary" : i < step ? "text-foreground hover:bg-accent" : "text-muted-foreground/60")}
                aria-current={i === step ? "step" : undefined}
              >
                {i < step && <CheckCircle2 className="mr-1 inline h-3 w-3 text-success" aria-hidden />}
                {s}
              </button>
            </li>
          ))}
        </ol>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:py-10">
        <div key={step} className="page-enter">
          {step === 0 && <StepResume headingRef={headingRef} parsed={parsed} setParsed={setParsed} />}
          {step === 1 && <StepCareer headingRef={headingRef} />}
          {step === 2 && <LiveStepTranslator headingRef={headingRef} onBack={() => setStep(1)} />}
          {step === 2 && parsed && <LiveStepDesign resume={parsed} setResume={setParsed} />}
          {step === 3 && <StepTargets headingRef={headingRef} />}
          {step === 4 && <StepIntensity headingRef={headingRef} />}
          {step === 5 && <LiveStepResults headingRef={headingRef} onFinish={finish} />}
        </div>

        {step < 5 && (
          <div className="sticky bottom-0 -mx-4 mt-10 flex items-center justify-between border-t bg-canvas/95 px-4 py-4 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0">
            <Button variant="ghost" onClick={() => (step === 0 ? nav("/") : setStep(step - 1))}>
              <ArrowLeft /> {step === 0 ? "Exit" : "Back"}
            </Button>
            <div className="flex items-center gap-3">
              {step === 0 && parsed && !state.profile.locationConfirmed && <span className="hidden text-xs text-warning sm:inline">Confirm where you live to continue</span>}
              <Button size="lg" disabled={!canNext || saving} onClick={() => void goNext()}>
                {saving ? <Loader2 className="animate-spin" /> : null}
                {step === 4 ? "Find my matches" : "Continue"} <ArrowRight />
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

type HRef = { headingRef: React.RefObject<HTMLHeadingElement> };

function StepHeading({ headingRef, title, sub }: HRef & { title: string; sub?: string }) {
  return (
    <div className="mb-7">
      <h1 ref={headingRef} tabIndex={-1} className="font-display text-3xl font-semibold outline-none sm:text-4xl text-balance">
        {title}
      </h1>
      {sub && <p className="mt-2 max-w-2xl text-muted-foreground">{sub}</p>}
    </div>
  );
}

/* ---------------- Step 1: resume ---------------- */

const newId = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

function StepResume({ headingRef, parsed, setParsed }: HRef & { parsed: Resume | null; setParsed: (r: Resume | null) => void }) {
  const { state, update } = useStore();
  const [building, setBuilding] = useState(false);
  const [drag, setDrag] = useState(false);
  const [parsing, setParsing] = useState<string | null>(null);
  const [newSkill, setNewSkill] = useState("");
  const input = useRef<HTMLInputElement>(null);

  const confirmPlace = async (p: { label: string; lat: number; lng: number }): Promise<void> => {
    const ok = await saveConfirmedPlace({ ...p, detail: "" });
    if (!ok) {
      toast.error("We could not save that place. Please try again.");
      return;
    }
    update((s) => {
      s.profile.location = p.label;
      s.profile.locationConfirmed = true;
    });
    if (parsed) setParsed({ ...parsed, location: p.label });
  };

  const parseReal = async (f: File) => {
    if (f.size > 3_000_000) {
      toast.error("That file is over 3 MB", { description: "Try a smaller PDF or Word file." });
      return;
    }
    setParsed(null);
    setParsing(f.name);
    try {
      const data = await fileToBase64(f);
      const out = await api<{ resume: Resume & { current_field?: string } }>("resume/parse", { fileName: f.name, mime: f.type, data });
      const r = out.resume;
      setBaseResume(r);
      setParsed(r);
      update((s) => {
        s.uploadedFileName = f.name;
        if (!s.profile.name) s.profile.name = r.name;
        if (!s.prefs.prevField && r.current_field) s.prefs.prevField = r.current_field;
        s.resume.versions = [{ ...BASE_VERSION }, ...s.resume.versions.filter((v) => v.id !== "v-base")];
        s.resume.activeVersionId = "v-base";
      });
    } catch (e) {
      toast.error("We could not read that file", { description: (e as Error).message });
    } finally {
      setParsing(null);
    }
  };

  const onFiles = (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    if (!/\.(pdf|docx|txt)$/i.test(f.name)) {
      toast.error("That file type will not work", { description: "Use a PDF, a Word .docx, or a plain text file." });
      return;
    }
    void parseReal(f);
  };

  const edit = (fn: (r: Resume) => void) => {
    const r = structuredClone(parsed!);
    fn(r);
    setParsed(r);
  };

  return (
    <div>
      <StepHeading
        headingRef={headingRef}
        title="Start with your resume"
        sub={building ? "No file needed. Answer what you can, in your own words. We will only ever use what you put here." : "We read it once, then show you exactly what we found. Fix anything we got wrong. We will only ever use what is here."}
      />

      {building && !parsed && (
        <ResumeBuilder
          onCancel={() => setBuilding(false)}
          onDone={(r) => {
            setBaseResume(r);
            setParsed(r);
            setBuilding(false);
            update((s) => {
              s.uploadedFileName = "Built in CareerQuest";
              if (!s.profile.name) s.profile.name = r.name;
              s.resume.versions = [{ ...BASE_VERSION }, ...s.resume.versions.filter((v) => v.id !== "v-base")];
              s.resume.activeVersionId = "v-base";
            });
          }}
        />
      )}

      {!building && !parsed && !parsing && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            onFiles(e.dataTransfer.files);
          }}
          className={cn("flex flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-background px-6 py-14 text-center transition-all", drag ? "scale-[1.01] border-primary bg-primary-soft" : "border-input hover:border-primary/50")}
        >
          <div className={cn("mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary transition-transform", drag && "scale-110")}>
            <FileUp className="h-7 w-7" />
          </div>
          <div className="text-lg font-semibold">{drag ? "Drop it here" : "Drag your resume here"}</div>
          <p className="mt-1 text-sm text-muted-foreground">PDF, Word (.docx), or plain text. Up to 3 MB.</p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Button onClick={() => input.current?.click()}>Choose a file</Button>
            <Button variant="outline" onClick={() => setBuilding(true)}>
              I do not have one yet
            </Button>
          </div>
          <input ref={input} type="file" accept=".pdf,.docx,.txt" className="sr-only" onChange={(e) => onFiles(e.target.files)} aria-label="Upload resume file" />
          <p className="mt-5 max-w-md text-xs text-muted-foreground">Your resume is read by AI and saved privately. It is never shown to an employer unless you apply.</p>
        </div>
      )}

      {parsing && (
        <div className="card-base grid grid-cols-1 gap-8 p-6 sm:grid-cols-[1fr_1.2fr]">
          <AiWorking title={`Reading ${parsing}`} steps={["Opening the file", "Finding roles, companies, and dates", "Pulling out each bullet point", "Collecting skills, education and certifications", "Double checking numbers"]} stepMs={2600} hold />
          <div className="space-y-4">
            <SkeletonLines lines={2} />
            <SkeletonLines lines={5} />
            <SkeletonLines lines={3} />
          </div>
        </div>
      )}

      {parsed && (
        <div className="space-y-5 animate-fade-up">
          <div className="flex flex-col gap-3 rounded-xl border border-success-border bg-success-soft p-4 sm:flex-row sm:items-center">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
            <div className="flex-1 text-sm">
              <span className="font-semibold text-success">Read {state.uploadedFileName ?? "your resume"}.</span> We found {parsed.roles.length} job{parsed.roles.length === 1 ? "" : "s"}, {parsed.roles.reduce((n, r) => n + r.bullets.length, 0)} lines, {parsed.skills.length} skill{parsed.skills.length === 1 ? "" : "s"}, {parsed.education.length} education entr{parsed.education.length === 1 ? "y" : "ies"} and {parsed.certifications.length} certification{parsed.certifications.length === 1 ? "" : "s"} or license{parsed.certifications.length === 1 ? "" : "s"}. Everything below can be changed.
            </div>
            <Button variant="outline" size="sm" onClick={() => setParsed(null)}>
              <RefreshCcw /> Use a different file
            </Button>
          </div>

          <div className="card-base space-y-5 p-5 sm:p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">You</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {(["name", "email", "phone"] as const).map((k) => (
                <div key={k} className="space-y-1.5">
                  <Label htmlFor={`p-${k}`} className="capitalize">
                    {k}
                  </Label>
                  <Input id={`p-${k}`} value={parsed[k]} onChange={(e) => edit((r) => void (r[k] = e.target.value))} />
                </div>
              ))}
            </div>
            <PlacePicker prominent value={state.profile.location} confirmed={!!state.profile.locationConfirmed} onConfirm={confirmPlace} label="Where do you live?" />
          </div>

          {/* The summary is not asked for. We write it from what follows. */}

          {parsed.roles.map((r, ri) => (
            <div key={r.id} className="card-base p-5 sm:p-6">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1.4fr_1.2fr_0.7fr_0.7fr]">
                {(
                  [
                    ["title", "Title"],
                    ["company", "Company"],
                    ["start", "Start"],
                    ["end", "End"],
                  ] as const
                ).map(([k, label]) => (
                  <div key={k} className="space-y-1.5">
                    <Label htmlFor={`${r.id}-${k}`}>{label}</Label>
                    <Input id={`${r.id}-${k}`} value={r[k]} onChange={(e) => edit((x) => void (x.roles[ri][k] = e.target.value))} />
                  </div>
                ))}
              </div>
              <div className="mt-4 space-y-2">
                {r.bullets.map((b, bi) => (
                  <div key={b.id} className="group flex items-start gap-2">
                    <span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                    <Textarea aria-label={`Line ${bi + 1} for ${r.title}`} rows={2} value={b.text} onChange={(e) => edit((x) => void (x.roles[ri].bullets[bi].text = e.target.value))} className="min-h-0 resize-none text-sm" />
                    <Button variant="ghost" size="icon-sm" className="mt-1 opacity-60 group-hover:opacity-100" onClick={() => edit((x) => void x.roles[ri].bullets.splice(bi, 1))} aria-label="Remove this line">
                      <Trash2 />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => edit((x) => void x.roles[ri].bullets.push({ id: newId("nb"), text: "" }))}>
                  <Plus /> Add a line about this job
                </Button>
                <Button size="sm" variant="ghost" onClick={() => edit((x) => void x.roles.splice(ri, 1))}>
                  <Trash2 /> Remove this job
                </Button>
              </div>
            </div>
          ))}
          <Button variant="outline" onClick={() => edit((x) => void x.roles.push({ id: newId("role"), title: "", company: "", location: "", start: "", end: "", bullets: [{ id: newId("nb"), text: "" }] }))}>
            <Briefcase /> Add a job
          </Button>

          <div className="card-base p-5 sm:p-6">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Skills</h2>
            <div className="flex flex-wrap gap-2">
              {parsed.skills.map((s) => (
                <span key={s} className="inline-flex items-center gap-1 rounded-full border bg-muted/50 py-1 pl-3 pr-1 text-sm">
                  {s}
                  <button onClick={() => edit((x) => void (x.skills = x.skills.filter((y) => y !== s)))} className="rounded-full p-1 text-muted-foreground hover:bg-background hover:text-foreground" aria-label={`Remove ${s}`}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (newSkill.trim()) edit((x) => void x.skills.push(newSkill.trim()));
                setNewSkill("");
              }}
            >
              <Input value={newSkill} onChange={(e) => setNewSkill(e.target.value)} placeholder="Add a skill you actually have" aria-label="Add a skill" />
              <Button type="submit" variant="outline">
                <Plus /> Add
              </Button>
            </form>
          </div>

          <div className="card-base grid grid-cols-1 gap-6 p-5 sm:p-6 md:grid-cols-2">
            <LineEditor label="Education" icon={GraduationCap} values={parsed.education} onChange={(v) => edit((x) => void (x.education = v))} placeholder="Degree, school, year" />
            <div>
              <LineEditor label="Certifications and licenses" icon={Award} values={parsed.certifications} onChange={(v) => edit((x) => void (x.certifications = v))} placeholder="Certification or license, year" />
              <p className="mt-2 text-xs text-muted-foreground">Professional licenses, safety cards, and software certificates all count. These often decide who gets called.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** A plain list of one line entries. Unlike TagEditor, these are sentences rather than chips. */
function LineEditor({ label, icon: Icon, values, onChange, placeholder }: { label: string; icon: React.ComponentType<{ className?: string }>; values: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [v, setV] = useState("");
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Icon className="h-4 w-4 text-primary" />
        {label}
      </div>
      {values.length === 0 && <p className="text-sm text-muted-foreground">Nothing found on your resume. Add anything you have.</p>}
      <ul className="space-y-1.5">
        {values.map((e, i) => (
          <li key={`${e}-${i}`} className="flex items-start gap-2 rounded-lg border bg-background px-3 py-2 text-sm">
            <span className="flex-1">{e}</span>
            <button type="button" onClick={() => onChange(values.filter((_, j) => j !== i))} className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:text-danger" aria-label={`Remove ${e}`}>
              <X className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const t = v.trim();
          if (t && !values.includes(t)) onChange([...values, t]);
          setV("");
        }}
      >
        <Input value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} aria-label={placeholder} className="h-9" />
        <Button type="submit" variant="outline" size="sm">
          <Plus /> Add
        </Button>
      </form>
    </div>
  );
}

/* ---------------- Step 2: career ---------------- */

const SITUATIONS: { id: Situation; title: string; body: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "changer", title: "Career changer", body: "I want to move into a different field.", icon: RefreshCcw },
  { id: "laidoff", title: "Recently laid off", body: "My role was cut and I am restarting.", icon: Undo2 },
  { id: "employed", title: "Employed and looking", body: "I have a job but want something better.", icon: Briefcase },
  { id: "returning", title: "Returning to work", body: "I have been out for a while by choice.", icon: UserRound },
];

/** Careers people ask about that are not one of our five fields. Each maps to the nearest field so the translator has something to work with. */
const CAREER_IDEAS: { label: string; closest: TargetField }[] = [
  { label: "Human resources", closest: "program" },
  { label: "Project management", closest: "project" },
  { label: "Data analysis", closest: "program" },
  { label: "Marketing", closest: "program" },
  { label: "Product management", closest: "program" },
  { label: "Sales", closest: "cs" },
  { label: "Account management", closest: "cs" },
  { label: "Recruiting", closest: "program" },
  { label: "Finance and accounting", closest: "program" },
  { label: "IT support", closest: "program" },
  { label: "Education and training", closest: "program" },
  { label: "Real estate", closest: "cs" },
  { label: "Skilled trades", closest: "supply" },
  { label: "Transportation and delivery", closest: "supply" },
  { label: "Hospitality management", closest: "cs" },
  { label: "Nonprofit and community work", closest: "program" },
];

const OTHER = "__other";

function StepCareer({ headingRef }: HRef) {
  const { state, update } = useStore();
  const p = state.prefs;
  // An empty string means "something else" was chosen and the words have not been typed yet.
  const showOther = p.targetOther !== undefined;

  return (
    <div>
      <StepHeading headingRef={headingRef} title="What is your situation, and where do you want to go?" />
      <div role="radiogroup" aria-label="Your situation" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {SITUATIONS.map((s) => {
          const on = p.situation === s.id;
          return (
            <button key={s.id} role="radio" aria-checked={on} onClick={() => update((d) => void (d.prefs.situation = s.id))} className={cn("card-base card-hover flex gap-4 p-5 text-left", on && "border-primary ring-2 ring-primary/20")}>
              <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors", on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                <s.icon className="h-5 w-5" />
              </span>
              <span>
                <span className="block font-semibold">{s.title}</span>
                <span className="block text-sm text-muted-foreground">{s.body}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="card-base mt-5 space-y-5 p-5 sm:p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="prev-field">I am coming from</Label>
            <Input id="prev-field" value={p.prevField} onChange={(e) => update((d) => void (d.prefs.prevField = e.target.value))} placeholder="For example: retail operations" />
          </div>
          <ArrowRight className="mx-auto hidden h-5 w-5 text-primary sm:mb-2.5 sm:block" aria-hidden />
          <div className="space-y-1.5">
            <Label htmlFor="target-field">I want to move into</Label>
            <Select
              value={showOther ? OTHER : p.targetField}
              onValueChange={(v) => {
                if (v === OTHER) update((d) => void (d.prefs.targetOther = d.prefs.targetOther ?? ""));
                else {
                  update((d) => {
                    d.prefs.targetField = v;
                    d.prefs.targetOther = undefined;
                  });
                }
              }}
            >
              <SelectTrigger id="target-field">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TARGET_FIELDS.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.label}
                  </SelectItem>
                ))}
                <SelectItem value={OTHER}>Something else, I will tell you</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {showOther && (
          <div className="space-y-3 rounded-xl bg-muted/40 p-4 animate-fade-up">
            <div className="space-y-1.5">
              <Label htmlFor="target-other">What career are you looking to get into?</Label>
              <Input id="target-other" value={p.targetOther ?? ""} onChange={(e) => update((d) => void (d.prefs.targetOther = e.target.value))} placeholder="For example: human resources, or data analysis" />
            </div>
            <div>
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">Or pick one that is close</div>
              <div className="flex flex-wrap gap-2">
                {CAREER_IDEAS.map((c) => (
                  <Chip
                    key={c.label}
                    active={p.targetOther === c.label}
                    onClick={() =>
                      update((d) => {
                        d.prefs.targetOther = c.label;
                        d.prefs.targetField = c.closest;
                      })
                    }
                  >
                    {c.label}
                  </Chip>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="closest">Which of these is closest to it?</Label>
              <Select value={p.targetField} onValueChange={(v) => update((d) => void (d.prefs.targetField = v))}>
                <SelectTrigger id="closest">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TARGET_FIELDS.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">This only decides the language we translate your experience into. Your own words are what we search for.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- Step 4: targets ---------------- */

const ROLE_SUGGESTIONS: Record<string, string[]> = {
  supply: ["Operations Manager", "Supply Chain Analyst", "Inventory Control Manager", "Logistics Coordinator", "Supply Chain Planner", "Fulfillment Operations Manager"],
  program: ["Program Operations Manager", "Program Coordinator", "Associate Program Manager", "Sales Operations Analyst"],
  cs: ["Customer Success Manager", "Implementation Specialist", "Client Operations Manager"],
  health: ["Practice Operations Manager", "Clinic Operations Coordinator", "Patient Access Supervisor"],
  project: ["Project Coordinator", "Operations Project Coordinator", "PMO Coordinator"],
};
const MUST_SUGGEST = ["Health insurance from day one", "Under 45 minute commute or remote", "Salary range listed", "Paid time off in year one", "Room to move up"];
const DEAL_SUGGEST = ["Commission only pay", "Overnight shifts", "More than 25% travel", "Contract only", "Unpaid trial work"];

function TagEditor({ label, values, suggestions, onChange, placeholder }: { label: string; values: string[]; suggestions: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [v, setV] = useState("");
  const toggle = (s: string) => onChange(values.includes(s) ? values.filter((x) => x !== s) : [...values, s]);
  const all = Array.from(new Set([...values, ...suggestions]));
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">{label}</div>
      <div className="flex flex-wrap gap-2">
        {all.map((s) => (
          <Chip key={s} active={values.includes(s)} onClick={() => toggle(s)}>
            {values.includes(s) && <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />}
            {s}
          </Chip>
        ))}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (v.trim() && !values.includes(v.trim())) onChange([...values, v.trim()]);
          setV("");
        }}
      >
        <Input value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} aria-label={placeholder} className="h-9" />
        <Button type="submit" variant="outline" size="sm">
          <Plus /> Add
        </Button>
      </form>
    </div>
  );
}

function StepTargets({ headingRef }: HRef) {
  const { state, update } = useStore();
  const p = state.prefs;
  const suggestions = [...(p.targetOther ? [p.targetOther] : []), ...(ROLE_SUGGESTIONS[p.targetField] ?? [])];
  return (
    <div>
      <StepHeading headingRef={headingRef} title="What are you aiming for?" sub="Most of this is already filled in from your resume. You can change all of it later in Settings." />
      <div className="space-y-5">
        <div className="card-base p-5 sm:p-6">
          <TagEditor label="Target roles" values={p.roles} suggestions={suggestions} onChange={(v) => update((d) => void (d.prefs.roles = v))} placeholder="Add a role title" />
        </div>
        <WhereBlock />
        <PayBlock />
        <div className="card-base grid grid-cols-1 gap-6 p-5 sm:p-6 md:grid-cols-2">
          <TagEditor label="Must haves" values={p.mustHaves} suggestions={MUST_SUGGEST} onChange={(v) => update((d) => void (d.prefs.mustHaves = v))} placeholder="Add a must have" />
          <TagEditor label="Dealbreakers" values={p.dealbreakers} suggestions={DEAL_SUGGEST} onChange={(v) => update((d) => void (d.prefs.dealbreakers = v))} placeholder="Add a dealbreaker" />
        </div>
      </div>
    </div>
  );
}

function WhereBlock() {
  const { state, update } = useStore();
  const p = state.prefs;
  const commutes = p.remote !== "remote";
  const anyDistance = p.maxDistanceMiles >= 100;
  const confirmPlace = async (pl: { label: string; lat: number; lng: number }): Promise<void> => {
    if (!(await saveConfirmedPlace({ ...pl, detail: "" }))) {
      toast.error("We could not save that place. Please try again.");
      return;
    }
    update((s) => {
      s.profile.location = pl.label;
      s.profile.locationConfirmed = true;
    });
  };

  return (
    <div className="card-base space-y-6 p-5 sm:p-6">
      <div className="space-y-2">
        <div className="text-sm font-medium">How do you want to work?</div>
        <Segmented<"any" | "remote" | "hybrid" | "onsite">
          value={p.remote}
          onChange={(v) => update((d) => void (d.prefs.remote = v))}
          options={[
            { value: "any", label: "Open to all" },
            { value: "remote", label: "Remote only" },
            { value: "hybrid", label: "Hybrid" },
            { value: "onsite", label: "Onsite" },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <PlacePicker value={state.profile.location} confirmed={!!state.profile.locationConfirmed} onConfirm={confirmPlace} label="Home base" />

        {commutes && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium" id="dist-label">
                Max distance
              </span>
              <span className="num font-semibold">{anyDistance ? "Any distance" : `${p.maxDistanceMiles} miles`}</span>
            </div>
            <Slider aria-labelledby="dist-label" value={[p.maxDistanceMiles]} min={5} max={100} step={5} onValueChange={([v]) => update((d) => void (d.prefs.maxDistanceMiles = v))} />
          </div>
        )}
      </div>

      <div className="border-t pt-5">
        <TagEditor label="Anywhere else you would work" values={p.locations} suggestions={[state.profile.location, "Remote (US)"].filter(Boolean)} onChange={(v) => update((d) => void (d.prefs.locations = v))} placeholder="Add a city, or Remote" />
      </div>
    </div>
  );
}

const PAY_MIN = 30000;
const PAY_MAX = 200000;

function PayBlock() {
  const { state, update } = useStore();
  const p = state.prefs;
  const lo = p.salaryFloor;
  const hi = Math.max(lo + 5000, p.salaryCeiling ?? 150000);
  return (
    <div className="card-base space-y-3 p-5 sm:p-6">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium" id="pay-label">
          Salary range
        </span>
        <span className="num font-semibold">
          ${lo.toLocaleString()} to ${hi.toLocaleString()}
          {hi >= PAY_MAX ? "+" : ""}
        </span>
      </div>
      <Slider
        aria-labelledby="pay-label"
        value={[lo, hi]}
        min={PAY_MIN}
        max={PAY_MAX}
        step={5000}
        minStepsBetweenThumbs={1}
        onValueChange={([a, b]) =>
          update((d) => {
            d.prefs.salaryFloor = a;
            d.prefs.salaryCeiling = b;
          })
        }
      />
      <p className="text-xs text-muted-foreground">Jobs that pay less than the low end are left out. Many listings do not say what they pay, and we still show those.</p>
    </div>
  );
}

/* ---------------- Step 5: pace ---------------- */

const INTENSITY_ICON: Record<Intensity, React.ComponentType<{ className?: string }>> = { casual: Leaf, active: Zap, urgent: Flame };

function StepIntensity({ headingRef }: HRef) {
  const { state, update } = useStore();
  return (
    <div>
      <StepHeading headingRef={headingRef} title="How hard do you want to push?" />
      <div role="radiogroup" aria-label="Search intensity" className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {(Object.keys(INTENSITY_META) as Intensity[]).map((k) => {
          const m = INTENSITY_META[k];
          const Icon = INTENSITY_ICON[k];
          const on = state.prefs.intensity === k;
          return (
            <button key={k} role="radio" aria-checked={on} onClick={() => update((d) => void (d.prefs.intensity = k))} className={cn("card-base card-hover flex flex-col p-5 text-left", on && "border-primary ring-2 ring-primary/20")}>
              <span className={cn("mb-3 flex h-10 w-10 items-center justify-center rounded-lg", on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                <Icon className="h-5 w-5" />
              </span>
              <span className="text-lg font-semibold">{m.label}</span>
              <span className="mt-3 flex items-baseline gap-1.5">
                <span className="num font-display text-3xl font-semibold">{m.actions}</span>
                <span className="text-sm text-muted-foreground">actions a day</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
