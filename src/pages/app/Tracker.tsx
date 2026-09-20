import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowRight, BadgeCheck, CircleDot, GripVertical, MoreHorizontal, Receipt as ReceiptIcon, Send, Trash2 } from "lucide-react";
import { Card, CompanyLogo, PageHeader, ScoreRing } from "@/components/common";
import { MethodBadge, Pill, VerifiedMark } from "@/components/status";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useStore } from "@/store/AppStore";
import { saveApplicationStatus } from "@/live/persist";
import { COLUMNS, EVENT_META, type Application, type Column, type EventType } from "@/data/applications";
import { jobById } from "@/data/jobs";
import { proofScore } from "@/lib/selectors";
import { relFromIso } from "@/lib/date";
import { useDocTitle } from "@/hooks/useDocTitle";
import { cn } from "@/lib/utils";

const COLUMN_EVENT: Partial<Record<Column, EventType>> = { screening: "screen", interview: "interview", offer: "offer", closed: "rejected" };

export function useMoveApp() {
  const { state, update } = useStore();
  return (app: Application, to: Column, note?: string) => {
    if (app.column === to) return;
    if (to !== "saved" && !app.receipt?.submittedAt && app.column === "saved") {
      toast("Apply first", { description: "Cards move past Saved once there is a receipt. Open the job to apply." });
      return false;
    }
    update((s) => {
      const a = s.applications.find((x) => x.id === app.id)!;
      a.column = to;
      const ev = COLUMN_EVENT[to];
      if (ev) a.events.push({ id: `e${Date.now()}`, type: ev, at: new Date().toISOString(), note: note ?? `You moved this to ${COLUMNS.find((c) => c.id === to)!.label}.` });
    });
    if (state.mode === "live") void saveApplicationStatus(app.jobId, to);
    toast.success(`Moved to ${COLUMNS.find((c) => c.id === to)!.label}`, { description: jobById(app.jobId)!.title });
    return true;
  };
}

