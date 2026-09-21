import { Link } from "react-router-dom";
import { BellRing, ClipboardPaste, Handshake, MailCheck, MessagesSquare, Send, XCircle } from "lucide-react";
import { Card } from "@/components/common";
import { Button } from "@/components/ui/button";
import { jobById } from "@/data/jobs";
import type { TrackerStats } from "@/lib/tracker";
import { NUDGE_AFTER_DAYS } from "@/lib/tracker";
import { cn } from "@/lib/utils";

function Tile({ icon: Icon, label, value, sub, tone }: { icon: React.ComponentType<{ className?: string }>; label: string; value: React.ReactNode; sub?: string; tone?: "success" | "danger" | "primary" }) {
  return (
    <div className="rounded-xl border bg-background p-3.5">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="h-3.5 w-3.5" aria-hidden /> {label}
      </div>
      <div className={cn("num mt-1 font-display text-2xl font-semibold", tone === "success" && "text-success", tone === "danger" && "text-danger", tone === "primary" && "text-primary")}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{sub}</div>}
    </div>
  );
}

const rate = (r: number | null, of: string) => (r === null ? undefined : `${r}% of ${of}`);

/**
 * Where the search stands, in numbers that mean what they say. This replaced
 * the Proof Score: it is no use knowing how many receipts are verified if you
 * cannot see how many employers have actually answered you.
 */
export function StatusSummary({ stats, onAdd }: { stats: TrackerStats; onAdd: () => void }) {
  if (stats.total === 0) {
    return (
      <Card className="mb-6 text-center">
        <Send className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden />
        <p className="mt-2 font-medium">Nothing tracked yet</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">Save a match, or add a job you found yourself or already applied to. Your numbers show up here as things happen.</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Button onClick={onAdd}>
            <ClipboardPaste /> Add a job
          </Button>
          <Button asChild variant="outline">
            <Link to="/app/matches">See your matches</Link>
          </Button>
        </div>
      </Card>
    );
  }

  const top = stats.funnel[0].n || 1;
  const nudges = stats.nudges.slice(0, 4).filter((n) => jobById(n.jobId));

  return (
    <Card className="mb-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Tile icon={Send} label="Applied" value={stats.applied} sub={stats.saved > 0 ? `${stats.saved} saved, not sent` : `${stats.inPlay} still in play`} />
        <Tile icon={MailCheck} label="Heard back" value={stats.answered} sub={rate(stats.answerRate, "applications")} />
        <Tile icon={MessagesSquare} label="Interviews" value={stats.interviews} sub={rate(stats.interviewRate, "applications")} tone="primary" />
        <Tile icon={Handshake} label="Offers" value={stats.offers} sub={rate(stats.offerRate, "applications")} tone="success" />
        <Tile icon={XCircle} label="Rejected" value={stats.rejected} sub={stats.withdrawn > 0 ? `${stats.withdrawn} withdrawn or quiet` : undefined} />
      </div>

      {stats.applied > 0 && (
        <div className="mt-5 grid grid-cols-1 gap-6 border-t pt-5 lg:grid-cols-[1.3fr_1fr]">
          <div>
            <h2 className="text-sm font-semibold">How far they get</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Each step, and the share of the one before it.</p>
            <ul className="mt-3 space-y-2.5">
              {stats.funnel.map((f) => (
                <li key={f.key}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-medium">{f.label}</span>
                    <span className="num text-muted-foreground">
                      {f.n}
                      {f.ofPrevious !== null && f.n > 0 && <span className="ml-1.5 text-xs">({f.ofPrevious}%)</span>}
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={f.n} aria-valuemin={0} aria-valuemax={top} aria-label={`${f.label}: ${f.n}`}>
                    <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${(f.n / top) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="flex items-center gap-1.5 text-sm font-semibold">
              <BellRing className="h-4 w-4 text-warning" aria-hidden /> Worth a follow up
            </h2>
            {nudges.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                {stats.waiting > 0 ? `${stats.waiting} waiting to hear. Nothing has gone quiet for ${NUDGE_AFTER_DAYS} days yet.` : "Nothing is waiting on an answer right now."}
              </p>
            ) : (
              <>
                <p className="mt-0.5 text-xs text-muted-foreground">No answer in {NUDGE_AFTER_DAYS} days or more. A short note to the recruiter often gets a reply.</p>
                <ul className="mt-2 space-y-1.5">
                  {nudges.map((n) => {
                    const job = jobById(n.jobId)!;
                    return (
                      <li key={n.id}>
                        <Link to={`/app/receipts/${n.id}`} className="flex items-center justify-between gap-2 rounded-lg border p-2.5 text-sm transition-colors hover:border-primary/40 hover:bg-accent/40">
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{job.company.name}</span>
                            <span className="block truncate text-xs text-muted-foreground">{job.title}</span>
                          </span>
                          <span className="num shrink-0 rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-semibold text-warning">{n.days} days</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
