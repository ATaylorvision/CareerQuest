import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Filter, Loader2, RefreshCcw, RotateCcw, Search, SlidersHorizontal, Sparkle } from "lucide-react";
import { PageHeader, Chip, EmptyState } from "@/components/common";
import { JobCard } from "@/components/JobCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useStore } from "@/store/AppStore";
import { CATEGORIES, JOBS, type Category, type WorkMode } from "@/data/jobs";
import { byShown, contextFor, MIN_SCORE, splitMatches } from "@/lib/matchRules";
import { useSessionState } from "@/hooks/useSessionState";
import { useLive } from "@/live/LiveProvider";
import { startRefresh, useRefreshState } from "@/live/refreshStore";
import { keepShown } from "@/live/keep";
import { useDocTitle } from "@/hooks/useDocTitle";
import { cn } from "@/lib/utils";

type Sort = "new" | "match" | "salary" | "transferable";

interface Filters {
  q: string;
  sort: Sort;
  ccf: boolean;
  modes: WorkMode[];
  cats: Category[];
  posted: number;
}

// New to you comes first. That is when a listing first reached this person, which is not always when it was posted.
const DEFAULTS: Filters = { q: "", sort: "new", ccf: false, modes: [], cats: [], posted: 0 };

function FilterPanel({ f, setF, onReset }: { f: Filters; setF: (fn: (f: Filters) => Filters) => void; onReset: () => void }) {
  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  return (
    <div className="space-y-6">
      <section className="flex items-start justify-between gap-3">
        <div>
          <Label htmlFor="ccf" className="flex items-center gap-1.5 text-sm font-semibold">
            <Sparkle className="h-4 w-4 text-success" /> Career changer friendly
          </Label>
          <p className="mt-0.5 text-xs text-muted-foreground">Roles that do not require exact industry experience.</p>
        </div>
        <Switch id="ccf" checked={f.ccf} onCheckedChange={(v) => setF((x) => ({ ...x, ccf: v }))} />
      </section>

      <section>
        <div className="mb-2 text-sm font-semibold">Work setup</div>
        <div className="flex flex-wrap gap-2">
          {(["Remote", "Hybrid", "Onsite"] as WorkMode[]).map((m) => (
            <Chip key={m} active={f.modes.includes(m)} onClick={() => setF((x) => ({ ...x, modes: toggle(x.modes, m) }))}>
              {m}
            </Chip>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-2 text-sm font-semibold">Field</div>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <Chip key={c} active={f.cats.includes(c)} onClick={() => setF((x) => ({ ...x, cats: toggle(x.cats, c) }))}>
              {c}
            </Chip>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-2 text-sm font-semibold">Posted within</div>
        <div className="flex flex-wrap gap-2">
          {[
            [0, "Last 30 days"],
            [3, "3 days"],
            [7, "A week"],
            [14, "2 weeks"],
          ].map(([d, l]) => (
            <Chip key={d} active={f.posted === d} onClick={() => setF((x) => ({ ...x, posted: d as number }))}>
              {l}
            </Chip>
          ))}
        </div>
      </section>

      <Button variant="ghost" size="sm" onClick={onReset} className="w-full">
        <RotateCcw /> Reset filters
      </Button>
    </div>
  );
}

export default function Matches() {
  useDocTitle("Matches");
  const { state } = useStore();
  const live = state.mode === "live";
  const { flushProfile } = useLive();
  const rs = useRefreshState();
  const [f, setFState] = useSessionState<Filters>("feed", DEFAULTS);
  const setF = (fn: (f: Filters) => Filters) => setFState((prev) => fn(prev));
  const [showWeaker, setShowWeaker] = useState(false);
  const [limit, setLimit] = useState(12);
  const [sheet, setSheet] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 450);
    return () => clearTimeout(t);
  }, []);

  const { list, weakerCount, dismissed } = useMemo(() => {
    const q = f.q.trim().toLowerCase();
    // Real accounts only see jobs that fit them. Legitimacy, freshness, distance, pay, dealbreakers and
    // applications already sent are all handled here, without the person having to set anything.
    const rules = live ? splitMatches(JOBS, contextFor(state)) : null;
    const applied = new Set(state.applications.filter((a) => a.receipt?.submittedAt || a.column !== "saved").map((a) => a.jobId));
    let arr = rules
      ? showWeaker
        ? [...rules.shown, ...rules.weaker]
        : rules.shown
      : JOBS.filter((j) => !j.imported && !state.dismissedJobIds.includes(j.id) && !applied.has(j.id) && j.legit.score >= state.legitThreshold);
    if (q) arr = arr.filter((j) => `${j.title} ${j.company.name} ${j.location} ${j.category}`.toLowerCase().includes(q));
    if (f.ccf) arr = arr.filter((j) => j.careerChangerFriendly);
    if (f.modes.length) arr = arr.filter((j) => f.modes.includes(j.mode));
    if (f.cats.length) arr = arr.filter((j) => f.cats.includes(j.category));
    if (f.posted) arr = arr.filter((j) => j.postedDaysAgo <= f.posted);
    const sorters: Record<Sort, (a: (typeof arr)[0], b: (typeof arr)[0]) => number> = {
      new: live ? byShown : (a, b) => a.postedDaysAgo - b.postedDaysAgo,
      match: (a, b) => b.match - a.match,
      salary: (a, b) => (b.salary?.[1] ?? 0) - (a.salary?.[1] ?? 0),
      transferable: (a, b) => b.breakdown.transferable - a.breakdown.transferable,
    };
    arr = [...arr].sort(sorters[f.sort] ?? sorters.new);
    return { list: arr, weakerCount: rules?.weaker.length ?? 0, dismissed: state.dismissedJobIds.length };
  }, [f, live, state.applications, state.dismissedJobIds, state.legitThreshold, state.prefs, state.profile.location, showWeaker, rs.running]);

  // Whatever passes the rules now stays in this person's matches from here on.
  useEffect(() => {
    if (live) void keepShown(state);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, list.length, rs.running]);

  const needsSetup = live && (!state.profile.location.trim() || state.prefs.roles.length === 0);

  const activeCount = (f.ccf ? 1 : 0) + f.modes.length + f.cats.length + (f.posted ? 1 : 0);

  return (
    <div>
      <PageHeader
        title="Your matches"
        sub={live ? "Real, current jobs near you that fit your experience, including what transfers from your past work. The newest ones to reach you come first." : "Ranked by how well your experience fits, including what transfers from retail."}
        actions={
          live ? (
            <Button onClick={() => void startRefresh(flushProfile)} disabled={rs.running}>
              {rs.running ? <Loader2 className="animate-spin" /> : <RefreshCcw />} {rs.running ? "Searching" : "Find new jobs"}
            </Button>
          ) : undefined
        }
      />

      {needsSetup && (
        <div className="mb-5 rounded-xl border border-warning-border bg-warning-soft p-4 text-sm" role="status">
          <div className="font-semibold">Tell us where you want to work and what you are looking for</div>
          <p className="mt-1 text-foreground/80">
            {!state.profile.location.trim() && "Add your home base, so we only show jobs you could actually get to. "}
            {state.prefs.roles.length === 0 && "Add the roles you want, so we search for those. "}
          </p>
          <Button asChild size="sm" className="mt-3">
            <Link to="/app/settings">Open settings</Link>
          </Button>
        </div>
      )}
      {live && !rs.running && rs.lastFound === 0 && rs.lastNote && !needsSetup && (
        <p className="mb-4 rounded-lg bg-muted px-3 py-2 text-sm" role="status">
          {rs.lastNote}
        </p>
      )}
      {live && (rs.running || rs.error) && (
        <div className="mb-5 rounded-xl border bg-card p-4 text-sm shadow-card animate-fade-up" role="status" aria-live="polite">
          {rs.running ? (
            <div className="flex items-center gap-3">
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
              <div>
                <div className="font-medium">{rs.progress?.message ?? "Working"}</div>
                <div className="text-xs text-muted-foreground">
                  {rs.progress?.stage === "search" && "Pulling live listings and checking each company's own careers page."}
                  {rs.progress?.stage === "score" && "Scoring each listing against your resume."}
                  {rs.progress?.stage === "detail" && "Translating your experience for your best matches."}
                  {rs.progress?.stage === "done" && "Finishing up."}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-danger">{rs.error}</p>
          )}
        </div>
      )}
      {live && !rs.running && rs.lastFound !== null && (
        <p className="mb-4 rounded-lg bg-success-soft px-3 py-2 text-sm text-success" role="status">
          Search finished. {rs.lastFound} listings checked. New ones are scored and sorted below.
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[272px_1fr]">
        <aside className="hidden lg:block">
          <div className="card-base sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto p-5 scrollbar-thin">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
              <SlidersHorizontal className="h-4 w-4" /> Filters
            </div>
            <FilterPanel f={f} setF={setF} onReset={() => setFState(DEFAULTS)} />
          </div>
        </aside>

        <div className="min-w-0">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={f.q} onChange={(e) => setF((x) => ({ ...x, q: e.target.value }))} placeholder="Search title, company, or city" className="pl-9" aria-label="Search matches" />
            </div>
            <div className="flex gap-2">
              <Select value={f.sort} onValueChange={(v) => setF((x) => ({ ...x, sort: v as Sort }))}>
                <SelectTrigger className="w-full sm:w-[200px]" aria-label="Sort by">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">{live ? "Newest to you" : "Newest first"}</SelectItem>
                  <SelectItem value="match">Best match</SelectItem>
                  <SelectItem value="transferable">Best transferable fit</SelectItem>
                  <SelectItem value="salary">Highest salary</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" className="lg:hidden" onClick={() => setSheet(true)}>
                <Filter /> Filters{activeCount > 0 && <span className="num rounded-full bg-primary px-1.5 text-[11px] text-primary-foreground">{activeCount}</span>}
              </Button>
            </div>
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
            <Chip active={f.ccf} onClick={() => setF((x) => ({ ...x, ccf: !x.ccf }))} className="lg:hidden">
              <Sparkle className="h-3.5 w-3.5" /> Career changer friendly
            </Chip>
            <span className="text-muted-foreground">
              <span className="num font-semibold text-foreground">{list.length}</span> {list.length === 1 ? "match" : "matches"}
            </span>
            {live && weakerCount > 0 && (
              <span className="inline-flex items-center gap-2 text-muted-foreground">
                <span aria-hidden>·</span>
                <Label htmlFor="weaker" className="cursor-pointer font-normal">
                  Show <span className="num">{weakerCount}</span> weaker {weakerCount === 1 ? "match" : "matches"} (under {MIN_SCORE})
                </Label>
                <Switch id="weaker" checked={showWeaker} onCheckedChange={setShowWeaker} />
              </span>
            )}
            {dismissed > 0 && (
              <span className="text-muted-foreground">
                · <span className="num">{dismissed}</span> marked not for me
              </span>
            )}
          </div>

          {loading ? (
            <div className="space-y-3" aria-busy="true" aria-label="Loading matches">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="card-base flex gap-4 p-5">
                  <div className="skeleton h-11 w-11 shrink-0 rounded-lg" />
                  <div className="flex-1 space-y-2.5">
                    <div className="skeleton h-4 w-1/2" />
                    <div className="skeleton h-3 w-1/3" />
                    <div className="flex gap-2">
                      <div className="skeleton h-5 w-24 rounded-full" />
                      <div className="skeleton h-5 w-20 rounded-full" />
                      <div className="skeleton h-5 w-28 rounded-full" />
                    </div>
                    <div className="skeleton h-9 w-full" />
                  </div>
                  <div className="skeleton h-12 w-12 rounded-full" />
                </div>
              ))}
            </div>
          ) : list.length === 0 ? (
            live && JOBS.length === 0 ? (
              <EmptyState
                icon={Search}
                title="No matches yet"
                body="Press Find new jobs and we will pull live listings for your target roles and score each one against your resume."
                action={
                  <Button onClick={() => void startRefresh(flushProfile)} disabled={rs.running}>
                    <RefreshCcw /> Find new jobs
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={Search}
                title={live ? "Nothing new that fits right now" : "No matches with these filters"}
                body={live ? "Every listing we found was too far, too old, below your pay floor or a weaker fit. Press Find new jobs later, widen your range in Settings, or show weaker matches. We never pad this list to make it look full." : "Try removing a filter. We never pad this list with junk to make it look full."}
                action={
                  <Button variant="outline" onClick={() => setFState(DEFAULTS)}>
                    Reset filters
                  </Button>
                }
              />
            )
          ) : (
            <div className="space-y-3">
              {list.slice(0, limit).map((j, i) => (
                <JobCard key={j.id} job={j} index={i} />
              ))}
              {list.length > limit && (
                <div className="flex justify-center pt-2">
                  <Button variant="outline" onClick={() => setLimit((l) => l + 12)}>
                    Show {Math.min(12, list.length - limit)} more
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <Sheet open={sheet} onOpenChange={setSheet}>
        <SheetContent side="bottom" className={cn("max-h-[85vh] overflow-y-auto rounded-t-2xl")}>
          <SheetTitle className="mb-4">Filters</SheetTitle>
          <FilterPanel f={f} setF={setF} onReset={() => setFState(DEFAULTS)} />
          <Button className="mt-5 w-full" onClick={() => setSheet(false)}>
            Show {list.length} matches
          </Button>
        </SheetContent>
      </Sheet>
    </div>
  );
}