function AppCard({ app, onDragStart, dragging }: { app: Application; onDragStart: (id: string) => void; dragging: boolean }) {
  const job = jobById(app.jobId)!;
  const move = useMoveApp();
  const { update } = useStore();
  const nav = useNavigate();
  const last = [...app.events].filter((e) => !e.future).pop()!;
  const next = app.events.find((e) => e.future);
  return (
    <article
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", app.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart(app.id);
      }}
      className={cn("group card-base cursor-grab p-3.5 transition-all hover:border-primary/40 hover:shadow-lift active:cursor-grabbing", dragging && "rotate-1 opacity-50")}
      aria-label={`${job.title} at ${job.company.name}`}
    >
      <div className="flex items-start gap-2.5">
        <CompanyLogo company={job.company} size={32} />
        <div className="min-w-0 flex-1">
          <Link to={app.receipt ? `/app/receipts/${app.id}` : `/app/jobs/${job.id}`} className="block text-sm font-semibold leading-snug hover:text-primary">
            {job.title}
          </Link>
          <div className="truncate text-xs text-muted-foreground">{job.company.name}</div>
        </div>
        <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/50 group-hover:text-muted-foreground" aria-hidden />
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {app.receipt ? <MethodBadge method={app.receipt.method} size="xs" /> : <Pill size="xs" tone="muted">Not sent yet</Pill>}
        {app.receipt?.submittedAt && <VerifiedMark verified={app.receipt.confirmation.verified} size="xs" />}
      </div>
      <div className="mt-2.5 text-xs text-muted-foreground">
        <span className="font-medium text-foreground/80">{EVENT_META[last.type].label}</span> · {relFromIso(last.at)}
      </div>
      {next && <div className="mt-1 rounded-md bg-primary-soft px-2 py-1 text-xs text-primary">Next: {next.note?.split(",")[0]}</div>}
      {!next && app.nextStep && <div className="mt-1 text-xs text-muted-foreground">{app.nextStep}</div>}
      <div className="mt-3 flex items-center justify-between border-t pt-2.5">
        {app.receipt ? (
          <Link to={`/app/receipts/${app.id}`} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
            <ReceiptIcon className="h-3.5 w-3.5" /> Receipt
          </Link>
        ) : (
          <Link to={`/app/jobs/${job.id}?apply=1`} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
            <Send className="h-3.5 w-3.5" /> Apply
          </Link>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" className="h-7 w-7" aria-label={`Move ${job.title}`}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel className="text-xs">Move to</DropdownMenuLabel>
            {COLUMNS.filter((c) => c.id !== app.column).map((c) => (
              <DropdownMenuItem key={c.id} onSelect={() => move(app, c.id)}>
                {c.label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => nav(`/app/jobs/${job.id}`)}>Open job</DropdownMenuItem>
            {!app.receipt && (
              <DropdownMenuItem
                className="text-danger"
                onSelect={() => {
                  update((s) => void (s.applications = s.applications.filter((x) => x.id !== app.id)));
                  toast("Removed from tracker");
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Remove
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </article>
  );
}

export default function Tracker() {
  useDocTitle("Tracker");
  const { state } = useStore();
  const move = useMoveApp();
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<Column | null>(null);
  const proof = proofScore(state.applications);

  const onDrop = (col: Column) => {
    const app = state.applications.find((a) => a.id === dragId);
    setOver(null);
    setDragId(null);
    if (app) move(app, col);
  };

  return (
    <div>
      <PageHeader
        title="Application Tracker"
        sub="Every application, where it stands, and the receipt to prove it. Drag cards between columns, or use the menu on each card."
        actions={
          <Button asChild variant="outline">
            <Link to="/app/matches">
              Find more roles <ArrowRight />
            </Link>
          </Button>
        }
      />

      {/* Proof Score */}
      <Card className="mb-6">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:items-center">
          <div className="flex items-center gap-4">
            <ScoreRing value={proof.pct} size={92} stroke={8} tone="success" sub="verified" label="Proof Score" />
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <BadgeCheck className="h-5 w-5 text-success" /> Proof Score
              </h2>
              <p className="max-w-xs text-sm text-muted-foreground">
                <span className="num font-semibold text-foreground">{proof.verified}</span> of <span className="num font-semibold text-foreground">{proof.total}</span> submitted applications have a verified confirmation.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { m: "submitted" as const, n: proof.byMethod.submitted, l: "Submitted by CareerQuest" },
              { m: "prefilled" as const, n: proof.byMethod.prefilled, l: "Prefilled, you submitted" },
              { m: "manual" as const, n: proof.byMethod.manual, l: "Manual required" },
            ].map((x) => (
              <div key={x.m} className={cn("rounded-lg border p-3", x.m === "submitted" ? "border-success-border bg-success-soft/50" : x.m === "prefilled" ? "border-info-border bg-info-soft/50" : "border-warning-border bg-warning-soft/50")}>
                <div className="num text-2xl font-semibold">{x.n}</div>
                <div className={cn("mt-0.5 text-xs font-medium leading-snug", x.m === "submitted" ? "text-success" : x.m === "prefilled" ? "text-info" : "text-warning")}>{x.l}</div>
              </div>
            ))}
          </div>
          <div className="lg:col-span-2">
            {proof.unverified.length > 0 ? (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-warning-border bg-warning-soft px-4 py-3 text-sm">
                <div className="flex items-center gap-1.5 font-semibold text-warning">
                  <CircleDot className="h-4 w-4" /> {proof.unverified.length} not verified yet
                </div>
                <ul className="flex flex-wrap gap-x-4 gap-y-1">
                  {proof.unverified.map((a) => (
                    <li key={a.id}>
                      <Link to={`/app/receipts/${a.id}`} className="font-medium text-foreground/85 underline underline-offset-2 hover:text-foreground">
                        {jobById(a.jobId)!.company.name}
                      </Link>
                    </li>
                  ))}
                </ul>
                <span className="text-xs text-muted-foreground">Add a confirmation email or screenshot on the receipt to verify.</span>
              </div>
            ) : (
              <div className="rounded-lg border border-success-border bg-success-soft p-3 text-sm text-success">Every application is verified.</div>
            )}
          </div>
        </div>
        <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">We never label anything "auto-applied." Each card shows exactly how it was sent. Honesty is the feature.</p>
      </Card>

      {/* Board */}
      <div className="-mx-4 overflow-x-auto px-4 pb-4 scrollbar-thin sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0" tabIndex={0} aria-label="Application board, scrolls sideways">
        <div className="grid w-max grid-flow-col auto-cols-[250px] gap-3">
          {COLUMNS.map((col) => {
            const items = state.applications.filter((a) => a.column === col.id);
            return (
              <section
                key={col.id}
                aria-label={`${col.label} column, ${items.length} cards`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOver(col.id);
                }}
                onDragLeave={() => setOver((o) => (o === col.id ? null : o))}
                onDrop={(e) => {
                  e.preventDefault();
                  onDrop(col.id);
                }}
                className={cn("flex min-h-[420px] flex-col rounded-xl border bg-muted/40 p-2.5 transition-colors", over === col.id && "border-primary bg-primary-soft/60")}
              >
                <header className="mb-2.5 flex items-center justify-between px-1">
                  <div>
                    <h3 className="text-sm font-semibold">{col.label}</h3>
                    <p className="text-[11px] text-muted-foreground">{col.hint}</p>
                  </div>
                  <span className="num rounded-full bg-background px-2 py-0.5 text-xs font-semibold shadow-sm">{items.length}</span>
                </header>
                <div className="flex flex-1 flex-col gap-2.5">
                  {items.map((a) => (
                    <AppCard key={a.id} app={a} onDragStart={setDragId} dragging={dragId === a.id} />
                  ))}
                  {items.length === 0 && <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">Drop a card here</div>}
                </div>
              </section>
            );
          })}
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Scroll sideways to see every column. On a phone or with a keyboard, use the menu on each card to move it.</p>
    </div>
  );
}
