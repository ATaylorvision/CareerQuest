/**
 * Font, size, line spacing and margins for a printed resume or letter.
 *
 * These are applied on top of a layout's own styles when the page is built, so
 * every layout responds to them the same way. Sizes are scaled by rewriting
 * every point size in the layout, which keeps the proportions the designer
 * chose instead of just enlarging the body text.
 */

export interface ResumeFormat {
  /** A key of FONTS. "template" keeps the layout's own typeface. */
  font: string;
  /** Body size in points. Null keeps the layout's own size. */
  size: number | null;
  /** Null keeps the layout's own spacing. */
  lineHeight: number | null;
  /** Page margin in inches. Null keeps the layout's own. */
  margin: number | null;
}

export const DEFAULT_FORMAT: ResumeFormat = { font: "template", size: null, lineHeight: null, margin: null };

/** Below this a resume is hard to read on paper, and screening software may misread it. */
export const MIN_SIZE = 9.5;
export const MAX_SIZE = 12;

/** Faces that are installed almost everywhere and that screening software reads without trouble. */
export const FONTS: { id: string; label: string; stack: string }[] = [
  { id: "template", label: "Layout default", stack: "" },
  { id: "calibri", label: "Calibri", stack: 'Calibri,Carlito,"Segoe UI",Arial,sans-serif' },
  { id: "arial", label: "Arial", stack: 'Arial,Helvetica,"Liberation Sans",sans-serif' },
  { id: "helvetica", label: "Helvetica", stack: '"Helvetica Neue",Helvetica,Arial,sans-serif' },
  { id: "verdana", label: "Verdana", stack: "Verdana,Geneva,sans-serif" },
  { id: "georgia", label: "Georgia", stack: 'Georgia,"Times New Roman",serif' },
  { id: "cambria", label: "Cambria", stack: "Cambria,Georgia,serif" },
  { id: "garamond", label: "Garamond", stack: 'Garamond,"EB Garamond","Times New Roman",serif' },
  { id: "times", label: "Times New Roman", stack: '"Times New Roman",Times,"Liberation Serif",serif' },
];

export const SPACINGS = [1.15, 1.25, 1.35, 1.5, 1.65];
export const MARGINS: { value: number; label: string }[] = [
  { value: 0.4, label: "Narrow (0.4 in)" },
  { value: 0.5, label: "Slim (0.5 in)" },
  { value: 0.65, label: "Normal (0.65 in)" },
  { value: 0.8, label: "Wide (0.8 in)" },
];

/** What a layout has to say about itself for the format to be applied to it. */
export interface Formattable {
  css: string;
  /** The body size the layout is designed at, in points. */
  base: number;
  /** The layout's own line spacing. */
  lh: number;
  /** The layout paints to the edge of the page (a coloured column, say), so margins cannot be changed. */
  bleed?: boolean;
}

export const PAGE_W = 816; // 8.5 in at 96 dpi
export const PAGE_H = 1056; // 11 in

export function clampSize(n: number) {
  return Math.min(MAX_SIZE, Math.max(MIN_SIZE, Math.round(n * 4) / 4));
}

/** Every point size in a stylesheet, scaled by one variable. */
export function scalePoints(css: string): string {
  return css.replace(/(\d*\.?\d+)pt\b/g, (_, n: string) => `calc(${n}pt * var(--z))`);
}

/**
 * The layout's stylesheet with the person's format laid over it.
 * `preview` also draws the page margins as padding, because a screen has no
 * @page rule. Real printing uses @page so that every page gets the margin.
 */
export function applyFormat(t: Formattable, f: ResumeFormat, preview = false): string {
  const z = f.size ? f.size / t.base : 1;
  let css = z !== 1 ? scalePoints(t.css) : t.css;
  let extra = z !== 1 ? `:root{--z:${z.toFixed(4)}}` : "";

  const font = FONTS.find((x) => x.id === f.font);
  if (font?.stack) extra += `body,h1,h2,h3,p,div,span,li,b,i{font-family:${font.stack}!important}`;
  if (f.lineHeight) extra += `body,p,div,li{line-height:${f.lineHeight}!important}`;

  if (f.margin !== null && !t.bleed) {
    extra += `body{padding:0!important}@page{margin:${f.margin}in}`;
    if (preview) extra += `html{padding:${f.margin}in}`;
  }
  if (preview && f.margin === null) extra += `html{padding:0}`;
  return css + extra;
}

/** The height of a page that content can use, in pixels. */
export function usablePageHeight(t: Formattable, f: ResumeFormat): number {
  return f.margin !== null && !t.bleed ? PAGE_H - 2 * f.margin * 96 : PAGE_H;
}

/** Height of one line of body text, in pixels. */
export function linePx(t: Formattable, f: ResumeFormat): number {
  return (f.size ?? t.base) * (96 / 72) * (f.lineHeight ?? t.lh);
}
