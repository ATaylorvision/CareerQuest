import type { BuiltResume } from "@/lib/resumeBuild";
import { clampSize, linePx, MIN_SIZE, PAGE_H, PAGE_W, usablePageHeight, type Formattable, type ResumeFormat } from "@/lib/resumeFormat";

/**
 * Fitting a resume to a page.
 *
 * The page is measured by really laying it out, so the answer is what a
 * printout will do rather than a guess from word counts. To make room we only
 * ever change how the page is set (line spacing, margins, then type size, and
 * never below the smallest readable size). We never delete anything. When
 * setting alone cannot get there, we say which lines could go and leave the
 * choice with the person.
 */

/** Measures how tall a page of this HTML is, in pixels, at page width. */
export type Measure = (html: string) => Promise<number>;

export interface PageFit {
  /** How many pages of content there are. */
  pages: number;
  /** How full the last page is, 0 to 1. */
  fill: number;
  /** Lines of overflow past the allowed page count. Zero when it fits. */
  linesOver: number;
  /** Lines of room left on the last page. */
  linesLeft: number;
  usedPx: number;
  pagePx: number;
}

const SAFETY = 8; // print and screen differ by a few pixels

/** Lays a page out in a hidden frame and reads how tall it came out. */
export const measureInFrame: Measure = (html) =>
  new Promise((resolve) => {
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.tabIndex = -1;
    frame.style.cssText = `position:fixed;left:-99999px;top:0;width:${PAGE_W}px;height:200px;border:0;visibility:hidden;pointer-events:none`;
    let done = false;
    const finish = (h: number) => {
      if (done) return;
      done = true;
      frame.remove();
      resolve(h);
    };
    frame.onload = () => {
      const doc = frame.contentDocument;
      const read = () => finish(doc?.body ? Math.ceil(doc.body.getBoundingClientRect().height) : 0);
      const fonts = (doc as (Document & { fonts?: { ready: Promise<unknown> } }) | null)?.fonts;
      if (fonts?.ready) void fonts.ready.then(read, read);
      else read();
    };
    frame.srcdoc = html;
    document.body.appendChild(frame);
    window.setTimeout(() => finish(0), 4000);
  });

export function summarise(usedPx: number, t: Formattable, f: ResumeFormat, allowedPages: number): PageFit {
  const pagePx = usablePageHeight(t, f);
  const pages = Math.max(1, Math.ceil((usedPx - SAFETY) / pagePx));
  const lastPage = usedPx - (pages - 1) * pagePx;
  const line = linePx(t, f);
  const over = Math.max(0, usedPx - SAFETY - allowedPages * pagePx);
  return {
    pages,
    fill: Math.min(1, Math.max(0, lastPage / pagePx)),
    linesOver: over > 0 ? Math.ceil(over / line) : 0,
    linesLeft: Math.max(0, Math.floor((allowedPages * pagePx - SAFETY - usedPx) / line)),
    usedPx,
    pagePx,
  };
}

/** Years from the earliest start to the latest end across the roles. Unreadable dates are ignored. */
export function yearsOfExperience(roles: { start: string; end: string }[], now = new Date()): number {
  const year = (s: string) => {
    if (/present|current|now|today/i.test(s)) return now.getFullYear() + now.getMonth() / 12;
    const m = s.match(/(19|20)\d{2}/);
    return m ? Number(m[0]) : null;
  };
  const starts = roles.map((r) => year(r.start)).filter((n): n is number => n !== null);
  const ends = roles.map((r) => year(r.end)).filter((n): n is number => n !== null);
  if (!starts.length) return 0;
  const from = Math.min(...starts);
  const to = ends.length ? Math.max(...ends) : now.getFullYear();
  return Math.max(0, Math.floor(to - from));
}

/** Past this many years a second page is normal and expected. */
export const TWO_PAGE_AFTER_YEARS = 15;

/** Roomy first, tight last. Each pair is line spacing and margin in inches. */
const SPACING_LADDER: [number, number][] = [
  [1.4, 0.65],
  [1.35, 0.6],
  [1.3, 0.55],
  [1.25, 0.5],
  [1.2, 0.45],
  [1.15, 0.4],
];

