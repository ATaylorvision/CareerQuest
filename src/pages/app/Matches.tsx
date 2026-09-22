import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Compass, Filter, LayoutGrid, Loader2, MapPin, RefreshCcw, RotateCcw, Search, SlidersHorizontal, Sparkle, Sparkles } from "lucide-react";
import { PageHeader, Chip, EmptyState } from "@/components/common";
import { JobCard } from "@/components/JobCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useStore } from "@/store/AppStore";
import { CATEGORIES, JOBS, MORE_JOBS, type Category, type Job, type WorkMode } from "@/data/jobs";
import { useSessionState } from "@/hooks/useSessionState";
import { useJobsVersion } from "@/hooks/useJobs";
import { useLive } from "@/live/LiveProvider";
import { startRefresh, useRefreshState } from "@/live/refreshStore";
import { keepShown } from "@/live/keep";
import { useDocTitle } from "@/hooks/useDocTitle";
import { byShown, contextFor, MIN_SCORE, neverShown, reachFor, splitMatches, withinReach } from "@/lib/matchRules";
import { cn } from "@/lib/utils";

type Sort = "new" | "match" | "salary" | "transferable";
type BoardSort = "posted" | "closest" | "match" | "salary";

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

/** The board's own location filter. It starts from what the person told us and can be widened to browse. */
interface Board {
  miles: number | null;
  remote: boolean | null;
  sort: BoardSort;
}
const BOARD_DEFAULTS: Board = { miles: null, remote: null, sort: "posted" };

