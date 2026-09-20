import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Building2, CheckCircle2, CircleDashed, ExternalLink, Languages, Map as MapIcon, XCircle } from "lucide-react";
import { Card, SectionTitle } from "@/components/common";
import { Pill } from "@/components/status";
import { Button } from "@/components/ui/button";
import { TranslatorRow } from "@/components/TranslatorRows";
import { SEVERITY_LABEL } from "@/data/gaps";
import { patchJob, type Job } from "@/data/jobs";
import { enrichJob } from "@/live/pipeline";
import { cn } from "@/lib/utils";

const attempted = new Set<string>();

/** Runs the full analysis the first time a job is opened, then swaps in the result. */
export function useEnrich(job?: Job) {
  const [failed, setFailed] = useState(false);
  const id = job?.id;
  const needs = !!job?.live && job.translations === undefined;
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

export function LiveAboutCard({ job, loading }: { job: Job; loading: boolean }) {
  const text = job.descriptionText ?? "";
  const paras = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const truncated = text.length < 900 && !/careers page/i.test(job.source);
  return (
    <Card>
      <SectionTitle>About the role</SectionTitle>
      <div className="space-y-3 text-[15px] leading-relaxed text-foreground/85">
        {paras.length === 0 ? <p className="text-muted-foreground">The source did not share a description. Open the posting to read it.</p> : paras.slice(0, 40).map((p, i) => <p key={i} className="whitespace-pre-line">{p}</p>)}
      </div>
      {truncated && job.applyUrl && (
        <div className="mt-4 flex flex-col gap-2 rounded-lg bg-muted/50 p-3 text-sm sm:flex-row sm:items-center">
          <span className="flex-1 text-muted-foreground">This is the excerpt the job board shared. The full posting is on the employer's page.</span>
          <Button size="sm" variant="outline" asChild>
            <a href={job.applyUrl} target="_blank" rel="noopener noreferrer">
              Read the full posting <ExternalLink />
            </a>
          </Button>
        </div>
      )}
      <h3 className="mb-2 mt-6 font-semibold">What they ask for, checked against your resume</h3>
      {loading ? (
        <Skeleton lines={4} />
      ) : (job.reqChecks ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">We could not pick out clear requirements from this posting.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {(job.reqChecks ?? []).map((r) => (
            <li key={r.text} className="flex gap-2.5">
              {r.status === "met" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-label="You meet this" /> : r.status === "partial" ? <CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-label="Partial match" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-label="Gap" />}
              <span>
                {r.text}
                {r.note && <span className={cn("ml-2 text-xs", r.status === "gap" ? "text-danger" : r.status === "partial" ? "text-warning" : "text-muted-foreground")}>{r.note}</span>}
              </span>
            </li>
          ))}
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
  const site = job.signals.companySite;
  const rows: [string, string][] = [
    ["Posted by", job.signals.poster === "agency" ? "A staffing agency" : "The employer"],
    ["Careers page check", site === "confirmed" ? `Found on their ${job.atsProvider ?? ""} careers page`.replace("  ", " ") : site === "missing" ? "Not found on their careers page" : "Not confirmed yet"],
    ["Listing source", job.source],
    ["Salary", job.salary ? "Range posted" : "Not posted"],
  ];
  return (
    <Card>
      <SectionTitle icon={Building2}>About this employer</SectionTitle>
      <dl className="space-y-2.5 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="text-right">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">We only show facts we can check. Company ratings, size, and layoff history are not included because there is no source we can use honestly.</p>
    </Card>
  );
}
