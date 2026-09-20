import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Check, FileText, Languages, Loader2, Lock, Star, Trash2, Undo2, Wand2, X } from "lucide-react";
import { ScoreBar, ScoreRing } from "@/components/common";
import { Pill } from "@/components/status";
import { Button } from "@/components/ui/button";
import { TranslatorRow } from "@/components/TranslatorRows";
import { ATS_MAX, BASE_ATS, CHANGE_TYPE_LABEL, type ResumeVersion, type TailorChange } from "@/data/resumeStudio";
import { SEVERITY_LABEL } from "@/data/gaps";
import { Textarea } from "@/components/ui/textarea";
import { BULLET_TRANSLATIONS, TRANSLATOR_EXAMPLE, translateFreeText } from "@/data/translator";
import { api } from "@/live/api";
import { useStore } from "@/store/AppStore";
import { bulletById } from "@/data/user";
import type { Job, TargetField } from "@/data/jobs";
import { atsScore } from "@/lib/selectors";
import { wordDiff } from "@/lib/diff";
import { cn } from "@/lib/utils";

function DiffLine({ tokens, side }: { tokens: { text: string; kind: string }[]; side: "left" | "right" }) {
  const runs: { text: string; kind: string }[] = [];
  tokens.forEach((t) => {
    const last = runs[runs.length - 1];
    if (last && last.kind === t.kind) last.text += ` ${t.text}`;
    else runs.push({ ...t });
  });
  return (
    <p className="text-[13px] leading-relaxed">
      {runs.map((t, i) => (
        <span key={i}>
          <span
            className={cn(
              t.kind === "del" && side === "left" && "rounded bg-danger/15 px-0.5 text-danger line-through decoration-danger/50",
              t.kind === "add" && side === "right" && "rounded bg-success/15 px-0.5 font-medium text-success",
            )}
          >
            {t.text}
          </span>{" "}
        </span>
      ))}
    </p>
  );
}

/** One suggested change, stacked rather than side by side so it fits beside the document. */
export function ChangeCard({ c, decision, onDecide }: { c: TailorChange; decision?: string; onDecide: (d: "accepted" | "rejected" | null) => void }) {
  const { left, right } = useMemo(() => wordDiff(c.original, c.tailored), [c.original, c.tailored]);
  const same = c.original === c.tailored || c.sourceId === "skills";
  return (
    <li className={cn("rounded-xl border bg-card p-3", decision === "accepted" && "border-success-border", decision === "rejected" && "opacity-70")}>
      <div className="mb-2 flex flex-wrap items-center gap-1.5 text-xs">
        <span className="font-semibold text-foreground/80">{c.section}</span>
        <Pill size="xs" tone="primary">{CHANGE_TYPE_LABEL[c.type]}</Pill>
        {decision === "accepted" && <Pill size="xs" tone="success" icon={Check}>On the page</Pill>}
        {decision === "rejected" && <Pill size="xs" tone="muted" icon={X}>Original kept</Pill>}
      </div>
      <div className="space-y-2">
        <div className="rounded-lg bg-muted/50 p-2.5">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Now</div>
          {same ? <p className="text-[13px] leading-relaxed">{c.original}</p> : <DiffLine tokens={left} side="left" />}
        </div>
        <div className={cn("rounded-lg p-2.5", decision === "rejected" ? "bg-muted/30" : "bg-success-soft/60")}>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Suggested</div>
          {same ? <p className="text-[13px] leading-relaxed">{c.tailored}</p> : <DiffLine tokens={right} side="right" />}
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{c.reason}</p>
      <div className="mt-2.5 flex gap-1.5">
        {decision ? (
          <Button size="xs" variant="ghost" onClick={() => onDecide(null)}>
            <Undo2 /> Undo
          </Button>
        ) : (
          <>
            <Button size="xs" onClick={() => onDecide("accepted")}>
              <Check /> Use it
            </Button>
            <Button size="xs" variant="outline" onClick={() => onDecide("rejected")}>
              <X /> Keep mine
            </Button>
          </>
        )}
      </div>
    </li>
  );
}

