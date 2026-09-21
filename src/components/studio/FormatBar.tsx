import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Eye, EyeOff, Loader2, Minus, Plus, RotateCcw, Scissors, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { clampSize, DEFAULT_FORMAT, FONTS, MARGINS, MAX_SIZE, MIN_SIZE, PAGE_H, PAGE_W, SPACINGS, type ResumeFormat } from "@/lib/resumeFormat";
import type { CutSuggestion, PageFit } from "@/lib/fit";
import { cn } from "@/lib/utils";

const DEFAULT = "default";

interface Props {
  format: ResumeFormat;
  onChange: (next: ResumeFormat) => void;
  /** What the layout is designed at, shown when no size has been chosen. */
  baseSize: number;
  lockedMargins: boolean;
  fit: PageFit | null;
  allowedPages: 1 | 2;
  onAuto: () => void;
  autoBusy: boolean;
  /** What Auto adjust could not do, in words. */
  note: string | null;
  cuts: CutSuggestion[];
  onCut: (id: string) => void;
  onRoom: () => void;
  /** The finished page as HTML, for the preview. */
  previewHtml: string;
}

/** Fits the real page to the width available, so the preview is what will print. */
function PagePreview({ html, pages }: { html: string; pages: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.6);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => setScale(Math.min(1, el.clientWidth / PAGE_W));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const h = PAGE_H * pages;
  return (
    <div ref={box} className="w-full overflow-hidden rounded-lg border bg-neutral-100">
      <div style={{ height: h * scale }} className="relative">
        <iframe title="Page preview" srcDoc={html} tabIndex={-1} style={{ width: PAGE_W, height: h, transform: `scale(${scale})`, transformOrigin: "top left" }} className="pointer-events-none absolute left-0 top-0 border-0 bg-white" />
        {Array.from({ length: pages - 1 }, (_, i) => (
          <div key={i} className="pointer-events-none absolute left-0 right-0 border-t-2 border-dashed border-primary/60" style={{ top: PAGE_H * (i + 1) * scale }}>
            <span className="absolute right-1 top-0.5 rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">Page {i + 2} starts</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function FormatBar({ format, onChange, baseSize, lockedMargins, fit, allowedPages, onAuto, autoBusy, note, cuts, onCut, onRoom, previewHtml }: Props) {
  const [showPreview, setShowPreview] = useState(false);
  const size = format.size ?? baseSize;
  const set = (patch: Partial<ResumeFormat>) => onChange({ ...format, ...patch });
  const changed = JSON.stringify(format) !== JSON.stringify(DEFAULT_FORMAT);

  const over = fit && fit.linesOver > 0;
  const roomy = fit && !over && fit.pages === 1 && allowedPages === 1 && fit.fill < 0.85;
  const pageWord = allowedPages === 2 ? "two pages" : "one page";

  return (
    <div className="space-y-3 rounded-xl border bg-card p-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Font
          <Select value={format.font} onValueChange={(v) => set({ font: v })}>
            <SelectTrigger className="h-9 w-[150px] text-sm font-normal normal-case tracking-normal text-foreground" aria-label="Font">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FONTS.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  <span style={f.stack ? { fontFamily: f.stack } : undefined}>{f.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        <div className="space-y-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <span id="fmt-size">Size</span>
          <div className="flex h-9 items-center rounded-md border bg-background" role="group" aria-labelledby="fmt-size">
            <button type="button" aria-label="Smaller text" disabled={size <= MIN_SIZE} onClick={() => set({ size: clampSize(size - 0.5) })} className="flex h-full w-8 items-center justify-center rounded-l-md hover:bg-accent disabled:opacity-40">
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="num w-14 text-center text-sm font-normal normal-case tracking-normal text-foreground">{size} pt</span>
            <button type="button" aria-label="Larger text" disabled={size >= MAX_SIZE} onClick={() => set({ size: clampSize(size + 0.5) })} className="flex h-full w-8 items-center justify-center rounded-r-md hover:bg-accent disabled:opacity-40">
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <label className="space-y-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Line spacing
          <Select value={format.lineHeight === null ? DEFAULT : String(format.lineHeight)} onValueChange={(v) => set({ lineHeight: v === DEFAULT ? null : Number(v) })}>
            <SelectTrigger className="h-9 w-[130px] text-sm font-normal normal-case tracking-normal text-foreground" aria-label="Line spacing">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={DEFAULT}>Layout default</SelectItem>
              {SPACINGS.map((s) => (
                <SelectItem key={s} value={String(s)}>
                  {s.toFixed(2).replace(/0$/, "")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        <label className="space-y-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Margins
          <Select disabled={lockedMargins} value={format.margin === null ? DEFAULT : String(format.margin)} onValueChange={(v) => set({ margin: v === DEFAULT ? null : Number(v) })}>
            <SelectTrigger className="h-9 w-[150px] text-sm font-normal normal-case tracking-normal text-foreground" aria-label="Margins" title={lockedMargins ? "This layout runs to the page edge, so its margins are fixed." : undefined}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={DEFAULT}>Layout default</SelectItem>
              {MARGINS.map((m) => (
                <SelectItem key={m.value} value={String(m.value)}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        <div className="ml-auto flex items-center gap-2">
          {changed && (
            <Button variant="ghost" size="sm" onClick={() => onChange(DEFAULT_FORMAT)}>
              <RotateCcw /> Reset
            </Button>
          )}
          <Button size="sm" onClick={onAuto} disabled={autoBusy}>
            {autoBusy ? <Loader2 className="animate-spin" /> : <Sparkles />} Auto adjust
          </Button>
        </div>
      </div>

      {/* how full the page is */}
      <div role="status" aria-live="polite" className="text-sm">
        {!fit ? (
          <span className="text-muted-foreground">Measuring your page</span>
        ) : over ? (
          <div className="flex items-start gap-2 rounded-lg border border-warning-border bg-warning-soft p-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
            <span>
              About <b className="num">{fit.linesOver}</b> line{fit.linesOver === 1 ? "" : "s"} over {pageWord}. Auto adjust tightens the spacing first, and never shrinks the type below {MIN_SIZE} pt.
            </span>
          </div>
        ) : roomy ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-info-border bg-info-soft p-2.5">
            <span>
              One page, <b className="num">{Math.round(fit.fill * 100)}%</b> full. There is room for about <b className="num">{fit.linesLeft}</b> more line{fit.linesLeft === 1 ? "" : "s"}. A fuller page usually reads as more experience.
            </span>
            <Button size="xs" variant="outline" onClick={onRoom}>
              Add a line
            </Button>
          </div>
        ) : (
          <span className="flex items-center gap-1.5 text-success">
            <CheckCircle2 className="h-4 w-4" aria-hidden /> {fit.pages === 1 ? "Fits on one page" : `Fits on ${fit.pages} pages`}, <span className="num">{Math.round(fit.fill * 100)}%</span> full
          </span>
        )}
        {note && <p className="mt-1.5 text-xs text-muted-foreground">{note}</p>}
      </div>

      {cuts.length > 0 && (
        <div className="rounded-lg border p-3">
          <div className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
            <Scissors className="h-4 w-4 text-muted-foreground" aria-hidden /> Lines you could cut
          </div>
          <p className="mb-2 text-xs text-muted-foreground">These are the ones we would trim first. Nothing is removed unless you choose it.</p>
          <ul className="space-y-1.5">
            {cuts.map((c) => (
              <li key={c.id} className="flex items-start gap-2 rounded-md bg-muted/40 p-2 text-[13px]">
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] text-muted-foreground">{c.role}</div>
                  <div>{c.text}</div>
                </div>
                <Button size="xs" variant="outline" onClick={() => onCut(c.id)} aria-label={`Remove this line: ${c.text.slice(0, 40)}`}>
                  <Trash2 /> Remove
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <Button variant="ghost" size="xs" onClick={() => setShowPreview((v) => !v)}>
          {showPreview ? <EyeOff /> : <Eye />} {showPreview ? "Hide page preview" : "Show page preview"}
        </Button>
        {showPreview && (
          <div className={cn("mt-2")}>
            <PagePreview html={previewHtml} pages={Math.max(1, fit?.pages ?? 1)} />
          </div>
        )}
      </div>
    </div>
  );
}
