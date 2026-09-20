import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Check, ChevronDown, Clock, ExternalLink, GraduationCap, Map as MapIcon, Play, Wallet } from "lucide-react";
import { Card, PageHeader, ScoreBar, ScoreRing } from "@/components/common";
import { Pill } from "@/components/status";
import { Button } from "@/components/ui/button";
import { useStore } from "@/store/AppStore";
import { gapAggregate } from "@/lib/selectors";
import { SEVERITY_LABEL } from "@/data/gaps";
import { useDocTitle } from "@/hooks/useDocTitle";
import { cn } from "@/lib/utils";

export default function Roadmap() {
  useDocTitle("Skill Gap Roadmap");
  const { state, update } = useStore();
  const [params] = useSearchParams();
  const agg = gapAggregate(state);
  const [open, setOpen] = useState<string | null>(params.get("gap") ?? agg.items[0]?.gap.id ?? null);

  useEffect(() => {
    const g = params.get("gap");
    if (g) {
      setOpen(g);
      setTimeout(() => document.getElementById(`gap-${g}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
    }
  }, [params]);

  const setRes = (gapId: string, resId: string, v: "started" | "done" | null) => {
    update((s) => {
      if (v) s.roadmap[resId] = v;
      else delete s.roadmap[resId];
      if (gapId === "wms" && v) {
        s.planDone.p5 = true;
        s.activity[0] = true;
      }
    });
    if (v === "done") toast.success("Marked done", { description: "That counts. Your roadmap and dashboard are updated." });
    if (v === "started") toast("Started", { description: "We will keep it at the top of your plan until it is done." });
  };

  const top3 = agg.items.slice(0, 3);
  const top3Hours = top3.reduce((n, g) => n + g.gap.hoursEstimate, 0);

  return (
    <div>
      <PageHeader
        title="Skill Gap Roadmap"
        sub={
          agg.total === 0
            ? "What is missing across the jobs you are chasing, ranked by how often it comes up, with an honest time estimate for each."
            : agg.fromTracker
              ? `What is missing across the ${agg.total} open jobs in your tracker, ranked by how often it comes up. Each gap has an honest time estimate and free or low cost ways to close it.`
              : `You have not saved any jobs yet, so this reads your ${agg.total} strongest matches instead. Save jobs in your tracker and the roadmap follows those.`
        }
      />

      {/* With nothing to count these read "In of 0 jobs", so they wait for data. */}
      <div className={cn("mb-6 grid-cols-1 gap-3 sm:grid-cols-3", agg.items.length === 0 ? "hidden" : "grid")}>
        <Card className="p-4 sm:p-5">
          <div className="text-xs font-medium text-muted-foreground">Most common gap</div>
          <div className="mt-1.5 font-semibold leading-snug">{agg.items[0]?.gap.label}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            In <span className="num">{agg.items[0]?.jobs.length}</span> of {agg.total} jobs
          </div>
        </Card>
        <Card className="p-4 sm:p-5">
          <div className="text-xs font-medium text-muted-foreground">Time to close the top three</div>
          <div className="num mt-1.5 font-display text-3xl font-semibold">~{top3Hours}h</div>
          <div className="mt-1 text-xs text-muted-foreground">About {Math.ceil(top3Hours / 5)} weeks at 5 hours a week</div>
        </Card>
        <Card className="p-4 sm:p-5">
          <div className="text-xs font-medium text-muted-foreground">Resources finished</div>
          <div className="num mt-1.5 font-display text-3xl font-semibold">{Object.values(state.roadmap).filter((v) => v === "done").length}</div>
          <div className="mt-1 text-xs text-muted-foreground">{Object.values(state.roadmap).filter((v) => v === "started").length} in progress</div>
        </Card>
      </div>

      <ol className="space-y-3">
        {agg.items.map(({ gap, jobs }, i) => {
          const isOpen = open === gap.id;
          const done = gap.resources.filter((r) => state.roadmap[r.id] === "done").length;
          const progress = gap.resources.length ? Math.round((done / gap.resources.length) * 100) : 0;
          const pct = Math.round((jobs.length / agg.total) * 100);
          return (
            <li key={gap.id} id={`gap-${gap.id}`} className={cn("card-base scroll-mt-20 overflow-hidden transition-all", isOpen && "ring-2 ring-primary/15")}>
              <button onClick={() => setOpen(isOpen ? null : gap.id)} className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-accent/40 sm:p-5" aria-expanded={isOpen} aria-controls={`gap-body-${gap.id}`}>
                <span className="num flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted font-display text-lg font-semibold">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{gap.label}</span>
                    <Pill size="xs" tone={gap.severity === "dealbreaker" ? "danger" : gap.severity === "trainable" ? "warning" : "muted"}>
                      {SEVERITY_LABEL[gap.severity]}
                    </Pill>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <ScoreBar value={pct} className="max-w-[240px]" height={6} tone="primary" label={`Appears in ${pct} percent of saved jobs`} />
                    <span className="shrink-0 text-xs text-muted-foreground">
                      <span className="num font-semibold text-foreground">{jobs.length}</span> of {agg.total} jobs
                    </span>
                  </div>
                </div>
                <div className="hidden text-right sm:block">
                  <div className="flex items-center justify-end gap-1 text-sm font-medium">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" /> {gap.timeToCredible}
                  </div>
                  <div className="text-xs text-muted-foreground">to be credible</div>
                </div>
                <ChevronDown className={cn("h-5 w-5 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
              </button>
              {isOpen && (
                <div id={`gap-body-${gap.id}`} className="border-t px-4 pb-5 pt-4 sm:px-5 animate-fade-up">
                  <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_260px]">
                    <div>
                      <p className="text-sm text-foreground/85">{gap.note}</p>
                      <h3 className="mb-2 mt-5 flex items-center gap-2 text-sm font-semibold">
                        <GraduationCap className="h-4 w-4 text-primary" /> Ways to close it
                      </h3>
                      <ul className="space-y-2.5">
                        {gap.resources.map((r) => {
                          const st = state.roadmap[r.id];
                          return (
                            <li key={r.id} className={cn("rounded-lg border p-3.5 transition-colors", st === "done" && "border-success-border bg-success-soft/50")}>
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                                <div className="min-w-0 flex-1">
                                  <div className={cn("text-sm font-medium", st === "done" && "text-muted-foreground line-through")}>{r.title}</div>
                                  <p className="mt-0.5 text-xs text-muted-foreground">{r.detail}</p>
                                  <div className="mt-2 flex flex-wrap gap-1.5">
                                    <Pill size="xs" tone={/free|\$0/i.test(r.cost) ? "success" : "muted"} icon={Wallet}>
                                      {r.cost}
                                    </Pill>
                                    <Pill size="xs" tone="muted" icon={Clock}>
                                      {r.minutes >= 60 ? `About ${Math.round(r.minutes / 60)} hours` : `${r.minutes} minutes`}
                                    </Pill>
                                    {st === "started" && <Pill size="xs" tone="primary">In progress</Pill>}
                                  </div>
                                </div>
                                <div className="flex shrink-0 gap-1.5">
                                  {st !== "done" && st !== "started" && (
                                    <Button size="xs" variant="outline" onClick={() => setRes(gap.id, r.id, "started")}>
                                      <Play /> Start
                                    </Button>
                                  )}
                                  {st !== "done" ? (
                                    <Button size="xs" variant="success" onClick={() => setRes(gap.id, r.id, "done")}>
                                      <Check /> Done
                                    </Button>
                                  ) : (
                                    <Button size="xs" variant="ghost" onClick={() => setRes(gap.id, r.id, null)}>
                                      Undo
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <ExternalLink className="h-3.5 w-3.5" /> Resource links open the provider in the real product. CareerQuest takes no referral fees.
                      </p>
                    </div>
                    <div className="space-y-4">
                      <div className="rounded-lg border p-4 text-center">
                        <ScoreRing value={progress} size={72} tone="success" label={`${gap.label} progress`} display={`${done}/${gap.resources.length}`} />
                        <div className="mt-2 text-xs text-muted-foreground">resources done</div>
                        <div className="mt-2 text-xs">
                          <b>Credible in:</b> {gap.timeToCredible}
                        </div>
                      </div>
                      <div>
                        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Shows up in</div>
                        <ul className="space-y-1.5">
                          {jobs.slice(0, 6).map((j) => (
                            <li key={j.id}>
                              <Link to={`/app/jobs/${j.id}`} className="block truncate rounded-md px-2 py-1 text-sm transition-colors hover:bg-accent">
                                {j.title} <span className="text-muted-foreground">· {j.company.name}</span>
                              </Link>
                            </li>
                          ))}
                          {jobs.length > 6 && <li className="px-2 text-xs text-muted-foreground">and {jobs.length - 6} more</li>}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {agg.items.length === 0 && (
        <Card className="text-center">
          <MapIcon className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">No gaps to show yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            This fills in once we have read some real listings against your resume. Open a few matches, and every requirement yours does not cover lands here.
          </p>
          <Button asChild variant="outline" size="sm" className="mt-4">
            <Link to="/app/matches">Go to your matches</Link>
          </Button>
        </Card>
      )}
    </div>
  );
}
