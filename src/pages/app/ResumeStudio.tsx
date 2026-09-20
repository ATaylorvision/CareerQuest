import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowRight,
  Ban,
  Check,
  CheckCheck,
  Download,
  FileDown,
  FileText,
  Info,
  Lock,
  PenLine,
  Printer,
  RotateCcw,
  Save,
  ShieldAlert,
  Sparkles,
  Star,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { AiWorking, Card, PageHeader, ScoreBar, ScoreRing, SectionTitle, SkeletonLines, Segmented } from "@/components/common";
import { Pill, TruthModeBadge } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useStore } from "@/store/AppStore";
import { JOBS, jobById, type Job } from "@/data/jobs";
import { ATS_MAX, BASE_ATS, BLOCKED_EDITS, CHANGE_TYPE_LABEL, type TailorChange } from "@/data/resumeStudio";
import { SEVERITY_LABEL } from "@/data/gaps";
import { atsScore, changesForJob, FREE_LIMITS, isPro } from "@/lib/selectors";
import { wordDiff } from "@/lib/diff";
import { buildResume, downloadText, printResume, resumeToText, type BuiltResume } from "@/lib/resumeBuild";
import { RESUME_TEMPLATES, renderResumeHtml } from "@/data/resumeTemplates";
import { api, ApiError } from "@/live/api";
import { supabase } from "@/live/supabase";
import { TemplatePicker } from "@/components/TemplatePicker";
import { useSessionState } from "@/hooks/useSessionState";
import { useDocTitle } from "@/hooks/useDocTitle";
import { cn } from "@/lib/utils";

function DiffText({ tokens, side }: { tokens: { text: string; kind: string }[]; side: "left" | "right" }) {
  // Group consecutive words of the same kind so highlights read as phrases, not confetti.
  const runs: { text: string; kind: string }[] = [];
  tokens.forEach((t) => {
    const last = runs[runs.length - 1];
    if (last && last.kind === t.kind) last.text += ` ${t.text}`;
    else runs.push({ ...t });
  });
  return (
    <p className="text-sm leading-relaxed">
      {runs.map((t, i) => (
        <span key={i}>
          <span
            className={cn(
              t.kind === "del" && side === "left" && "rounded bg-danger/15 px-0.5 text-danger line-through decoration-danger/50",
              t.kind === "add" && side === "right" && "rounded bg-success/15 px-0.5 font-medium text-success",
            )}
          >
            {t.text}
          </span>{" "}
        </span>
      ))}
    </p>
  );
}

