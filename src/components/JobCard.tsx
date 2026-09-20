import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Bookmark, BookmarkCheck, Clock3, EyeOff, Languages, MapPin, TrendingDown, TrendingUp, Users, Wallet, Sparkle } from "lucide-react";
import { CompanyLogo, ScoreRing } from "@/components/common";
import { LegitBadgeView, Pill } from "@/components/status";
import { Button } from "@/components/ui/button";
import { salaryText, type Job } from "@/data/jobs";
import { COLUMNS } from "@/data/applications";
import { relDays } from "@/lib/date";
import { useStore } from "@/store/AppStore";
import { cn } from "@/lib/utils";

export function useSaveJob() {
  const { state, update } = useStore();
  return (job: Job) => {
    const existing = state.applications.find((a) => a.jobId === job.id);
    if (existing) {
      if (existing.column === "saved" && !existing.receipt) {
        update((s) => {
          s.applications = s.applications.filter((a) => a.id !== existing.id);
        });
        toast("Removed from your tracker", { description: job.title });
      }
      return;
    }
    update((s) => {
      s.applications.unshift({
        id: `a${Date.now().toString(36)}`,
        jobId: job.id,
        column: "saved",
        savedAt: new Date().toISOString(),
        events: [{ id: `e${Date.now()}`, type: "saved", at: new Date().toISOString() }],
        nextStep: "Tailor your resume, then apply.",
      });
    });
    toast.success("Saved to your tracker", { description: `${job.title} at ${job.company.name}` });
  };
}

export function JobCard({ job, compact, index = 0 }: { job: Job; compact?: boolean; index?: number }) {
  const { state, update } = useStore();
  const save = useSaveJob();
  const app = state.applications.find((a) => a.jobId === job.id);
  const col = app ? COLUMNS.find((c) => c.id === app.column)! : null;

  const dismiss = () => {
    update((s) => void s.dismissedJobIds.push(job.id));
    toast("Hidden from your feed", {
      description: "We will show fewer roles like this.",
      action: { label: "Undo", onClick: () => update((s) => void (s.dismissedJobIds = s.dismissedJobIds.filter((x) => x !== job.id))) },
    });
  };

  return (
    <article
      className={cn("card-base card-hover group relative p-4 sm:p-5 animate-fade-up", job.legit.badge === "ghost" && "border-danger-border/70")}
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
      aria-labelledby={`job-${job.id}`}
    >
      <div className="flex gap-3 sm:gap-4">
        <CompanyLogo company={job.company} size={44} className="hidden sm:flex" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 id={`job-${job.id}`} className="text-[15px] font-semibold leading-snug sm:text-base">
                <Link to={`/app/jobs/${job.id}`} className="after:absolute after:inset-0 after:rounded-xl hover:text-primary focus-visible:outline-none">
                  {job.title}
                </Link>
              </h3>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted-foreground">
                <span className="font-medium text-foreground/80">{job.company.name}</span>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" aria-hidden />
                  {job.location}
                </span>
                <span aria-hidden>·</span>
                <span>{job.mode}</span>
              </div>
            </div>
            <ScoreRing value={job.match} size={compact ? 46 : 52} sub="match" label="Match score" />
          </div>

          <div className="relative z-[1] mt-3 flex flex-wrap items-center gap-1.5">
            <LegitBadgeView badge={job.legit.badge} score={job.legit.score} size="xs" />
            <Pill size="xs" tone={job.postedDaysAgo <= 3 ? "primary" : "muted"} icon={Clock3}>
              {job.postedDaysAgo === 0 ? "Posted today" : `Posted ${relDays(job.postedDaysAgo).toLowerCase()}`}
            </Pill>
            {job.applicants !== null && (
              <Pill size="xs" tone="muted" icon={Users}>
                <span className="num">{job.applicants.toLocaleString()}</span> applicants
                {job.signals.applicantTrend === "rising" ? <TrendingUp className="h-3 w-3" aria-label="rising" /> : job.signals.applicantTrend === "stalled" ? <TrendingDown className="h-3 w-3" aria-label="stalled" /> : null}
              </Pill>
            )}
            <Pill size="xs" tone="muted" icon={Wallet}>
              {salaryText(job.salary)}
            </Pill>
            {job.live && job.signals.poster === "agency" && (
              <Pill size="xs" tone="warning">
                Staffing agency
              </Pill>
            )}
            {job.careerChangerFriendly && (
              <Pill size="xs" tone="success" icon={Sparkle}>
                Career changer friendly
              </Pill>
            )}
          </div>

          {!compact && (
            <p className="mt-3 flex gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm">
              <Languages className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
              <span>
                <span className="font-medium">Why this matched you: </span>
                {job.why}
              </span>
            </p>
          )}

          <div className="relative z-[1] mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              {app ? (
                <Button asChild variant="soft" size="xs">
                  <Link to={app.receipt ? `/app/receipts/${app.id}` : "/app/tracker"}>
                    <BookmarkCheck /> In tracker: {col?.label}
                  </Link>
                </Button>
              ) : (
                <Button variant="outline" size="xs" onClick={() => save(job)}>
                  <Bookmark /> Save
                </Button>
              )}
              {!app && (
                <Button variant="ghost" size="xs" onClick={dismiss} className="text-muted-foreground">
                  <EyeOff /> Not for me
                </Button>
              )}
            </div>
            <Link to={`/app/jobs/${job.id}`} className="text-xs font-semibold text-primary opacity-80 transition-opacity group-hover:opacity-100">
              View details and apply
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
