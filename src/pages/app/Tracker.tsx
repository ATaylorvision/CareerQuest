import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowRight, ClipboardPaste, FileText, GripVertical, Lock, MessagesSquare, MoreHorizontal, Receipt as ReceiptIcon, Send, Trash2, Users } from "lucide-react";
import { CompanyLogo, PageHeader } from "@/components/common";
import { MethodBadge, Pill, VerifiedMark } from "@/components/status";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useStore } from "@/store/AppStore";
import { removeApplication, saveApplication } from "@/live/persist";
import { api } from "@/live/api";
import { useLive } from "@/live/LiveProvider";
import { StatusSummary } from "@/components/tracker/StatusSummary";
import { ImportJobDialog } from "@/components/ImportJobDialog";
import { COLUMNS, EVENT_META, type Application, type Column, type EventType } from "@/data/applications";
import { jobById } from "@/data/jobs";
import { trackerStats } from "@/lib/tracker";
import { relFromIso } from "@/lib/date";
import { useDocTitle } from "@/hooks/useDocTitle";
import { cn } from "@/lib/utils";

const COLUMN_EVENT: Partial<Record<Column, EventType>> = { screening: "screen", interview: "interview", offer: "offer", rejected: "rejected", withdrawn: "noresponse" };

export function useMoveApp() {
  const { state, update } = useStore();
  return (app: Application, to: Column, note?: string) => {
    if (app.column === to) return;
    const at = new Date().toISOString();
    const label = COLUMNS.find((c) => c.id === to)!.label;
    const next: Application = { ...app, column: to, events: [...app.events] };

    // Someone moving a saved card forward has applied somewhere we were not part of.
    // We record that they said so, as a manual application, and claim nothing more.
    if (!app.receipt && to !== "saved") {
      next.receipt = { method: "manual", destination: "company", destinationLabel: "Applied outside CareerQuest", submittedAt: at, resumeVersionId: "", coverLetter: "", fields: [], confirmation: { verified: false } };
      next.events.push({ id: `e${Date.now()}s`, type: "submitted", at, note: "You marked this as applied." });
    }
    const ev = COLUMN_EVENT[to];
    if (ev) next.events.push({ id: `e${Date.now()}`, type: ev, at, note: note ?? `You moved this to ${label}.` });
    // Advice written for the old column ("Tailor your resume, closes Friday") is wrong once it has moved.
    next.nextStep = to === "applied" ? "Most employers respond within 7 to 10 business days." : to === "saved" ? app.nextStep : undefined;

    update((s) => {
      const i = s.applications.findIndex((x) => x.id === app.id);
      if (i >= 0) s.applications[i] = next;
    });
    if (state.mode === "live") void saveApplication(next);
    toast.success(`Moved to ${label}`, { description: jobById(app.jobId)?.title });
    return true;
  };
}

function AppCard({ app, onDragStart, dragging }: { app: Application; onDragStart: (id: string) => void; dragging: boolean }) {
  const job = jobById(app.jobId)!;
  const move = useMoveApp();
  const { state, update } = useStore();
  const { reloadJobs } = useLive();
  const nav = useNavigate();

  // Something the person added themselves can be taken back out completely. What
  // CareerQuest sent for them is a record, so it stays.
  const removeCard = async () => {
    update((s) => void (s.applications = s.applications.filter((x) => x.id !== app.id)));
    if (state.mode === "live") {
      if (job.imported) {
        try {
          await api("studio", { action: "removeJob", jobId: job.id });
          await reloadJobs();
        } catch {
          toast.error("We could not remove that everywhere", { description: "It is gone from your board. Please try again if it comes back." });
          return;
        }
      } else {
        void removeApplication(job.id);
      }
    }
    toast("Removed from tracker");
  };
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
        ) : job.imported ? (
          <Link to={`/app/studio?job=${encodeURIComponent(job.id)}`} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
            <FileText className="h-3.5 w-3.5" /> Tailor resume
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
            {(!app.receipt || job.imported) && (
              <DropdownMenuItem className="text-danger" onSelect={() => void removeCard()}>
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
  const stats = trackerStats(state.applications);
  const [importOpen, setImportOpen] = useState(false);
  // Interview prep and Insider Connections belong to an application in flight,
  // so they live here rather than as their own places to remember to visit.
  const talking = state.applications.filter((a) => a.column === "screening" || a.column === "interview");
  const hasConnections = !!state.billing.addOns?.connections;

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
        sub="Every application and where it stands. Drag cards between columns, or use the menu on each card."
        actions={
          <>
            <Button onClick={() => setImportOpen(true)}>
              <ClipboardPaste /> Add a job
            </Button>
            <Button asChild variant="outline">
              <Link to="/app/matches">
                Find more roles <ArrowRight />
              </Link>
            </Button>
          </>
        }
      />

      <StatusSummary stats={stats} onAdd={() => setImportOpen(true)} />

      {/* What to do next with the applications that are moving */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link
          to="/app/interview"
          className="card-base card-hover flex items-start gap-3 p-4 transition-colors"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <MessagesSquare className="h-5 w-5" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 font-semibold">
              Interview prep <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden />
            </span>
            <span className="mt-0.5 block text-sm text-muted-foreground">
              {talking.length > 0
                ? `${talking.length} application${talking.length === 1 ? " is" : "s are"} at the talking stage. Practice the questions these employers actually ask.`
                : "Questions for the roles you are targeting, with answers built from your own resume."}
            </span>
          </span>
        </Link>
        <Link to="/app/connections" className="card-base card-hover flex items-start gap-3 p-4 transition-colors">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Users className="h-5 w-5" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 font-semibold">
              Insider Connections
              {!hasConnections && <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-label="Paid add on" />}
              <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden />
            </span>
            <span className="mt-0.5 block text-sm text-muted-foreground">A referral beats a cold application. Find the people already inside the companies on this board.</span>
          </span>
        </Link>
      </div>

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
      <ImportJobDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}
