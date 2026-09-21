import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Briefcase,
  CheckCircle2,
  FileUp,
  Flame,
  GraduationCap,
  Leaf,
  Plus,
  RefreshCcw,
  Rocket,
  Sparkles,
  Trash2,
  Undo2,
  UserRound,
  X,
  Zap,
} from "lucide-react";
import { AiWorking, Chip, Logo, Segmented, SkeletonLines } from "@/components/common";
import { JobCard } from "@/components/JobCard";
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
import { BASE_VERSION, useLive } from "@/live/LiveProvider";
import { ResumeBuilder } from "./ResumeBuilder";
import { TemplatePicker } from "@/components/TemplatePicker";
import { RESUME_TEMPLATES, renderResumeHtml } from "@/data/resumeTemplates";
import { LiveStepResults, LiveStepTranslator } from "./LiveSteps";
import { BULLET_TRANSLATIONS, OTHER_FIELD_SAMPLES, PREVIOUS_FIELDS, TARGET_FIELDS, translateFreeText } from "@/data/translator";
import { INTENSITY_META, type Intensity } from "@/data/plan";
import { JOBS, type TargetField } from "@/data/jobs";
import { cn } from "@/lib/utils";
import { useDocTitle } from "@/hooks/useDocTitle";
import { LegitBadgeView } from "@/components/status";

const STEPS = ["Resume", "Situation", "Translator", "Targets", "Pace", "Matches"];