function ChangeRow({ c, decision, onDecide, index }: { c: TailorChange; decision?: string; onDecide: (d: "accepted" | "rejected" | null) => void; index: number }) {
  const { left, right } = useMemo(() => wordDiff(c.original, c.tailored), [c.original, c.tailored]);
  // A pure reorder (same words, new order) reads better without word highlighting.
  const same = c.original === c.tailored || c.sourceId === "skills";
  const moved = c.type === "reorder" && c.sourceId !== "skills";
  return (
    <li
      className={cn(
        "rounded-xl border bg-card transition-all animate-fade-up",
        decision === "accepted" && "border-success-border",
        decision === "rejected" && "opacity-70",
      )}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold text-foreground/80">{c.section}</span>
          <Pill size="xs" tone="primary">{CHANGE_TYPE_LABEL[c.type]}</Pill>
        </div>
        {decision === "accepted" && <Pill size="xs" tone="success" icon={Check}>Accepted</Pill>}
        {decision === "rejected" && <Pill size="xs" tone="muted" icon={X}>Rejected, original kept</Pill>}
        {!decision && <Pill size="xs" tone="warning">Waiting on you</Pill>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2">
        <div className={cn("border-b p-4 md:border-b-0 md:border-r", !same && "diff-del")}>
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Original</div>
          {same ? <p className="text-sm leading-relaxed">{c.original}</p> : <DiffText tokens={left} side="left" />}
        </div>
        <div className={cn("p-4", decision === "rejected" ? "bg-muted/40" : "diff-add")}>
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Tailored</div>
          {moved && <span className="mb-1 inline-block rounded bg-success/15 px-1.5 text-xs font-semibold text-success">Moved to the top of this role</span>}
          {c.sourceId === "skills" && <span className="mb-1 inline-block rounded bg-success/15 px-1.5 text-xs font-semibold text-success">Same skills, new order</span>}
          {same ? <p className="text-sm leading-relaxed">{c.tailored}</p> : <DiffText tokens={right} side="right" />}
        </div>
      </div>
      <div className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center">
        <p className="flex flex-1 gap-2 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
          <span>
            <span className="sr-only">Reason: </span>
            {c.reason}
          </span>
        </p>
        <div className="flex shrink-0 gap-2">
          {decision ? (
            <Button size="xs" variant="ghost" onClick={() => onDecide(null)}>
              <Undo2 /> Undo
            </Button>
          ) : (
            <>
              <Button size="xs" variant="outline" onClick={() => onDecide("rejected")} aria-label={`Reject change to ${c.section}`}>
                <X /> Reject
              </Button>
              <Button size="xs" variant="success" onClick={() => onDecide("accepted")} aria-label={`Accept change to ${c.section}`}>
                <Check /> Accept
              </Button>
            </>
          )}
        </div>
      </div>
    </li>
  );
}

function AtsCard({ changes, decisions }: { changes: TailorChange[]; decisions: Record<string, string> }) {
  const s = atsScore(changes, decisions);
  const before = BASE_ATS.keywords + BASE_ATS.formatting + BASE_ATS.structure + BASE_ATS.length + BASE_ATS.fileType;
  const rows = [
    { k: "Keyword coverage", v: s.keywords, max: ATS_MAX.keywords, note: "Terms from the posting that appear in your resume." },
    { k: "Formatting safety", v: s.formatting, max: ATS_MAX.formatting, note: "No tables or text boxes. Two points off for the header icons." },
    { k: "Section structure", v: s.structure, max: ATS_MAX.structure, note: "Standard headings that screening software recognizes." },
    { k: "Length", v: s.length, max: ATS_MAX.length, note: "One page. Bullets under two lines." },
    { k: "File type", v: s.fileType, max: ATS_MAX.fileType, note: "PDF with real text, not an image." },
  ];
  return (
    <Card>
      <SectionTitle sub="Updates live as you accept changes.">ATS compatibility</SectionTitle>
      <div className="mb-5 flex items-center gap-4">
        <ScoreRing value={s.total} size={84} stroke={7} sub="of 100" label="ATS compatibility score" />
        <div className="text-sm">
          <div>
            Before tailoring: <span className="num font-semibold">{before}</span>
          </div>
          <div className={cn("num font-semibold", s.total > before ? "text-success" : "text-muted-foreground")}>{s.total > before ? `+${s.total - before} from accepted changes` : "Accept changes to raise it"}</div>
        </div>
      </div>
      <ul className="space-y-3.5">
        {rows.map((r) => (
          <li key={r.k}>
            <div className="mb-1 flex justify-between text-sm">
              <span className="font-medium">{r.k}</span>
              <span className="num text-muted-foreground">
                <span className="font-semibold text-foreground">{r.v}</span>/{r.max}
              </span>
            </div>
            <ScoreBar value={r.v} max={r.max} height={6} label={r.k} />
            <p className="mt-1 text-xs text-muted-foreground">{r.note}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function GapsPanel({ job }: { job: Job }) {
  return (
    <section className="rounded-xl border border-warning-border bg-warning-soft p-5" aria-labelledby="gaps-h">
      <h2 id="gaps-h" className="flex items-center gap-2 font-semibold text-warning">
        <ShieldAlert className="h-4 w-4" /> Gaps we did not fill
      </h2>
      <p className="mt-1 text-sm text-foreground/80">These are in the posting but not in your resume. Truth Mode will not add them. Here is an honest way to handle each.</p>
      {job.gaps.length === 0 ? (
        <p className="mt-3 text-sm">No gaps against this posting.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {job.gaps.map((g) => (
            <li key={g.id} className="rounded-lg border border-warning-border bg-background/80 p-3.5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <span className="text-sm font-medium">{g.label}</span>
                <Pill size="xs" tone={g.severity === "dealbreaker" ? "danger" : g.severity === "trainable" ? "warning" : "muted"}>
                  {SEVERITY_LABEL[g.severity]}
                </Pill>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">{g.note}</p>
              <p className="mt-2 text-xs">
                <span className="font-semibold">Say it in your cover letter: </span>
                <span className="italic">"{g.coverLetterLine}"</span>
              </p>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button asChild size="sm" variant="outline" className="bg-background">
          <Link to={`/app/cover-letter?job=${job.id}`}>
            <PenLine /> Address these in a cover letter
          </Link>
        </Button>
        <Button asChild size="sm" variant="ghost">
          <Link to="/app/roadmap">Close them over time</Link>
        </Button>
      </div>
    </section>
  );
}

function ResumeDoc({ r, highlight }: { r: BuiltResume; highlight: boolean }) {
  const hl = (id: string) => highlight && r.changedIds.has(id) && "bg-success-soft rounded -mx-1 px-1";
  return (
    <div className="mx-auto max-w-[720px] rounded-lg border bg-white p-6 font-serif text-[13px] leading-relaxed text-neutral-900 shadow-card sm:p-10">
      <h2 className="text-2xl font-semibold tracking-wide">{r.name}</h2>
      <div className="mt-1 text-neutral-600">
        {r.location} | {r.phone} | {r.email}
      </div>
      <h3 className="mb-1.5 mt-5 border-b border-neutral-400 pb-0.5 text-xs font-semibold tracking-[0.15em]">SUMMARY</h3>
      <p className={cn(hl("summary"))}>{r.summary}</p>
      <h3 className="mb-1.5 mt-5 border-b border-neutral-400 pb-0.5 text-xs font-semibold tracking-[0.15em]">EXPERIENCE</h3>
      {r.roles.map((role) => (
        <div key={role.id} className="mb-3">
          <div className="flex flex-wrap justify-between gap-x-4">
            <span>
              <b>{role.title}</b>, {role.company}, {role.location}
            </span>
            <span className="text-neutral-600">
              {role.start} to {role.end}
            </span>
          </div>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {role.bullets.map((b) => (
              <li key={b.id} className={cn(hl(b.id))}>
                {b.text}
              </li>
            ))}
          </ul>
        </div>
      ))}
      <h3 className="mb-1.5 mt-5 border-b border-neutral-400 pb-0.5 text-xs font-semibold tracking-[0.15em]">EDUCATION</h3>
      <p>{r.education.join(", ")}</p>
      {!r.certsOwnSection && <p>{r.certifications.join(", ")}</p>}
      {r.certsOwnSection && (
        <>
          <h3 className={cn("mb-1.5 mt-5 border-b border-neutral-400 pb-0.5 text-xs font-semibold tracking-[0.15em]", hl("certs"))}>CERTIFICATIONS</h3>
          <p>{r.certifications.join(", ")}</p>
        </>
      )}
      <h3 className="mb-1.5 mt-5 border-b border-neutral-400 pb-0.5 text-xs font-semibold tracking-[0.15em]">SKILLS</h3>
      <p className={cn(hl("skills"))}>{r.skills.join(", ")}</p>
    </div>
  );
}

export default function ResumeStudio() {
  useDocTitle("Resume Studio");
  const { state, update } = useStore();
  const [params, setParams] = useSearchParams();
  const pro = isPro(state);
  const jobId = params.get("job") ?? state.resume.jobId;
  const job = jobById(jobId) ?? JOBS[0];
  const live = state.mode === "live";
  // Real accounts get changes written against their own resume and this posting.
  // The sample account keeps its scripted set so the demo stays instant.
  const [liveChanges, setLiveChanges] = useSessionState<Record<string, TailorChange[]>>("live-changes", {});
  const demoChanges = useMemo(() => (live ? [] : changesForJob(job)), [live, job]);
  const changes = live ? (liveChanges[job.id] ?? []) : demoChanges;
  const decisions = state.resume.decisions;
  const [analyzed, setAnalyzed] = useSessionState<string[]>("analyzed", ["j01"]);
  const [working, setWorking] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pending">("all");
  const [tab, setTab] = useSessionState<string>("resume-tab", "tailor");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    if (state.resume.jobId !== job.id) update((s) => void (s.resume.jobId = job.id));
  }, [job.id, state.resume.jobId, update]);

  const isAnalyzed = live ? !!liveChanges[job.id] : analyzed.includes(job.id);
  const freeLeft = FREE_LIMITS.tailoredResumes - state.usage.tailoredResumes;
  const accepted = changes.filter((c) => decisions[c.id] === "accepted").length;
  const rejected = changes.filter((c) => decisions[c.id] === "rejected").length;
  const pending = changes.length - accepted - rejected;
  const built = useMemo(() => buildResume(changes, decisions), [changes, decisions]);
  const ats = atsScore(changes, decisions);
  const savedVersion = state.resume.versions.find((v) => v.id === `v-${job.id}`);

  const decide = (id: string, d: "accepted" | "rejected" | null) =>
    update((s) => {
      if (d) s.resume.decisions[id] = d;
      else delete s.resume.decisions[id];
    });

  const bulk = (d: "accepted" | "rejected") =>
    update((s) => {
      changes.forEach((c) => {
        if (!s.resume.decisions[c.id]) s.resume.decisions[c.id] = d;
      });
    });

  const startTailor = async () => {
    setFailed(null);
    setWorking(true);
    if (!live) return; // the demo runs on a timer inside AiWorking
    try {
      const out = await api<{ changes: TailorChange[] }>("studio", { action: "tailor", jobId: job.id });
      if (!out.changes.length) {
        setFailed("We could not find a change worth making from this posting. Your resume may already line up well, or the posting may be too thin to read.");
      } else {
        setLiveChanges((m) => ({ ...m, [job.id]: out.changes }));
      }
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : "Something went wrong. Please try again.");
    } finally {
      setWorking(false);
    }
  };

  const saveVersion = async () => {
    const name = `${job.title}, ${job.company.name.replace(/ (Co\.|Inc\.)$/, "")}`;

    // Real accounts keep the finished document in the database, not just in the
    // browser's working state, so it survives a new device and shows up in admin.
    if (live && supabase) {
      const uid = (await supabase.auth.getUser()).data.user?.id;
      if (uid) {
        const { error } = await supabase.from("resume_versions").upsert(
          {
            user_id: uid,
            job_id: job.id,
            name,
            target: `${job.title} at ${job.company.name}`,
            content: built as unknown as Record<string, unknown>,
            changes: changes.map((c) => ({ ...c, decision: decisions[c.id] ?? "pending" })),
            ats_score: ats.total,
          },
          { onConflict: "user_id,job_id" },
        );
        if (error) {
          toast.error("We could not save that version", { description: "Your changes are still here. Please try again." });
          return;
        }
      }
    }
    update((s) => {
      const existing = s.resume.versions.find((v) => v.id === `v-${job.id}`);
      if (existing) {
        existing.ats = ats.total;
        existing.changeIds = changes.filter((c) => decisions[c.id] === "accepted").map((c) => c.id);
      } else {
        s.resume.versions.push({ id: `v-${job.id}`, name, target: `${job.title} at ${job.company.name}`, ats: ats.total, createdDaysAgo: 0, sends: 0, responses: 0, note: `${accepted} Truth Mode changes accepted.`, changeIds: changes.filter((c) => decisions[c.id] === "accepted").map((c) => c.id) });
        s.usage.tailoredResumes += 1;
        if (!s.resume.tailoredJobs.includes(job.id)) s.resume.tailoredJobs.push(job.id);
        // Completing the Northvale tailoring checks off today's plan item
        if (job.id === "j01") {
          s.planDone.p3 = true;
          s.activity[0] = true;
        }
      }
    });
    toast.success(savedVersion ? "Version updated" : "Saved as a new version", { description: `${name}. ATS ${ats.total}. It is ready to attach when you apply.` });
  };

  const jobOptions = useMemo(() => {
    const tracked = state.applications.map((a) => a.jobId);
    const ids = Array.from(new Set(["j01", ...tracked, ...JOBS.filter((j) => j.match >= 85).map((j) => j.id)]));
    return ids.map((id) => jobById(id)!).filter((j) => j && j.legit.badge !== "ghost");
  }, [state.applications]);

  const shown = filter === "pending" ? changes.filter((c) => !decisions[c.id]) : changes;

  return (
    <div>
      <PageHeader
        title="Resume Studio"
        sub="Tailor your resume for one job at a time. Every change is shown, explained, and waits for your OK."
        actions={
          <>
            <TruthModeBadge />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download /> Download
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={() => {
                    if (!printResume(built, `${built.name.replace(/\s+/g, "_")}_${job.company.name.split(" ")[0]}`, state.resume.templateId, state.profile.headline))
                      toast.error("Your browser blocked the print window. Allow pop ups and try again.");
                  }}
                >
                  <Printer className="mr-2 h-4 w-4" /> PDF (print to PDF)
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    downloadText(`${built.name.replace(/\s+/g, "_")}_Resume_${job.company.name.split(" ")[0]}.txt`, resumeToText(built));
                    toast.success("Plain text resume downloaded");
                  }}
                >
                  <FileDown className="mr-2 h-4 w-4" /> Plain text (.txt)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <Card className="mb-6 p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="min-w-0 flex-1">
            <label htmlFor="job-pick" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Tailoring for
            </label>
            <Select value={job.id} onValueChange={(v) => setParams({ job: v })}>
              <SelectTrigger id="job-pick" className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {jobOptions.map((j) => (
                  <SelectItem key={j.id} value={j.id}>
                    {j.title} · {j.company.name} · {j.match}% match
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Pill tone="primary">
              <span className="num">{job.match}</span>% match
            </Pill>
            {job.closesInDays !== undefined && <Pill tone="warning">Closes in {job.closesInDays} days</Pill>}
            {!pro && (
              <Pill tone={freeLeft > 0 ? "muted" : "danger"}>
                <span className="num">{Math.max(0, freeLeft)}</span> of 3 free tailored resumes left
              </Pill>
            )}
            <Button asChild variant="ghost" size="sm">
              <Link to={`/app/jobs/${job.id}`}>
                View posting <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-5">
          <TabsTrigger value="tailor">Tailor</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="versions">Versions ({state.resume.versions.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="tailor">
          {!isAnalyzed && !working && (
            <Card className="flex flex-col items-center py-12 text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
                <Sparkles className="h-6 w-6" />
              </div>
              <h2 className="font-display text-2xl font-semibold">Tailor for {job.company.name}</h2>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">We will compare your resume line by line against this posting and suggest changes. Only reordering, rewording, emphasis, and formatting. Nothing invented.</p>
              <Button className="mt-5" size="lg" onClick={() => void startTailor()}>
                <Sparkles /> Suggest changes
              </Button>
              {failed && (
                <div className="mt-5 max-w-md rounded-lg border border-danger/30 bg-danger/5 p-4 text-sm">
                  <p>{failed}</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => void startTailor()}>
                    Try again
                  </Button>
                </div>
              )}
            </Card>
          )}

          {working && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
              <Card>
                <AiWorking
                  title={`Tailoring for ${job.title}`}
                  stepMs={650}
                  steps={["Reading the posting and ranking its requirements", "Comparing it against every line of your resume", "Finding lines to reorder and reword", "Checking every change against your original (Truth Mode)", "Setting aside requirements you do not meet"]}
                  hold={live}
                  onDone={
                    live
                      ? undefined
                      : () => {
                          setAnalyzed((a) => [...a, job.id]);
                          setWorking(false);
                        }
                  }
                />
              </Card>
              <Card>
                <SkeletonLines lines={6} />
              </Card>
            </div>
          )}

          {isAnalyzed && !working && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
              <div className="min-w-0 space-y-4">
                <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center">
                  <div className="flex-1 text-sm">
                    <span className="num font-semibold">{changes.length}</span> suggested changes. <span className="num font-semibold text-success">{accepted}</span> accepted, <span className="num font-semibold">{rejected}</span> rejected,{" "}
                    <span className="num font-semibold text-warning">{pending}</span> waiting.
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="flex h-full">
                        <div className="bg-success transition-all duration-500" style={{ width: `${(accepted / changes.length) * 100}%` }} />
                        <div className="bg-muted-foreground/40 transition-all duration-500" style={{ width: `${(rejected / changes.length) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Segmented<"all" | "pending">
                      value={filter}
                      onChange={setFilter}
                      options={[
                        { value: "all", label: "All" },
                        { value: "pending", label: `Waiting (${pending})` },
                      ]}
                    />
                    {pending > 0 && (
                      <Button size="sm" variant="outline" onClick={() => bulk("accepted")}>
                        <CheckCheck /> Accept all
                      </Button>
                    )}
                    {accepted + rejected > 0 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          update((s) => {
                            changes.forEach((c) => delete s.resume.decisions[c.id]);
                          })
                        }
                      >
                        <RotateCcw /> Reset
                      </Button>
                    )}
                  </div>
                </div>

                <ol className="space-y-3">
                  {shown.map((c, i) => (
                    <ChangeRow key={c.id} c={c} index={i} decision={decisions[c.id]} onDecide={(d) => decide(c.id, d)} />
                  ))}
                  {shown.length === 0 && (
                    <li className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Every change has a decision. Check the Preview tab, then save it as a version.</li>
                  )}
                </ol>

                <section className="rounded-xl border bg-card p-5">
                  <h2 className="flex items-center gap-2 font-semibold">
                    <Ban className="h-4 w-4 text-danger" /> What Truth Mode stopped
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">Edits the tailor considered and refused, because they would have added something that is not in your resume.</p>
                  <ul className="mt-3 space-y-2">
                    {BLOCKED_EDITS.map((b) => (
                      <li key={b.text} className="flex gap-3 rounded-lg bg-muted/50 p-3 text-sm">
                        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <span>
                          <span className="font-medium line-through decoration-danger/60">{b.text}</span>
                          <span className="block text-muted-foreground">{b.why}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>

                <div className="sticky bottom-20 z-10 flex flex-col gap-3 rounded-xl border bg-background/95 p-4 shadow-lift backdrop-blur sm:flex-row sm:items-center lg:bottom-4">
                  <div className="flex-1 text-sm">
                    {accepted === 0 ? "Accept at least one change to save a version." : <>Saving will include <b className="num">{accepted}</b> accepted change{accepted === 1 ? "" : "s"} and nothing else.</>}
                  </div>
                  <Button variant="outline" onClick={() => setTab("preview")}>
                    <FileText /> Preview
                  </Button>
                  <Button disabled={accepted === 0} onClick={() => void saveVersion()}>
                    <Save /> {savedVersion ? "Update version" : "Save as new version"}
                  </Button>
                </div>
              </div>

              <div className="space-y-6 lg:sticky lg:top-20 lg:self-start">
                <AtsCard changes={changes} decisions={decisions} />
                <GapsPanel job={job} />
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="preview">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              The document exactly as it would be sent. <span className="rounded bg-success-soft px-1.5 py-0.5 text-success">Highlighted</span> lines are accepted changes.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => printResume(built, `${built.name.replace(/\s+/g, "_")}_Resume`, state.resume.templateId, state.profile.headline)}>
                <Printer /> Print or save PDF
              </Button>
              <Button size="sm" disabled={accepted === 0} onClick={() => void saveVersion()}>
                <Save /> Save version
              </Button>
            </div>
          </div>
          <div className="card-base mb-5 p-5 sm:p-6">
            <TemplatePicker
              label="Page layout"
              items={RESUME_TEMPLATES.map((t) => ({
                id: t.id,
                name: t.name,
                blurb: t.blurb,
                bestFor: t.bestFor,
                html: renderResumeHtml(built, t.id, t.name, state.profile.headline),
              }))}
              value={state.resume.templateId}
              onChange={(id) => update((d) => void (d.resume.templateId = id))}
            />
          </div>
          <ResumeDoc r={built} highlight />
        </TabsContent>

        <TabsContent value="versions">
          <Card className="overflow-hidden p-0 sm:p-0">
            <div className="border-b p-5">
              <SectionTitle sub={pro ? "Which version gets responses. Based on applications sent from CareerQuest." : "Response rates by version are part of Pro."}>Saved versions</SectionTitle>
            </div>
            <ul className="divide-y">
              {state.resume.versions.map((v) => {
                const rate = v.sends ? Math.round((v.responses / v.sends) * 100) : 0;
                const best = v.id === "v-supply";
                return (
                  <li key={v.id} className="flex flex-col gap-4 p-5 md:flex-row md:items-center">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">{v.name}</span>
                          {state.resume.activeVersionId === v.id && <Pill size="xs" tone="primary">Default</Pill>}
                          {best && pro && <Pill size="xs" tone="success" icon={Star}>Best response rate</Pill>}
                        </div>
                        <div className="text-sm text-muted-foreground">{v.target}</div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {v.note} {v.createdDaysAgo === 0 ? "Created today." : `Created ${v.createdDaysAgo} days ago.`}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-center">
                        <ScoreRing value={v.ats} size={46} label={`ATS score for ${v.name}`} />
                        <div className="mt-1 text-[10px] text-muted-foreground">ATS</div>
                      </div>
                      <div className="w-40">
                        {pro ? (
                          <>
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">
                                <span className="num">{v.responses}</span> of <span className="num">{v.sends}</span> got a response
                              </span>
                              <span className="num font-semibold">{v.sends ? `${rate}%` : "n/a"}</span>
                            </div>
                            <ScoreBar value={rate} className="mt-1.5" height={6} tone={rate >= 30 ? "success" : rate > 0 ? "primary" : "warning"} label={`Response rate for ${v.name}`} />
                          </>
                        ) : (
                          <Link to="/app/billing" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                            <Lock className="h-3.5 w-3.5" /> Response analytics with Pro
                          </Link>
                        )}
                      </div>
                      <div className="flex gap-1">
                        {state.resume.activeVersionId !== v.id && (
                          <Button size="xs" variant="ghost" onClick={() => update((s) => void (s.resume.activeVersionId = v.id))}>
                            Make default
                          </Button>
                        )}
                        {v.id !== "v-base" && (
                          <Button size="icon-sm" variant="ghost" aria-label={`Delete ${v.name}`} onClick={() => setConfirmDelete(v.id)}>
                            <Trash2 />
                          </Button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this version?</AlertDialogTitle>
            <AlertDialogDescription>Receipts that used it keep their own copy, so your proof is safe. This only removes it from your list.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                update((s) => {
                  s.resume.versions = s.resume.versions.filter((v) => v.id !== confirmDelete);
                  if (s.resume.activeVersionId === confirmDelete) s.resume.activeVersionId = "v-supply";
                });
                toast("Version deleted");
                setConfirmDelete(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