const DISTANCES = [10, 25, 50, 75, 100];

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
  const version = useJobsVersion();
  const [f, setFState] = useSessionState<Filters>("feed", DEFAULTS);
  const setF = (fn: (f: Filters) => Filters) => setFState((prev) => fn(prev));
  const [board, setBoard] = useSessionState<Board>("board", BOARD_DEFAULTS);
  const [showWeaker, setShowWeaker] = useState(false);
  const [limit, setLimit] = useState(12);
  const [boardLimit, setBoardLimit] = useState(12);
  const [sheet, setSheet] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 450);
    return () => clearTimeout(t);
  }, []);

  const home = state.profile.location;
  const reach = useMemo(() => reachFor(state), [state.prefs, state.profile]);
  const boardMiles = board.miles ?? state.prefs.maxDistanceMiles;
  const boardRemote = board.remote ?? reach.includeRemote;

  const { matches, weakerCount, boardList, boardTotal, unplaced } = useMemo(() => {
    const q = f.q.trim().toLowerCase();
    const ctx = contextFor(state);
    const rules = live ? splitMatches(JOBS, ctx) : null;
    const applied = new Set(state.applications.filter((a) => a.receipt?.submittedAt || a.column !== "saved").map((a) => a.jobId));

    const uiFilter = (list: Job[]) => {
      let arr = list;
      if (q) arr = arr.filter((j) => `${j.title} ${j.company.name} ${j.location} ${j.category}`.toLowerCase().includes(q));
      if (f.ccf) arr = arr.filter((j) => j.careerChangerFriendly);
      if (f.modes.length) arr = arr.filter((j) => f.modes.includes(j.mode));
      if (f.cats.length && true) arr = arr.filter((j) => j.unscored || f.cats.includes(j.category));
      if (f.posted) arr = arr.filter((j) => j.postedDaysAgo <= f.posted);
      return arr;
    };

    // ---- the matches: what fits this person, by the rules
    let m = rules
      ? showWeaker
        ? [...rules.shown, ...rules.weaker]
        : rules.shown
      : JOBS.filter((j) => !j.imported && !state.dismissedJobIds.includes(j.id) && !applied.has(j.id) && j.legit.score >= state.legitThreshold);
    m = uiFilter(m);
    const sorters: Record<Sort, (a: Job, b: Job) => number> = {
      new: live ? byShown : (a, b) => a.postedDaysAgo - b.postedDaysAgo,
      match: (a, b) => b.match - a.match,
      salary: (a, b) => (b.salary?.[1] ?? 0) - (a.salary?.[1] ?? 0),
      transferable: (a, b) => b.breakdown.transferable - a.breakdown.transferable,
    };
    m = [...m].sort(sorters[f.sort] ?? sorters.new);

    // ---- the board: everything else in the cache, held to where this person can work
    let b: Job[] = [];
    let unplacedCount = 0;
    let total = 0;
    if (live) {
      const inMatches = new Set(m.map((j) => j.id));
      const all = [...JOBS, ...MORE_JOBS.filter((j) => !JOBS.some((x) => x.id === j.id))].filter((j) => !inMatches.has(j.id) && !neverShown(j, ctx));
      total = all.length;
      const r = { ...reach, miles: boardMiles, includeRemote: boardRemote };
      const placed = all.filter((j) => {
        const w = withinReach(j, r);
        if (w === "unplaced") unplacedCount++;
        return w === "ok";
      });
      b = uiFilter(placed);
      const bs: Record<BoardSort, (a: Job, b: Job) => number> = {
        posted: (a, b) => a.postedDaysAgo - b.postedDaysAgo,
        closest: (a, b) => (a.distanceMiles ?? 9999) - (b.distanceMiles ?? 9999),
        match: (a, b) => Number(!!a.unscored) - Number(!!b.unscored) || b.match - a.match,
        salary: (a, b) => (b.salary?.[1] ?? 0) - (a.salary?.[1] ?? 0),
      };
      b = [...b].sort(bs[board.sort] ?? bs.posted);
    }
    return { matches: m, weakerCount: rules?.weaker.length ?? 0, boardList: b, boardTotal: total, unplaced: unplacedCount };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f, board, live, version, state.applications, state.dismissedJobIds, state.legitThreshold, state.prefs, state.profile.location, showWeaker, rs.running]);

  // Whatever passes the rules now stays in this person's matches from here on.
  useEffect(() => {
    if (live) void keepShown(state);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, matches.length, rs.running]);

  const needsSetup = live && (!state.profile.location.trim() || state.prefs.roles.length === 0);
  const activeCount = (f.ccf ? 1 : 0) + f.modes.length + f.cats.length + (f.posted ? 1 : 0);
  const boardChanged = board.miles !== null || board.remote !== null;

  return (
    <div>
      <PageHeader
        title="Matches"
        sub={live ? "The jobs that fit you sit at the top. Below them is every job we have found, so you can look for ones we did not think to call a match." : "Ranked by how well your experience fits, including what transfers from retail."}
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
      {live && !rs.running && rs.lastFound !== null && rs.lastFound > 0 && (
        <p className="mb-4 rounded-lg bg-success-soft px-3 py-2 text-sm text-success" role="status">
          Search finished. {rs.lastFound} listings checked. New ones are scored and sorted below.
        </p>
      )}

      {/* ---------------- your matches, given the most room and the most weight ---------------- */}
      <section aria-labelledby="matches-h" className="rounded-2xl border-2 border-primary/30 bg-gradient-to-b from-primary-soft/70 to-primary-soft/10 p-3 shadow-card sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Sparkles className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h2 id="matches-h" className="font-display text-xl font-semibold leading-tight sm:text-2xl">
                Your matches
              </h2>
              <p className="text-sm text-muted-foreground">
                <span className="num font-semibold text-foreground">{matches.length}</span> {matches.length === 1 ? "job fits" : "jobs fit"} your experience{home ? ` near ${home}` : ""}, newest to you first.
              </p>
            </div>
          </div>
          {live && weakerCount > 0 && (
            <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Label htmlFor="weaker" className="cursor-pointer font-normal">
                Show <span className="num">{weakerCount}</span> weaker (under {MIN_SCORE})
              </Label>
              <Switch id="weaker" checked={showWeaker} onCheckedChange={setShowWeaker} />
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[250px_1fr]">
          <aside className="hidden lg:block">
            <div className="card-base sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto p-4 scrollbar-thin">
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
                <Input value={f.q} onChange={(e) => setF((x) => ({ ...x, q: e.target.value }))} placeholder="Search title, company, or city" className="bg-background pl-9" aria-label="Search matches and the job board" />
              </div>
              <div className="flex gap-2">
                <Select value={f.sort} onValueChange={(v) => setF((x) => ({ ...x, sort: v as Sort }))}>
                  <SelectTrigger className="w-full bg-background sm:w-[190px]" aria-label="Sort matches by">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">{live ? "Newest to you" : "Newest first"}</SelectItem>
                    <SelectItem value="match">Best match</SelectItem>
                    <SelectItem value="transferable">Best transferable fit</SelectItem>
                    <SelectItem value="salary">Highest salary</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" className="bg-background lg:hidden" onClick={() => setSheet(true)}>
                  <Filter /> Filters{activeCount > 0 && <span className="num rounded-full bg-primary px-1.5 text-[11px] text-primary-foreground">{activeCount}</span>}
                </Button>
              </div>
            </div>

            {loading ? (
              <div className="space-y-3" aria-busy="true" aria-label="Loading matches">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="card-base flex gap-4 p-5">
                    <div className="skeleton h-11 w-11 shrink-0 rounded-lg" />
                    <div className="flex-1 space-y-2.5">
                      <div className="skeleton h-4 w-1/2" />
                      <div className="skeleton h-3 w-1/3" />
                      <div className="skeleton h-9 w-full" />
                    </div>
                    <div className="skeleton h-12 w-12 rounded-full" />
                  </div>
                ))}
              </div>
            ) : matches.length === 0 ? (
              <EmptyState
                icon={Search}
                title={live ? "Nothing new that fits right now" : "No matches with these filters"}
                body={live ? "Nothing we have found scores as a fit yet. Press Find new jobs, or look through the job board below." : "Try removing a filter."}
                action={
                  live && JOBS.length === 0 ? (
                    <Button onClick={() => void startRefresh(flushProfile)} disabled={rs.running}>
                      <RefreshCcw /> Find new jobs
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={() => setFState(DEFAULTS)}>
                      Reset filters
                    </Button>
                  )
                }
              />
            ) : (
              <div className="space-y-3">
                {matches.slice(0, limit).map((j, i) => (
                  <JobCard key={j.id} job={j} index={i} />
                ))}
                {matches.length > limit && (
                  <div className="flex justify-center pt-2">
                    <Button variant="outline" className="bg-background" onClick={() => setLimit((l) => l + 12)}>
                      Show {Math.min(12, matches.length - limit)} more
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ---------------- the job board: everything we have ---------------- */}
      {live && (
        <section aria-labelledby="board-h" className="mt-10">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <LayoutGrid className="h-4.5 w-4.5" aria-hidden />
              </span>
              <div>
                <h2 id="board-h" className="font-display text-xl font-semibold leading-tight">
                  Job board
                </h2>
                <p className="text-sm text-muted-foreground">Every other job we have found. Open one you like and tell us, and your matches get better.</p>
              </div>
            </div>
          </div>

          <div className="mb-4 flex flex-col gap-3 rounded-xl border bg-card p-3 sm:flex-row sm:flex-wrap sm:items-center">
            <span className="inline-flex items-center gap-1.5 text-sm font-medium">
              <MapPin className="h-4 w-4 text-primary" aria-hidden /> Location
            </span>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">Within</span>
              <Select value={String(boardMiles >= 100 ? 100 : boardMiles)} onValueChange={(v) => setBoard((b) => ({ ...b, miles: Number(v) }))}>
                <SelectTrigger className="h-9 w-[130px]" aria-label="Distance">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from(new Set([...DISTANCES, boardMiles >= 100 ? 100 : boardMiles])).sort((a, b) => a - b).map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      {d >= 100 ? "Any distance" : `${d} miles`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-muted-foreground">of {home || "your home base"}</span>
            </div>
            <span className="inline-flex items-center gap-2 text-sm">
              <Switch id="board-remote" checked={boardRemote} onCheckedChange={(v) => setBoard((b) => ({ ...b, remote: v }))} />
              <Label htmlFor="board-remote" className="cursor-pointer font-normal">
                Include remote
              </Label>
            </span>
            <div className="flex items-center gap-2 sm:ml-auto">
              <Select value={board.sort} onValueChange={(v) => setBoard((b) => ({ ...b, sort: v as BoardSort }))}>
                <SelectTrigger className="h-9 w-[170px]" aria-label="Sort the board by">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="posted">Newest posted</SelectItem>
                  <SelectItem value="closest">Closest</SelectItem>
                  <SelectItem value="match">Best match</SelectItem>
                  <SelectItem value="salary">Highest salary</SelectItem>
                </SelectContent>
              </Select>
              {boardChanged && (
                <Button variant="ghost" size="sm" onClick={() => setBoard(BOARD_DEFAULTS)}>
                  <RotateCcw /> Back to my range
                </Button>
              )}
            </div>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            <span className="num font-semibold text-foreground">{boardList.length}</span> of {boardTotal} other jobs are in range.
            {unplaced > 0 && ` ${unplaced} could not be placed on the map, so they are left out unless you choose Any distance.`}
          </p>

          {boardList.length === 0 ? (
            <EmptyState
              icon={Compass}
              title="No other jobs in this range"
              body="Try a longer distance, or include remote jobs. New listings arrive each time you press Find new jobs."
              action={
                <Button variant="outline" onClick={() => setBoard((b) => ({ ...b, miles: 100 }))}>
                  Show any distance
                </Button>
              }
            />
          ) : (
            <div className="space-y-3">
              {boardList.slice(0, boardLimit).map((j, i) => (
                <JobCard key={j.id} job={j} index={i} />
              ))}
              {boardList.length > boardLimit && (
                <div className="flex justify-center pt-2">
                  <Button variant="outline" onClick={() => setBoardLimit((l) => l + 12)}>
                    Show {Math.min(12, boardList.length - boardLimit)} more
                  </Button>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      <Sheet open={sheet} onOpenChange={setSheet}>
        <SheetContent side="bottom" className={cn("max-h-[85vh] overflow-y-auto rounded-t-2xl")}>
          <SheetTitle className="mb-4">Filters</SheetTitle>
          <FilterPanel f={f} setF={setF} onReset={() => setFState(DEFAULTS)} />
          <Button className="mt-5 w-full" onClick={() => setSheet(false)}>
            Show {matches.length} matches
          </Button>
        </SheetContent>
      </Sheet>
    </div>
  );
}