/** Replaces the old Truth Mode panel: the same honesty, said as a number that moves. */
export function AtsPanel({ changes, decisions }: { changes: TailorChange[]; decisions: Record<string, string> }) {
  const s = atsScore(changes, decisions);
  const before = BASE_ATS.keywords + BASE_ATS.formatting + BASE_ATS.structure + BASE_ATS.length + BASE_ATS.fileType;
  const rows = [
    { k: "Keyword coverage", v: s.keywords, max: ATS_MAX.keywords, note: "Terms from the posting that appear in your resume." },
    { k: "Formatting safety", v: s.formatting, max: ATS_MAX.formatting, note: "No tables or text boxes." },
    { k: "Section structure", v: s.structure, max: ATS_MAX.structure, note: "Headings screening software recognizes." },
    { k: "Length", v: s.length, max: ATS_MAX.length, note: "One page. Bullets under two lines." },
    { k: "File type", v: s.fileType, max: ATS_MAX.fileType, note: "PDF with real text, not an image." },
  ];
  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <ScoreRing value={s.total} size={72} stroke={6} sub="of 100" label="ATS compatibility score" />
        <div className="text-sm">
          <div className="text-muted-foreground">
            Before tailoring <span className="num font-semibold text-foreground">{before}</span>
          </div>
          <div className={cn("num font-semibold", s.total > before ? "text-success" : "text-muted-foreground")}>
            {s.total > before ? `+${s.total - before} from what you kept` : "Use a suggestion to raise it"}
          </div>
        </div>
      </div>
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.k}>
            <div className="mb-1 flex justify-between text-[13px]">
              <span className="font-medium">{r.k}</span>
              <span className="num text-muted-foreground">
                <span className="font-semibold text-foreground">{r.v}</span>/{r.max}
              </span>
            </div>
            <ScoreBar value={r.v} max={r.max} height={5} label={r.k} />
            <p className="mt-1 text-xs text-muted-foreground">{r.note}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function GapsPanel({ job }: { job: Job }) {
  if (job.gaps.length === 0) return <p className="text-sm text-muted-foreground">Nothing in this posting is missing from your resume.</p>;
  return (
    <ul className="space-y-2.5">
      {job.gaps.map((g) => (
        <li key={g.id} className="rounded-lg border border-warning-border bg-warning-soft/60 p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <span className="text-[13px] font-medium">{g.label}</span>
            <Pill size="xs" tone={g.severity === "dealbreaker" ? "danger" : g.severity === "trainable" ? "warning" : "muted"}>
              {SEVERITY_LABEL[g.severity]}
            </Pill>
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">{g.note}</p>
          {g.coverLetterLine && (
            <p className="mt-2 text-xs">
              <span className="font-semibold">Say it plainly: </span>
              <span className="italic">"{g.coverLetterLine}"</span>
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * The Career Translator, folded in where it is actually useful: next to the
 * document, showing this job's language for the lines you already have.
 */
export function TranslatorPanel({ job, live }: { job: Job; live: boolean }) {
  const { state } = useStore();
  const rows = live ? (job.translations ?? []).map((t) => ({ from: t.from, phrases: t.phrases })) : topBulletRows(job.target);
  const [free, setFree] = useState("");
  const [freeOut, setFreeOut] = useState<{ from: string; phrases: string[] }[]>([]);
  const [busy, setBusy] = useState(false);

  const translate = async () => {
    const text = free.trim();
    if (!text) return;
    setBusy(true);
    try {
      const phrases = live
        ? ((await api<{ rows: { phrases: string[] }[] }>("translate", { target: job.target, items: [text], prevField: state.prefs.prevField })).rows[0]?.phrases ?? [])
        : translateFreeText(text);
      if (phrases.length === 0) {
        toast("We could not find this job's language for that one", { description: "Try naming what you actually did, with the numbers." });
      } else {
        setFreeOut((o) => [{ from: text, phrases }, ...o]);
        setFree("");
      }
    } catch (e) {
      toast.error("We could not translate that", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      {job.storyLine && <p className="rounded-lg bg-primary-soft/60 p-3 text-[13px] italic">{job.storyLine}</p>}

      {rows.length > 0 ? (
        <div className="space-y-2.5">
          {rows.map((r, i) => (
            <TranslatorRow key={r.from} index={i} from={r.from} phrases={r.phrases} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          <Languages className="mr-1.5 inline h-4 w-4" aria-hidden />
          Run the suggestions for this job and the translations for your own lines will show up here.
        </p>
      )}

      <form
        className="space-y-2 rounded-lg border bg-card p-3"
        onSubmit={(e) => {
          e.preventDefault();
          void translate();
        }}
      >
        <label htmlFor="tr-free" className="text-[13px] font-medium">
          Translate something else you did
        </label>
        <Textarea id="tr-free" rows={2} value={free} onChange={(e) => setFree(e.target.value)} placeholder={TRANSLATOR_EXAMPLE} />
        <Button size="xs" type="submit" disabled={busy || !free.trim()}>
          {busy ? <Loader2 className="animate-spin" /> : <Wand2 />} Translate
        </Button>
        {freeOut.map((r, i) => (
          <TranslatorRow key={`${r.from}-${i}`} from={r.from} phrases={r.phrases} highlight={i === 0} />
        ))}
      </form>
    </div>
  );
}

function topBulletRows(target: TargetField, n = 4) {
  return Object.entries(BULLET_TRANSLATIONS)
    .sort((a, b) => b[1][target].appearsIn - a[1][target].appearsIn)
    .slice(0, n)
    .map(([id]) => ({ from: bulletById(id)?.text ?? "", phrases: BULLET_TRANSLATIONS[id][target].phrases }))
    .filter((r) => r.from);
}

export function VersionsPanel({
  versions,
  activeId,
  pro,
  onMakeDefault,
  onDelete,
}: {
  versions: ResumeVersion[];
  activeId: string;
  pro: boolean;
  onMakeDefault: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <ul className="space-y-2.5">
      {versions.map((v) => {
        const rate = v.sends ? Math.round((v.responses / v.sends) * 100) : 0;
        return (
          <li key={v.id} className="rounded-lg border bg-card p-3">
            <div className="flex items-start gap-2.5">
              <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[13px] font-semibold">{v.name}</span>
                  {activeId === v.id && <Pill size="xs" tone="primary">Default</Pill>}
                  {pro && rate >= 30 && <Pill size="xs" tone="success" icon={Star}>Best response rate</Pill>}
                </div>
                <div className="text-xs text-muted-foreground">{v.target}</div>
              </div>
              <ScoreRing value={v.ats} size={38} label={`ATS score for ${v.name}`} />
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              {pro ? (
                <span className="text-xs text-muted-foreground">
                  <span className="num">{v.responses}</span> of <span className="num">{v.sends}</span> got a response
                </span>
              ) : (
                <Link to="/app/billing" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                  <Lock className="h-3 w-3" /> Response rates with Pro
                </Link>
              )}
              <span className="flex gap-1">
                {activeId !== v.id && (
                  <Button size="xs" variant="ghost" onClick={() => onMakeDefault(v.id)}>
                    Make default
                  </Button>
                )}
                {v.id !== "v-base" && (
                  <Button size="icon-sm" variant="ghost" aria-label={`Delete ${v.name}`} onClick={() => onDelete(v.id)}>
                    <Trash2 />
                  </Button>
                )}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
