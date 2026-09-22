import { useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Check, ChevronDown, CircleHelp, Loader2, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScoreGauge } from "@/components/common";
import { atsBand, type AtsResult, type KeywordResult, type KeywordStatus } from "@/lib/ats";
import type { KeywordSource } from "@/hooks/useJobKeywords";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Score                                                               */
/* ------------------------------------------------------------------ */

export function AtsScorePanel({ result, onJump, hasJob }: { result: AtsResult; onJump: (field?: string) => void; hasJob: boolean }) {
  const [all, setAll] = useState(false);
  const band = atsBand(result.total);
  // Fixes worth under a point are noise in a list people are meant to act on.
  const worthIt = result.fixes.filter((f) => Math.round(f.points) >= 1);
  const shown = all ? worthIt : worthIt.slice(0, 5);

  return (
    <div>
      <div className="flex flex-col items-center">
        <ScoreGauge value={result.total} bandLabel={band.label} width={180} />
        <p className="-mt-1 max-w-[220px] text-center text-xs leading-snug text-muted-foreground">
          {result.general
            ? hasJob
              ? "Scored on the resume alone. Keyword coverage joins in once we have read this posting."
              : "Scored on the resume alone. Open a job to add keyword coverage."
            : "Scored against this posting. It moves as you type."}
        </p>
      </div>

      <ul className="mt-4 space-y-2.5">
        {result.parts.map((p) => {
          const pct = p.max ? Math.round((p.score / p.max) * 100) : 0;
          return (
            <li key={p.key}>
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="font-medium">{p.label}</span>
                <span className="num text-muted-foreground">
                  {Math.round(p.score)} / {Math.round(p.max)}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={p.label}>
                <div className={cn("h-full rounded-full transition-[width] duration-200", pct >= 85 ? "bg-success" : pct >= 60 ? "bg-primary" : "bg-warning")} style={{ width: `${pct}%` }} />
              </div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">{p.note}</div>
            </li>
          );
        })}
      </ul>

      <div className="mt-5 border-t pt-4">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" /> Fix this
        </h3>
        {worthIt.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Nothing left worth fixing. Read it once more as a person would, then send it.</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {shown.map((f) => {
              const body = (
                <>
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block text-[13px] font-medium leading-snug">{f.label}</span>
                    <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{f.detail}</span>
                  </span>
                  <span className="num shrink-0 rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-semibold text-success">+{Math.round(f.points)}</span>
                </>
              );
              return (
                <li key={f.id}>
                  {f.field ? (
                    <button type="button" onClick={() => onJump(f.field)} className="flex w-full items-start gap-2 rounded-lg border p-2.5 text-left transition-colors hover:border-primary/40 hover:bg-accent/40" aria-label={`${f.label}. Worth ${Math.round(f.points)} points. Jump to it.`}>
                      {body}
                    </button>
                  ) : (
                    <div className="flex w-full items-start gap-2 rounded-lg border p-2.5">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {worthIt.length > 5 && (
          <button type="button" onClick={() => setAll((a) => !a)} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
            {all ? "Show fewer" : `Show ${worthIt.length - 5} more`}
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", all && "rotate-180")} />
          </button>
        )}
      </div>

      <p className="mt-4 text-[11px] leading-snug text-muted-foreground">An estimate of how screening software reads this resume. Real systems differ, so use it as a guide and not a promise.</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Keywords                                                            */
/* ------------------------------------------------------------------ */

const GROUPS: { status: KeywordStatus; title: string; help: string; chip: string }[] = [
  { status: "covered", title: "On your resume", help: "The posting's words are already there.", chip: "border-success/40 bg-success-soft text-success" },
  { status: "likely", title: "You may have this", help: "You describe something close, but not in the posting's words.", chip: "border-warning/50 bg-warning/10 text-warning" },
  { status: "missing", title: "Not found", help: "We did not find this. Only add it if it is true.", chip: "border-border bg-muted/60 text-foreground" },
];

interface KeywordPanelProps {
  results: KeywordResult[];
  source: KeywordSource;
  loading: boolean;
  excerpt: boolean;
  roles: { id: string; title: string; company: string }[];
  onJump: (field?: string) => void;
  onAddLine: (roleId: string, text: string) => void;
  onAddSkill: (term: string) => void;
  pasted: boolean;
  onPaste: (text: string) => void;
  onClearPaste: () => void;
}

export function KeywordPanel(p: KeywordPanelProps) {
  const [open, setOpen] = useState<string | null>(null);
  const [showPaste, setShowPaste] = useState(false);
  const [paste, setPaste] = useState("");

  const counts = { covered: 0, likely: 0, missing: 0 } as Record<KeywordStatus, number>;
  for (const r of p.results) counts[r.status]++;

  return (
    <div>
      {p.loading && (
        <p className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading the whole posting
        </p>
      )}

      {p.results.length === 0 ? (
        <p className="text-sm text-muted-foreground">We could not find specific skills or tools in this posting to compare against. Paste the full posting below and we will try again.</p>
      ) : (
        <>
          <p className="mb-3 text-xs text-muted-foreground">
            <b className="num text-foreground">{counts.covered}</b> of <span className="num">{p.results.length}</span> terms from the posting are on your resume.
          </p>
          <div className="space-y-4">
            {GROUPS.map((g) => {
              const items = p.results.filter((r) => r.status === g.status);
              if (!items.length) return null;
              return (
                <section key={g.status}>
                  <h3 className="flex items-baseline justify-between gap-2 text-xs font-semibold">
                    <span>
                      {g.title} <span className="num font-normal text-muted-foreground">({items.length})</span>
                    </span>
                  </h3>
                  <p className="mb-1.5 text-[11px] text-muted-foreground">{g.help}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {items.map((k) => {
                      const actionable = k.status !== "covered";
                      const isOpen = open === k.term;
                      return (
                        <button
                          key={k.term}
                          type="button"
                          onClick={() => (actionable ? setOpen(isOpen ? null : k.term) : p.onJump(k.where))}
                          aria-expanded={actionable ? isOpen : undefined}
                          title={k.weight === 2 ? "The posting asks for this" : "The posting prefers this"}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors hover:brightness-95",
                            g.chip,
                            isOpen && "ring-2 ring-primary/40",
                            k.weight === 2 && "border-2",
                          )}
                        >
                          {k.status === "covered" && <Check className="h-3 w-3" aria-hidden />}
                          {k.status !== "covered" && <CircleHelp className="h-3 w-3" aria-hidden />}
                          {k.term}
                        </button>
                      );
                    })}
                  </div>
                  {items.some((k) => k.term === open) && (
                    <AskForm
                      key={open}
                      term={open!}
                      roles={p.roles}
                      onCancel={() => setOpen(null)}
                      onAddLine={(roleId, text) => {
                        p.onAddLine(roleId, text);
                        setOpen(null);
                      }}
                      onAddSkill={(t) => {
                        p.onAddSkill(t);
                        setOpen(null);
                      }}
                    />
                  )}
                </section>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] leading-snug text-muted-foreground">Bold outlines are things the posting requires. The rest are preferences.</p>
        </>
      )}

      {/* Most boards only share a short excerpt, so offer the way to a better read. */}
      <div className="mt-4 border-t pt-3">
        {p.pasted ? (
          <p className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>Reading the full posting you pasted.</span>
            <button type="button" className="font-medium text-primary hover:underline" onClick={p.onClearPaste}>
              Stop using it
            </button>
          </p>
        ) : (
          <>
            {p.excerpt && <p className="mb-1.5 text-xs text-warning">This listing only shared a short excerpt, so the terms above are a partial list.</p>}
            <button type="button" onClick={() => setShowPaste((s) => !s)} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline" aria-expanded={showPaste}>
              Paste the full posting for a better read
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showPaste && "rotate-180")} />
            </button>
            {showPaste && (
              <div className="mt-2 space-y-2">
                <Textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={6} placeholder="Copy the job description from the employer's page and paste it here." aria-label="Full job posting" className="text-xs" />
                <div className="flex items-center gap-2">
                  <Button
                    size="xs"
                    disabled={paste.trim().length < 200}
                    onClick={() => {
                      p.onPaste(paste.trim());
                      setPaste("");
                      setShowPaste(false);
                      toast.success("Reading your pasted posting", { description: "It is saved with your account, private to you, and only used to compare keywords." });
                    }}
                  >
                    Use this posting
                  </Button>
                  <span className="text-[11px] text-muted-foreground">{paste.trim().length < 200 ? "A full posting, please. This looks short." : "Saved with your account, private to you."}</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * "Have you done this?" A term we could not find is only ever added because the
 * person says it is true, and in their own words. Nothing is written for them.
 */
function AskForm({
  term,
  roles,
  onCancel,
  onAddLine,
  onAddSkill,
}: {
  term: string;
  roles: { id: string; title: string; company: string }[];
  onCancel: () => void;
  onAddLine: (roleId: string, text: string) => void;
  onAddSkill: (term: string) => void;
}) {
  const [step, setStep] = useState<"ask" | "how">("ask");
  const [mode, setMode] = useState<"line" | "skill">(roles.length ? "line" : "skill");
  const [roleId, setRoleId] = useState(roles[0]?.id ?? "");
  const [text, setText] = useState("");
  const words = text.trim().split(/\s+/).filter(Boolean).length;

  const submit = () => {
    if (mode === "skill") return onAddSkill(term);
    const t = text.trim();
    const line = `${t.charAt(0).toUpperCase()}${t.slice(1)}${/[.!?]$/.test(t) ? "" : "."}`;
    onAddLine(roleId, line);
  };

  if (step === "ask") {
    return (
      <div className="mt-2 rounded-lg border bg-muted/30 p-3" role="group" aria-label={`Have you done ${term}?`}>
        <p className="text-sm font-medium">
          Have you done "<span>{term}</span>"?
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">Only say yes if it is true. It goes on your resume in your own words.</p>
        <div className="mt-2.5 flex gap-2">
          <Button size="xs" onClick={() => setStep("how")}>
            Yes, I have
          </Button>
          <Button size="xs" variant="ghost" onClick={onCancel}>
            No
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-3 rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Add "{term}" to your resume</p>
        <button type="button" onClick={onCancel} className="rounded p-0.5 text-muted-foreground hover:text-foreground" aria-label="Cancel">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex gap-1.5" role="radiogroup" aria-label="Where to add it">
        {(
          [
            ["line", "As a line under a role"],
            ["skill", "As a skill"],
          ] as const
        ).map(([m, label]) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            disabled={m === "line" && roles.length === 0}
            onClick={() => setMode(m)}
            className={cn("rounded-full border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-40", mode === m ? "border-primary bg-primary-soft text-primary" : "text-muted-foreground hover:text-foreground")}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "line" ? (
        <>
          <label className="block text-xs">
            <span className="mb-1 block font-medium">Under which role?</span>
            <select value={roleId} onChange={(e) => setRoleId(e.target.value)} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}, {r.company}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs">
            <span className="mb-1 block font-medium">What did you do? One sentence, in your own words.</span>
            <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="Say what you did and, if you can, what came of it. Numbers help." className="text-sm" autoFocus />
          </label>
          <div className="flex items-center gap-2">
            <Button size="xs" disabled={words < 5 || !roleId} onClick={submit}>
              Add to my resume <ArrowRight />
            </Button>
            <span className="text-[11px] text-muted-foreground">{words < 5 ? "A full sentence, please." : "You can still edit it on the page."}</span>
          </div>
        </>
      ) : (
        <div className="flex items-center gap-2">
          <Button size="xs" onClick={submit}>
            Add "{term}" to my skills <ArrowRight />
          </Button>
          <span className="text-[11px] text-muted-foreground">Goes on your skills line.</span>
        </div>
      )}
    </div>
  );
}
