import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { AlertTriangle, Building2, CheckCircle2, ChevronDown, ChevronUp, CircleDashed, ExternalLink, Globe, HandHeart, Languages, Map as MapIcon, PenLine, Undo2, XCircle } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStore } from "@/store/AppStore";
import { BASE_RESUME } from "@/data/user";
import { claimForRequirement } from "@/lib/skillClaims";
import { Card, SectionTitle } from "@/components/common";
import { Pill } from "@/components/status";
import { Button } from "@/components/ui/button";
import { TranslatorRow } from "@/components/TranslatorRows";
import { EditJobDialog } from "@/components/EditJobDialog";
import { SEVERITY_LABEL } from "@/data/gaps";
import { patchJob, salaryText, type Job } from "@/data/jobs";
import { enrichJob } from "@/live/pipeline";
import { cn } from "@/lib/utils";

const attempted = new Set<string>();

/** Runs the full analysis the first time a job is opened, then swaps in the result. */
export function useEnrich(job?: Job) {
  const [failed, setFailed] = useState(false);
  const id = job?.id;
  const needs = !!job?.live && !job.unscored && job.translations === undefined;
  useEffect(() => {
    if (!id || !needs || attempted.has(id)) return;
    attempted.add(id);
    enrichJob(id)
      .then((j) => (j ? patchJob(j) : setFailed(true)))
      .catch(() => setFailed(true));
  }, [id, needs]);
  return { loading: needs && !failed && attempted.has(id ?? "") !== false, failed: needs && failed };
}

function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2.5" aria-busy="true" aria-label="Reading this posting against your resume">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="skeleton h-4" style={{ width: `${[92, 100, 76, 88][i % 4]}%` }} />
      ))}
    </div>
  );
}

export function LiveTranslatorCard({ job, loading, failed }: { job: Job; loading: boolean; failed: boolean }) {
  return (
    <Card>
      <SectionTitle icon={Languages} sub="How your real experience reads for this job. Only relabeled, never added to." right={<Button asChild variant="ghost" size="sm"><Link to={`/app/studio?job=${job.id}`}>Open in Studio</Link></Button>}>
        Career Translator for this role
      </SectionTitle>
      {loading ? (
        <>
          <p className="mb-3 text-sm text-muted-foreground">Reading this posting against your resume. About 10 seconds.</p>
          <Skeleton lines={4} />
        </>
      ) : failed ? (
        <p className="text-sm text-muted-foreground">We could not finish the analysis for this posting. Reload the page to try again.</p>
      ) : (
        <>
          {job.storyLine && (
            <blockquote className="mb-4 rounded-lg border-l-4 border-primary bg-primary-soft/60 px-4 py-3 text-sm leading-relaxed">
              <span className="text-xs font-semibold uppercase tracking-wide text-primary">Your story in one line</span>
              <p className="mt-1">{job.storyLine}</p>
            </blockquote>
          )}
          <div className="space-y-2.5">
            {(job.translations ?? []).map((t, i) => (
              <TranslatorRow key={t.from} index={i} from={t.from} phrases={t.phrases} />
            ))}
            {(job.translations ?? []).length === 0 && <p className="text-sm text-muted-foreground">Nothing on your resume translated cleanly for this posting, and we will not force it.</p>}
          </div>
        </>
      )}
    </Card>
  );
}

/** The opening of a posting: enough to know what the job is, cut at the end of a sentence. */
export function shortDescription(text: string, max = 420): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  return end > max * 0.5 ? cut.slice(0, end + 1) : `${cut.slice(0, cut.lastIndexOf(" "))}...`;
}