/** The sizes to try, largest first, never going below the readable minimum. */
export function sizeLadder(start: number): number[] {
  const out: number[] = [];
  for (let s = clampSize(start); s >= MIN_SIZE - 1e-9; s -= 0.25) out.push(clampSize(s));
  if (!out.includes(MIN_SIZE)) out.push(MIN_SIZE);
  return out;
}

export interface FitOutcome {
  format: ResumeFormat;
  fit: PageFit;
  /** True when the content fits the allowed pages. */
  fits: boolean;
  /** How many pages we aimed for. */
  allowedPages: 1 | 2;
}

/**
 * Finds the gentlest format that fits. Spacing and margins are spent before
 * type size, because size is what makes a page hard to read.
 */
export async function autoAdjust(render: (f: ResumeFormat) => string, t: Formattable, current: ResumeFormat, years: number, measure: Measure = measureInFrame): Promise<FitOutcome> {
  const ladderFor = async (allowed: 1 | 2, minSize: number): Promise<FitOutcome | null> => {
    const startSize = Math.min(current.size ?? t.base, t.base);
    let last: FitOutcome | null = null;
    for (const size of sizeLadder(startSize)) {
      if (size < minSize - 1e-9) break;
      for (const [lh, margin] of SPACING_LADDER) {
        const f: ResumeFormat = { ...current, size: size === t.base ? null : size, lineHeight: Math.min(t.lh, lh), margin: t.bleed ? null : margin };
        const used = await measure(render(f));
        const fit = summarise(used, t, f, allowed);
        last = { format: f, fit, fits: fit.linesOver === 0, allowedPages: allowed };
        if (last.fits) return last;
        if (t.bleed) break; // its margins are fixed, so there is only one spacing to try per size
      }
    }
    return last;
  };

  if (years > TWO_PAGE_AFTER_YEARS) {
    // A long career may run to two pages. Use one only if spacing alone gets it there; a comfortable second page beats shrinking the type.
    const one = await ladderFor(1, Math.min(current.size ?? t.base, t.base));
    if (one?.fits) return one;
    const roomy: ResumeFormat = { ...current, size: null, lineHeight: null, margin: t.bleed ? null : 0.65 };
    const used = await measure(render(roomy));
    const fit = summarise(used, t, roomy, 2);
    if (fit.linesOver === 0) return { format: roomy, fit, fits: true, allowedPages: 2 };
    return (await ladderFor(2, MIN_SIZE)) ?? { format: roomy, fit, fits: false, allowedPages: 2 };
  }

  const out = await ladderFor(1, MIN_SIZE);
  if (out) return out;
  const used = await measure(render(current));
  return { format: current, fit: summarise(used, t, current, 1), fits: false, allowedPages: 1 };
}

export interface CutSuggestion {
  id: string;
  text: string;
  role: string;
  /** Roughly how many lines it would give back. */
  lines: number;
}

/** About how many lines a bullet takes at typical page width. */
const linesFor = (text: string, perLine = 100) => Math.max(1, Math.ceil(text.length / perLine));

/**
 * Lines worth considering removing, oldest and longest first, until they would
 * cover the overflow. This only suggests. The person decides what goes.
 */
export function suggestCuts(r: BuiltResume, linesOver: number): CutSuggestion[] {
  if (linesOver <= 0) return [];
  const candidates: (CutSuggestion & { score: number })[] = [];
  r.roles.forEach((role, ri) => {
    // The most recent role is what a reader looks at first, so its lines are protected until last.
    const recentBonus = ri === 0 ? -1000 : 0;
    role.bullets.forEach((b, bi) => {
      // Later bullets in older roles are the least valuable, and long ones cost the most room.
      const score = ri * 100 + bi * 10 + linesFor(b.text) * 5 + recentBonus;
      candidates.push({ id: b.id, text: b.text, role: `${role.title}, ${role.company}`, lines: linesFor(b.text), score });
    });
  });
  candidates.sort((a, b) => b.score - a.score);
  const out: CutSuggestion[] = [];
  let saved = 0;
  for (const c of candidates) {
    if (saved >= linesOver) break;
    // Never leave a role with no lines at all.
    const remaining = r.roles.find((role) => role.bullets.some((b) => b.id === c.id))?.bullets.filter((b) => !out.some((o) => o.id === b.id)).length ?? 0;
    if (remaining <= 1) continue;
    out.push({ id: c.id, text: c.text, role: c.role, lines: c.lines });
    saved += c.lines;
  }
  return out;
}

export { PAGE_H };