export default function Onboarding() {
  useDocTitle("Set up");
  const { state, update } = useStore();
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [parsed, setParsed] = useState<Resume | null>(state.uploadedFileName ? structuredClone(BASE_RESUME) : null);
  const live = state.mode === "live";
  const { flushProfile } = useLive();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!state.authed) nav("/signup", { replace: true });
  }, [state.authed, nav]);

  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  // A remote only search needs no place at all, so only ask for one when a
  // commute is actually on the table.
  const hasSomewhere = state.prefs.remote === "remote" || !!state.profile.location.trim() || state.prefs.locations.length > 0;
  const canNext = step === 0 ? !!parsed : step === 3 && live ? state.prefs.roles.length > 0 && hasSomewhere : true;
  const pct = Math.round((step / (STEPS.length - 1)) * 100);

  /** Writes the resume, including any education and certifications the user corrected. */
  const saveResume = async (r: Resume) => {
    setBaseResume(r);
    if (!supabase) return;
    const { data } = await supabase.from("resumes").update({ parsed: r, updated_at: new Date().toISOString() }).eq("is_base", true).select("id");
    // Someone who built their resume here has no row yet, because nothing was uploaded.
    if (!data?.length) {
      const uid = (await supabase.auth.getUser()).data.user?.id;
      if (uid) await supabase.from("resumes").insert({ user_id: uid, file_name: state.uploadedFileName ?? "Built in CareerQuest", parsed: r, is_base: true });
    }
  };

  const goNext = async () => {
    if (live && step === 0 && parsed) {
      setSaving(true);
      await saveResume(parsed);
      // Prefill from the resume so the later steps are corrections, not data entry.
      update((s) => {
        if (!s.profile.location && parsed.location) s.profile.location = parsed.location;
        if (!s.profile.name && parsed.name) s.profile.name = parsed.name;
        if (!s.profile.headline && parsed.roles[0]?.title) s.profile.headline = parsed.roles[0].title;
        if (s.prefs.roles.length === 0) {
          const titles = parsed.roles.map((r) => r.title.trim()).filter(Boolean);
          s.prefs.roles = Array.from(new Set(titles)).slice(0, 3);
        }
      });
      setSaving(false);
    }
    // Education and certifications are edited on the targets step, so save again.
    if (live && step === 3 && parsed) {
      setSaving(true);
      await saveResume(parsed);
      setSaving(false);
    }
    if (live && step >= 1) await flushProfile();
    setStep(step + 1);
  };

  const finish = () => {
    update((s) => void (s.onboarded = true));
    toast.success("You are all set.", { description: "Here is your plan for today." });
    nav("/app");
  };

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
          {step === 1 && <StepSituation headingRef={headingRef} />}
          {step === 2 && (live ? <LiveStepTranslator headingRef={headingRef} onBack={() => setStep(1)} /> : <StepTranslator headingRef={headingRef} />)}
          {step === 3 && <StepTargets headingRef={headingRef} parsed={parsed} setParsed={setParsed} />}
          {step === 4 && <StepIntensity headingRef={headingRef} />}
          {step === 5 && (live ? <LiveStepResults headingRef={headingRef} onFinish={finish} /> : <StepResults headingRef={headingRef} onFinish={finish} />)}
        </div>

        {step < 5 && (
          <div className="sticky bottom-0 -mx-4 mt-10 flex items-center justify-between border-t bg-canvas/95 px-4 py-4 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0">
            <Button variant="ghost" onClick={() => (step === 0 ? nav("/") : setStep(step - 1))}>
              <ArrowLeft /> {step === 0 ? "Exit" : "Back"}
            </Button>
            <Button size="lg" disabled={!canNext || saving} onClick={() => void goNext()}>
              {step === 4 ? "Find my matches" : "Continue"} <ArrowRight />
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}

type HRef = { headingRef: React.RefObject<HTMLHeadingElement> };

function StepHeading({ headingRef, title, sub }: HRef & { title: string; sub: string }) {
  return (
    <div className="mb-7">
      <h1 ref={headingRef} tabIndex={-1} className="font-display text-3xl font-semibold outline-none sm:text-4xl text-balance">
        {title}
      </h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">{sub}</p>
    </div>
  );
}

/* ---------------- Step 1: resume ---------------- */

function StepResume({ headingRef, parsed, setParsed }: HRef & { parsed: Resume | null; setParsed: (r: Resume | null) => void }) {
  const { state, update } = useStore();
  const [building, setBuilding] = useState(false);
  const [drag, setDrag] = useState(false);
  const [parsing, setParsing] = useState<string | null>(null);
  const [newSkill, setNewSkill] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const live = state.mode === "live";

  const start = (name: string) => {
    setParsed(null);
    setParsing(name);
  };

  // Real parsing: Claude reads the actual file on our server.
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
        if (!s.profile.location) s.profile.location = r.location;
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
    if (!(live ? /\.(pdf|docx|txt)$/i : /\.(pdf|docx?|txt|rtf)$/i).test(f.name)) {
      toast.error("That file type will not work", { description: live ? "Use a PDF, a Word .docx, or a plain text file." : "Use a PDF, Word document, or plain text file." });
      return;
    }
    if (live) void parseReal(f);
    else start(f.name);
  };

  const setField = (k: "name" | "email" | "phone" | "location" | "summary", v: string) => setParsed({ ...parsed!, [k]: v });
  const setBullet = (ri: number, bi: number, v: string) => {
    const r = structuredClone(parsed!);
    r.roles[ri].bullets[bi].text = v;
    setParsed(r);
  };
  const removeBullet = (ri: number, bi: number) => {
    const r = structuredClone(parsed!);
    r.roles[ri].bullets.splice(bi, 1);
    setParsed(r);
  };
  const setRole = (ri: number, k: "title" | "company" | "start" | "end", v: string) => {
    const r = structuredClone(parsed!);
    r.roles[ri][k] = v;
    setParsed(r);
  };

  return (
    <div>
      <StepHeading
        headingRef={headingRef}
        title="Start with your resume"
        sub={
          building
            ? "No file needed. Answer what you can, in your own words. We will only ever use what you put here."
            : "We read it once, then show you exactly what we found. Fix anything we got wrong. We will only ever use what is here."
        }
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
              if (!s.profile.location) s.profile.location = r.location;
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
          className={cn(
            "flex flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-background px-6 py-14 text-center transition-all",
            drag ? "scale-[1.01] border-primary bg-primary-soft" : "border-input hover:border-primary/50",
          )}
        >
          <div className={cn("mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary transition-transform", drag && "scale-110")}>
            <FileUp className="h-7 w-7" />
          </div>
          <div className="text-lg font-semibold">{drag ? "Drop it here" : "Drag your resume here"}</div>
          <p className="mt-1 text-sm text-muted-foreground">{live ? "PDF, Word (.docx), or plain text. Up to 3 MB." : "PDF, Word, or plain text. Up to 5 MB."}</p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Button onClick={() => input.current?.click()}>Choose a file</Button>
            {!live && (
              <Button variant="outline" onClick={() => start("Renee_Castillo_Resume.pdf")}>
                Use the sample resume
              </Button>
            )}
            <Button variant="outline" onClick={() => setBuilding(true)}>
              I do not have one yet
            </Button>
          </div>
          <input ref={input} type="file" accept={live ? ".pdf,.docx,.txt" : ".pdf,.doc,.docx,.txt,.rtf"} className="sr-only" onChange={(e) => onFiles(e.target.files)} aria-label="Upload resume file" />
          <p className="mt-5 max-w-md text-xs text-muted-foreground">
            {live ? "Your resume is read by AI, saved privately to your account, and never shown to an employer unless you apply." : "Prototype: any file you choose stays in your browser. We parse the sample resume for Renee Castillo so the rest of the product has real material to work with."}
          </p>
        </div>
      )}

      {parsing && (
        <div className="card-base grid grid-cols-1 gap-8 p-6 sm:grid-cols-[1fr_1.2fr]">
          <AiWorking
            title={`Reading ${parsing}`}
            steps={["Opening the file", "Finding roles, companies, and dates", "Pulling out each bullet point", "Collecting skills and certifications", "Double checking numbers"]}
            stepMs={live ? 2600 : 520}
            hold={live}
            onDone={() => {
              if (live) return;
              setParsed(structuredClone(BASE_RESUME));
              update((s) => void (s.uploadedFileName = parsing));
              setParsing(null);
            }}
          />
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
              <span className="font-semibold text-success">Parsed {state.uploadedFileName ?? "your resume"}.</span> We found {parsed.roles.length} role{parsed.roles.length === 1 ? "" : "s"}, {parsed.roles.reduce((n, r) => n + r.bullets.length, 0)} bullet points, {parsed.skills.length} skill{parsed.skills.length === 1 ? "" : "s"}, and {parsed.certifications.length} certification{parsed.certifications.length === 1 ? "" : "s"}. Everything below is editable. Fix anything we got wrong.
            </div>
            <Button variant="outline" size="sm" onClick={() => setParsed(null)}>
              <RefreshCcw /> Upload a different file
            </Button>
          </div>

          <div className="card-base p-5 sm:p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Contact</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {(["name", "email", "phone", "location"] as const).map((k) => (
                <div key={k} className="space-y-1.5">
                  <Label htmlFor={`p-${k}`} className="capitalize">
                    {k}
                  </Label>
                  <Input id={`p-${k}`} value={parsed[k]} onChange={(e) => setField(k, e.target.value)} />
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-1.5">
              <Label htmlFor="p-summary">Summary</Label>
              <Textarea id="p-summary" rows={3} value={parsed.summary} onChange={(e) => setField("summary", e.target.value)} />
            </div>
          </div>

          {parsed.roles.map((r, ri) => (
            <div key={r.id} className="card-base p-5 sm:p-6">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1.4fr_1.2fr_0.7fr_0.7fr]">
                <div className="space-y-1.5">
                  <Label htmlFor={`${r.id}-t`}>Title</Label>
                  <Input id={`${r.id}-t`} value={r.title} onChange={(e) => setRole(ri, "title", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`${r.id}-c`}>Company</Label>
                  <Input id={`${r.id}-c`} value={r.company} onChange={(e) => setRole(ri, "company", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`${r.id}-s`}>Start</Label>
                  <Input id={`${r.id}-s`} value={r.start} onChange={(e) => setRole(ri, "start", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`${r.id}-e`}>End</Label>
                  <Input id={`${r.id}-e`} value={r.end} onChange={(e) => setRole(ri, "end", e.target.value)} />
                </div>
              </div>
              <div className="mt-4 space-y-2">
                {r.bullets.map((b, bi) => (
                  <div key={b.id} className="group flex items-start gap-2">
                    <span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                    <Textarea aria-label={`Bullet ${bi + 1} for ${r.title}`} rows={2} value={b.text} onChange={(e) => setBullet(ri, bi, e.target.value)} className="min-h-0 resize-none text-sm" />
                    <Button variant="ghost" size="icon-sm" className="mt-1 opacity-60 group-hover:opacity-100" onClick={() => removeBullet(ri, bi)} aria-label="Remove bullet">
                      <Trash2 />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="card-base p-5 sm:p-6">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Skills</h2>
            <div className="flex flex-wrap gap-2">
              {parsed.skills.map((s) => (
                <span key={s} className="inline-flex items-center gap-1 rounded-full border bg-muted/50 py-1 pl-3 pr-1 text-sm">
                  {s}
                  <button onClick={() => setParsed({ ...parsed, skills: parsed.skills.filter((x) => x !== s) })} className="rounded-full p-1 text-muted-foreground hover:bg-background hover:text-foreground" aria-label={`Remove ${s}`}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (newSkill.trim()) setParsed({ ...parsed, skills: [...parsed.skills, newSkill.trim()] });
                setNewSkill("");
              }}
            >
              <Input value={newSkill} onChange={(e) => setNewSkill(e.target.value)} placeholder="Add a skill you actually have" aria-label="Add a skill" />
              <Button type="submit" variant="outline">
                <Plus /> Add
              </Button>
            </form>
            <p className="mt-3 text-xs text-muted-foreground">
              Certifications found: {parsed.certifications.join(", ")}. Education: {parsed.education.join(", ")}.
            </p>
          </div>

          {/* Seeing the page now, rather than after the first tailoring, is what
              makes the rest of setup feel like it is about a real document. */}
          <div className="card-base p-5 sm:p-6">
            <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">How it will look</h2>
            <p className="mb-4 text-sm text-muted-foreground">Your own words in each layout. Every one is plain enough for screening software to read. You can change this any time.</p>
            <TemplatePicker
              label="Page layout"
              items={RESUME_TEMPLATES.map((t) => ({
                id: t.id,
                name: t.name,
                blurb: t.blurb,
                bestFor: t.bestFor,
                html: renderResumeHtml({ ...parsed, certsOwnSection: parsed.certifications.length > 0, changedIds: new Set(), editedIds: new Set() }, t.id, t.name, state.profile.headline),
              }))}
              value={state.resume.templateId}
              onChange={(id) => update((d) => void (d.resume.templateId = id))}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Step 2: situation ---------------- */

const SITUATIONS: { id: Situation; title: string; body: string; adapts: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "changer", title: "Career changer", body: "I want to move into a different field.", adapts: "We lead with Career Translator and roles that do not require exact industry experience.", icon: RefreshCcw },
  { id: "laidoff", title: "Recently laid off", body: "My role was cut and I am restarting.", adapts: "We help you move quickly, skip listings that are not real, and talk about the layoff with confidence.", icon: Undo2 },
  { id: "employed", title: "Employed and looking", body: "I have a job but want something better.", adapts: "We keep things quiet and focused, with fewer, higher fit actions each day.", icon: Briefcase },
  { id: "returning", title: "Returning to work", body: "I have been out for a while by choice.", adapts: "We help you frame the gap and refresh the skills employers screen for.", icon: UserRound },
];

function StepSituation({ headingRef }: HRef) {
  const { state, update } = useStore();
  return (
    <div>
      <StepHeading headingRef={headingRef} title="What is your situation?" sub="There is no wrong answer. This changes what we show you first and how we talk to you." />
      <div role="radiogroup" aria-label="Your situation" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {SITUATIONS.map((s) => {
          const on = state.prefs.situation === s.id;
          return (
            <button
              key={s.id}
              role="radio"
              aria-checked={on}
              onClick={() => update((d) => void (d.prefs.situation = s.id))}
              className={cn("card-base card-hover flex gap-4 p-5 text-left", on && "border-primary ring-2 ring-primary/20")}
            >
              <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors", on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                <s.icon className="h-5 w-5" />
              </span>
              <span>
                <span className="block font-semibold">{s.title}</span>
                <span className="block text-sm text-muted-foreground">{s.body}</span>
                <span className={cn("mt-2 block text-xs transition-colors", on ? "text-primary" : "text-muted-foreground/80")}>{s.adapts}</span>
              </span>
            </button>
          );
        })}
      </div>
      {state.prefs.situation === "laidoff" && (
        <div className="mt-5 rounded-xl border bg-background p-4 text-sm animate-fade-up">
          <span className="font-medium">A quick word.</span> <span className="text-muted-foreground">Layoffs are a business decision, not a verdict on you. Most people in your position land in four to six months. We will help you use that time well.</span>
        </div>
      )}

      {/* Asked here, once. The next step shows what it does rather than asking again. */}
      <div className="card-base mt-5 grid grid-cols-1 gap-4 p-5 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="prev-field">I am coming from</Label>
          <Input
            id="prev-field"
            value={state.prefs.prevField}
            onChange={(e) => update((d) => void (d.prefs.prevField = e.target.value))}
            placeholder="For example: retail operations"
          />
          <p className="text-xs text-muted-foreground">Read from your resume. Change it if it is not right.</p>
        </div>
        <ArrowRight className="mx-auto hidden h-5 w-5 text-primary sm:mb-8 sm:block" aria-hidden />
        <div className="space-y-1.5">
          <Label htmlFor="target-field">I want to move into</Label>
          <Select value={state.prefs.targetField} onValueChange={(v) => update((d) => void (d.prefs.targetField = v))}>
            <SelectTrigger id="target-field">
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
          <p className="text-xs text-muted-foreground">This sets the language we translate your experience into.</p>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Step 3: translator ---------------- */

function StepTranslator({ headingRef }: HRef) {
  const { state, update } = useStore();
  const prev = state.prefs.prevField;
  const target = state.prefs.targetField as TargetField;
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => setLoading(false), 750);
    return () => clearTimeout(t);
  }, [prev, target]);

  const rows = useMemo(() => {
    const own = BASE_RESUME.roles.flatMap((r) => r.bullets);
    // The scripted lines only exist for the sample resume. Someone who wrote
    // their own here gets their own lines translated instead of a stranger's.
    const scripted = ["r1", "r2", "r3"].map((id) => ({ id, b: own.find((x) => x.id === id) }));
    if (prev === "retail" && scripted.every((x) => x.b)) {
      return scripted.map(({ id, b }) => ({ from: b!.text, to: BULLET_TRANSLATIONS[id][target].phrases, mine: true }));
    }
    const sample = OTHER_FIELD_SAMPLES[prev];
    if (sample) return sample.map((x) => ({ from: x.text, to: x.out[target], mine: false }));
    return own
      .slice(0, 3)
      .map((b) => ({ from: b.text, to: translateFreeText(b.text), mine: true }))
      .filter((r) => r.to.length > 0);
  }, [prev, target]);

  const targetMeta = TARGET_FIELDS.find((t) => t.id === target)!;

  return (
    <div>
      <StepHeading headingRef={headingRef} title="Let us translate your experience" sub="Pick where you are coming from and where you want to go. Here is how your top three responsibilities read in that field." />
      <div className="card-base mb-5 grid grid-cols-1 gap-4 p-5 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="prev">I am coming from</Label>
          <Select value={prev} onValueChange={(v) => update((d) => void (d.prefs.prevField = v))}>
            <SelectTrigger id="prev">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PREVIOUS_FIELDS.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <ArrowRight className="mx-auto hidden h-5 w-5 text-primary sm:mb-2.5 sm:block" aria-hidden />
        <div className="space-y-1.5">
          <Label htmlFor="target">I want to move into</Label>
          <Select value={target} onValueChange={(v) => update((d) => void (d.prefs.targetField = v))}>
            <SelectTrigger id="target">
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
        </div>
      </div>

      <div className="space-y-3" aria-live="polite">
        {rows.length === 0 && (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            Add a line or two about what you did on the previous step and we will show you how it reads in {targetMeta.label}.
          </p>
        )}
        {rows.map((r, i) => (
          <div key={r.from} className="grid grid-cols-1 gap-3 rounded-xl border bg-card p-4 shadow-card md:grid-cols-[1fr_auto_1.1fr] md:items-center md:p-5">
            <div>
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{r.mine ? "From your resume" : "Sample responsibility"}</div>
              <p className="text-sm">{r.from}</p>
            </div>
            <ArrowRight className="mx-auto h-4 w-4 rotate-90 text-primary md:rotate-0" aria-hidden />
            <div>
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary">{targetMeta.label} language</div>
              {loading ? (
                <div className="flex gap-2">
                  <div className="skeleton h-7 w-40" />
                  <div className="skeleton h-7 w-28" />
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {r.to.map((p, j) => (
                    <span key={p} className="rounded-md bg-primary-soft px-2.5 py-1 text-xs font-medium text-primary animate-pop" style={{ animationDelay: `${i * 120 + j * 60}ms` }}>
                      {p}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm text-muted-foreground">
        The full Career Translator sits in the Studio, beside your resume. It works with every line you have, and with anything you type.
      </p>
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

function StepTargets({ headingRef, parsed, setParsed }: HRef & { parsed: Resume | null; setParsed: (r: Resume) => void }) {
  const { state, update } = useStore();
  const p = state.prefs;
  return (
    <div>
      <StepHeading
        headingRef={headingRef}
        title="What are you aiming for?"
        sub="Most of this is already filled in from your resume. Correct anything that is wrong. You can change all of it later in Settings."
      />
      <div className="space-y-5">
        <div className="card-base p-5 sm:p-6">
          <TagEditor label="Target roles" values={p.roles} suggestions={ROLE_SUGGESTIONS[p.targetField] ?? []} onChange={(v) => update((d) => void (d.prefs.roles = v))} placeholder="Add a role title" />
        </div>
        <WhereBlock />
        <PayBlock />
        <CredentialsBlock parsed={parsed} setParsed={setParsed} />
        <div className="card-base grid grid-cols-1 gap-6 p-5 sm:p-6 md:grid-cols-2">
          <TagEditor label="Must haves" values={p.mustHaves} suggestions={MUST_SUGGEST} onChange={(v) => update((d) => void (d.prefs.mustHaves = v))} placeholder="Add a must have" />
          <TagEditor label="Dealbreakers" values={p.dealbreakers} suggestions={DEAL_SUGGEST} onChange={(v) => update((d) => void (d.prefs.dealbreakers = v))} placeholder="Add a dealbreaker" />
        </div>
      </div>
    </div>
  );
}

/**
 * Where someone can actually work. A list of city names could never answer
 * "how far is too far", so the home address and a radius come first, and the
 * extra locations are for people who would move rather than commute.
 */
function WhereBlock() {
  const { state, update } = useStore();
  const p = state.prefs;
  const home = state.profile.location;
  const commutes = p.remote !== "remote";
  const anyDistance = p.maxDistanceMiles >= 100;

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
        <div className="space-y-1.5">
          <Label htmlFor="home-base">Home base</Label>
          <Input id="home-base" value={home} onChange={(e) => update((d) => void (d.profile.location = e.target.value))} placeholder="City, State" />
          <p className="text-xs text-muted-foreground">{home ? "Read from your resume. Commutes are measured from here." : "Add your city so we can measure commutes."}</p>
        </div>

        {commutes && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium" id="dist-label">
                Furthest you would commute
              </span>
              <span className="num font-semibold">{anyDistance ? "Any distance" : `${p.maxDistanceMiles} miles`}</span>
            </div>
            <Slider aria-labelledby="dist-label" value={[p.maxDistanceMiles]} min={5} max={100} step={5} onValueChange={([v]) => update((d) => void (d.prefs.maxDistanceMiles = v))} />
            <p className="text-xs text-muted-foreground">
              {/* About a mile a minute on open road, closer to two in town. */}
              {anyDistance ? "Distance will not rule anything out." : `Roughly ${Math.max(10, Math.round(p.maxDistanceMiles * 1.1))} to ${Math.round(p.maxDistanceMiles * 1.8)} minutes each way, depending on traffic.`}
            </p>
          </div>
        )}
      </div>

      <div className="border-t pt-5">
        <TagEditor
          label="Anywhere else you would work"
          values={p.locations}
          suggestions={[home, "Remote (US)"].filter(Boolean)}
          onChange={(v) => update((d) => void (d.prefs.locations = v))}
          placeholder="Add a city, or Remote"
        />
        <p className="mt-2 text-xs text-muted-foreground">Only needed if you would move or travel for the right job. Leave it empty and we will search around your home base.</p>
      </div>
    </div>
  );
}

function PayBlock() {
  const { state, update } = useStore();
  const p = state.prefs;
  return (
    <div className="card-base space-y-3 p-5 sm:p-6">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium" id="floor-label">
          Lowest salary you would accept
        </span>
        <span className="num font-semibold">${p.salaryFloor.toLocaleString()}</span>
      </div>
      <Slider aria-labelledby="floor-label" value={[p.salaryFloor]} min={30000} max={150000} step={5000} onValueChange={([v]) => update((d) => void (d.prefs.salaryFloor = v))} />
      <p className="text-xs text-muted-foreground">
        {state.mode === "live"
          ? "Many listings hide pay. We never rule a job out for that, we just flag it."
          : `${JOBS.filter((j) => j.salary && j.salary[1] >= p.salaryFloor).length} of ${JOBS.length} current listings pay at or above this at the top of their range.`}
      </p>
    </div>
  );
}

/**
 * Education and certifications, read straight off the resume. These are often
 * what separates two similar candidates, and a parser can miss them, so they
 * are shown for checking rather than hidden away.
 */
function CredentialsBlock({ parsed, setParsed }: { parsed: Resume | null; setParsed: (r: Resume) => void }) {
  if (!parsed) return null;
  const edit = (patch: Partial<Resume>) => setParsed({ ...parsed, ...patch });
  return (
    <div className="card-base grid grid-cols-1 gap-6 p-5 sm:p-6 md:grid-cols-2">
      <LineEditor label="Education" icon={GraduationCap} values={parsed.education} onChange={(v) => edit({ education: v })} placeholder="Degree, school, year" />
      <div>
        <LineEditor label="Certifications and licenses" icon={Award} values={parsed.certifications} onChange={(v) => edit({ certifications: v })} placeholder="Certification name, year" />
        <p className="mt-2 text-xs text-muted-foreground">Licenses, safety cards, and software certificates all count. These often decide who gets called.</p>
      </div>
    </div>
  );
}

/** A plain list of one line entries. Unlike TagEditor, these are sentences rather than chips. */
function LineEditor({
  label,
  icon: Icon,
  values,
  onChange,
  placeholder,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  values: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
}) {
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
            <button
              type="button"
              onClick={() => onChange(values.filter((_, j) => j !== i))}
              className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:text-danger"
              aria-label={`Remove ${e}`}
            >
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

/* ---------------- Step 5: intensity ---------------- */

const INTENSITY_ICON: Record<Intensity, React.ComponentType<{ className?: string }>> = { casual: Leaf, active: Zap, urgent: Flame };

function StepIntensity({ headingRef }: HRef) {
  const { state, update } = useStore();
  return (
    <div>
      <StepHeading headingRef={headingRef} title="How hard do you want to push?" sub="This sets how many actions show up in your daily plan. Every action is small. You can change it any time." />
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
              <span className="mt-1 text-sm text-muted-foreground">{m.blurb}</span>
              <span className="mt-4 flex items-baseline gap-1.5">
                <span className="num font-display text-3xl font-semibold">{m.actions}</span>
                <span className="text-sm text-muted-foreground">actions a day</span>
              </span>
              <span className="text-xs text-muted-foreground">{m.apps}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- Step 6: results ---------------- */

function StepResults({ headingRef, onFinish }: HRef & { onFinish: () => void }) {
  const { state, update } = useStore();
  const nav = useNavigate();
  const onTailor = (id: string) => {
    update((s) => void (s.onboarded = true));
    nav(`/app/studio?job=${id}&tailor=1`);
  };
  const [ready, setReady] = useState(false);
  const ghosts = JOBS.filter((j) => j.legit.score < state.legitThreshold);
  const top = JOBS.filter((j) => j.legit.score >= state.legitThreshold)
    .sort((a, b) => b.match - a.match)
    .slice(0, 5);
  const shown = JOBS.filter((j) => j.legit.score >= state.legitThreshold);

  return (
    <div>
      {!ready ? (
        <div className="mx-auto max-w-lg py-6">
          <h1 ref={headingRef} tabIndex={-1} className="mb-6 font-display text-3xl font-semibold outline-none">
            Finding your first matches
          </h1>
          <div className="card-base p-6">
            <AiWorking
              title="This takes a few seconds"
              stepMs={800}
              steps={[
                "Scanning 2,340 open listings across the Northeast and remote",
                "Checking each one against its company's own careers page",
                `Setting aside ${ghosts.length} listings we could not stand behind, and 312 duplicates`,
                "Scoring transferable fit against your resume",
                "Ranking by match and legitimacy",
              ]}
              onDone={() => {
                setReady(true);
                // matches are real app screens, so the account counts as set up from here
                update((s) => void (s.onboarded = true));
              }}
            />
          </div>
        </div>
      ) : (
        <div className="animate-fade-up">
          <div className="mb-7 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success-soft text-success animate-pop">
              <Sparkles className="h-6 w-6" />
            </div>
            <h1 ref={headingRef} tabIndex={-1} className="font-display text-3xl font-semibold outline-none sm:text-4xl text-balance">
              Your experience counts in more places than you think.
            </h1>
            <p className="mx-auto mt-2 max-w-xl text-muted-foreground">Here are your five strongest matches. We checked every one against the employer’s own careers page, and every score shows its reasoning.</p>
          </div>
          <div className="mb-6 grid grid-cols-3 gap-3">
            {[
              { n: shown.length, l: "real matches found" },
              { n: shown.filter((j) => j.careerChangerFriendly).length, l: "career changer friendly" },
              { n: ghosts.length, l: "listings set aside" },
            ].map((s) => (
              <div key={s.l} className="card-base p-4 text-center">
                <div className="num font-display text-3xl font-semibold">{s.n}</div>
                <div className="text-xs text-muted-foreground">{s.l}</div>
              </div>
            ))}
          </div>
          {ghosts.length > 0 && (
            <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border bg-background p-3 text-sm">
              <span className="text-muted-foreground">Hidden for you:</span>
              {ghosts.map((g) => (
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
            <p className="text-xs text-muted-foreground">Your matches will be waiting in the feed.</p>
          </div>
        </div>
      )}
    </div>
  );
}