export function LiveAboutCard({ job }: { job: Job }) {
  const [full, setFull] = useState(false);
  const text = job.descriptionText ?? "";
  const paras = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const short = shortDescription(text);
  const hasMore = text.replace(/\s+/g, " ").trim().length > short.length;
  const truncated = text.length < 900 && !/careers page/i.test(job.source);
  return (
    <Card>
      <SectionTitle icon={undefined}>About the role</SectionTitle>
      {!text.trim() ? (
        <p className="text-[15px] text-muted-foreground">The source did not share a description. Open the posting to read it.</p>
      ) : full ? (
        <div className="space-y-3 text-[15px] leading-relaxed text-foreground/85">
          {paras.slice(0, 40).map((p, i) => (
            <p key={i} className="whitespace-pre-line">
              {p}
            </p>
          ))}
        </div>
      ) : (
        <p className="text-[15px] leading-relaxed text-foreground/85">{short}</p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {hasMore && (
          <Button size="sm" variant="outline" onClick={() => setFull((v) => !v)} aria-expanded={full}>
            {full ? <ChevronUp /> : <ChevronDown />} {full ? "Show less" : "View full post"}
          </Button>
        )}
        {job.applyUrl && (
          <Button size="sm" variant="ghost" asChild>
            <a href={job.applyUrl} target="_blank" rel="noopener noreferrer">
              {truncated ? "Read the full posting on the employer's page" : "Open the original posting"} <ExternalLink />
            </a>
          </Button>
        )}
      </div>
      {full && truncated && <p className="mt-3 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">This is the excerpt the job board shared. The full posting is on the employer's page.</p>}
    </Card>
  );
}

/**
 * What the posting asks for, checked against the resume. Where the resume is silent the person may
 * well have it, so each of those can be answered: "I have this", in their own words. It counts as met
 * for them, and can go straight onto the resume as a line they can then edit.
 */
export function LiveRequirementsCard({ job, loading }: { job: Job; loading: boolean }) {
  const { state, update } = useStore();
  const claims = state.resume.claims?.[job.id] ?? {};
  const [open, setOpen] = useState<string | null>(null);
  const [detail, setDetail] = useState("");
  const [where, setWhere] = useState("remember");
  const reqs = job.reqChecks ?? [];

  const startAsk = (text: string) => {
    setOpen(text);
    setDetail("");
    setWhere("remember");
  };

  const save = (text: string) => {
    const said = detail.trim();
    if (said.split(/\s+/).length < 3) return toast("Say a little more", { description: "A few words about what you did is enough, like where and for how long." });
    update((s) => {
      if (!s.resume.claims) s.resume.claims = {};
      if (!s.resume.claims[job.id]) s.resume.claims[job.id] = {};
      s.resume.claims[job.id][text] = { detail: said, at: new Date().toISOString() };
      if (where !== "remember") {
        if (!s.resume.added) s.resume.added = {};
        if (!s.resume.added[job.id]) s.resume.added[job.id] = {};
        (s.resume.added[job.id][where] ??= []).push({ id: `add-${Date.now().toString(36)}`, text: said });
      }
    });
    setOpen(null);
    toast.success("Counted as met", { description: where === "remember" ? "We will remember it for this job." : "It is on your resume for this job, in your own words. Edit it in the Studio." });
  };

  const undo = (text: string) =>
    update((s) => {
      if (s.resume.claims?.[job.id]) delete s.resume.claims[job.id][text];
    });

  const met = reqs.filter((r) => r.status === "met" || claims[r.text] || claimForRequirement(state.resume.skillClaims, r.text)).length;

  return (
    <Card>
      <SectionTitle sub={reqs.length ? `${met} of ${reqs.length} covered. If we got one wrong, tell us and it counts.` : undefined}>What they ask for, checked against your resume</SectionTitle>
      {loading ? (
        <Skeleton lines={4} />
      ) : reqs.length === 0 ? (
        <p className="text-sm text-muted-foreground">We could not pick out clear requirements from this posting.</p>
      ) : (
        <ul className="space-y-3 text-sm">
          {reqs.map((r) => {
            const roadmap = claimForRequirement(state.resume.skillClaims, r.text);
            const claim = claims[r.text] ?? (roadmap ? { detail: roadmap.line || roadmap.detail, at: roadmap.at } : undefined);
            const status = claim ? "met" : r.status;
            return (
              <li key={r.text}>
                <div className="flex gap-2.5">
                  {status === "met" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-label="You meet this" /> : status === "partial" ? <CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-label="Partial match" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-label="Gap" />}
                  <div className="min-w-0 flex-1">
                    <span>{r.text}</span>
                    {claim ? (
                      <div className="mt-1 rounded-lg bg-success-soft/60 p-2.5 text-xs">
                        <span className="font-semibold">You told us: </span>
                        {claim.detail}
                        <button type="button" onClick={() => undo(r.text)} className="ml-2 inline-flex items-center gap-1 font-medium text-primary hover:underline">
                          <Undo2 className="h-3 w-3" aria-hidden /> Undo
                        </button>
                      </div>
                    ) : (
                      <>
                        {r.note && <span className={cn("ml-2 text-xs", r.status === "gap" ? "text-danger" : r.status === "partial" ? "text-warning" : "text-muted-foreground")}>{r.note}</span>}
                        {r.status !== "met" && open !== r.text && (
                          <div className="mt-1">
                            <button type="button" onClick={() => startAsk(r.text)} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                              <HandHeart className="h-3.5 w-3.5" aria-hidden /> I have this
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
                {open === r.text && !claim && (
                  <div className="ml-6 mt-2 space-y-2.5 rounded-xl border bg-muted/30 p-3">
                    <label htmlFor="claim" className="block text-sm font-medium">
                      Do you have this? Tell us about it.
                    </label>
                    <p className="text-xs text-muted-foreground">Say what you did and roughly where and for how long. Write it like a line on a resume, in your own words.</p>
                    <Textarea id="claim" value={detail} onChange={(e) => setDetail(e.target.value)} rows={3} maxLength={400} placeholder="For example: Built weekly reports in SQL for the district team at Bayside, 2021 to 2024" className="text-sm" />
                    <div className="flex flex-wrap items-center gap-2">
                      <Select value={where} onValueChange={setWhere}>
                        <SelectTrigger className="h-9 w-full text-sm sm:w-[280px]" aria-label="What to do with it">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="remember">Just remember it for this job</SelectItem>
                          {BASE_RESUME.roles.map((role) => (
                            <SelectItem key={role.id} value={role.id}>
                              Add it to my resume under {role.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button size="sm" onClick={() => save(r.text)}>
                        Save
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setOpen(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

export function LiveGapsCard({ job, loading }: { job: Job; loading: boolean }) {
  return (
    <Card className="border-warning-border">
      <SectionTitle icon={AlertTriangle} sub="Requirements that are not in your resume. We will never add these for you. Here is how to handle each one honestly." right={<Button asChild variant="ghost" size="sm"><Link to="/app/roadmap"><MapIcon /> Roadmap</Link></Button>}>
        Gaps
      </SectionTitle>
      {loading ? (
        <Skeleton lines={3} />
      ) : job.gaps.length === 0 ? (
        <p className="text-sm text-muted-foreground">No gaps found against what this posting asks for.</p>
      ) : (
        <ul className="space-y-3">
          {job.gaps.map((g) => (
            <li key={g.id} className="rounded-lg border border-warning-border bg-warning-soft/50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{g.label}</span>
                <Pill size="xs" tone={g.severity === "dealbreaker" ? "danger" : g.severity === "trainable" ? "warning" : "muted"}>{SEVERITY_LABEL[g.severity]}</Pill>
              </div>
              <p className="mt-1.5 text-sm text-foreground/80">{g.note}</p>
              {g.coverLetterLine && (
                <p className="mt-2 text-sm">
                  <span className="font-medium">In your cover letter: </span>
                  <span className="italic text-foreground/80">"{g.coverLetterLine}"</span>
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function LiveCompanyCard({ job }: { job: Job }) {
  const [editOpen, setEditOpen] = useState(false);
  const site = job.signals.companySite;
  // A job someone added themselves never went through an automated careers page check, so that row
  // would only ever read "Not confirmed yet" for them. It says nothing true, so it is left out.
  const rows: [string, string][] = [
    ["Posted by", job.signals.poster === "agency" ? "A staffing agency" : "The employer"],
    ...(job.imported ? [] : ([["Careers page check", site === "confirmed" ? `Found on their ${job.atsProvider ?? ""} careers page`.replace("  ", " ") : site === "missing" ? "Not found on their careers page" : "Not confirmed yet"]] as [string, string][])),
    ["Listing source", job.source],
    ["Salary", salaryText(job.salary)],
  ];
  return (
    <Card>
      <SectionTitle icon={Building2} right={job.imported ? <Button variant="ghost" size="sm" onClick={() => setEditOpen(true)}><PenLine /> Edit</Button> : undefined}>About this employer</SectionTitle>
      {job.company.about && <p className="mb-3 text-sm text-foreground/80">{job.company.about}</p>}
      <dl className="space-y-2.5 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="text-right">{v}</dd>
          </div>
        ))}
      </dl>
      {job.company.website && (
        <a href={job.company.website} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
          <Globe className="h-3.5 w-3.5" /> {job.company.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
        </a>
      )}
      {!job.imported && <p className="mt-4 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">We only show facts we can check. Company ratings, size, and layoff history are not included because there is no source we can use honestly.</p>}
      {job.imported && <EditJobDialog job={job} open={editOpen} onOpenChange={setEditOpen} />}
    </Card>
  );
}
