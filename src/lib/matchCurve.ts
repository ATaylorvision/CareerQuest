/**
 * How a raw 0-100 fit score reads to the person looking at it. The underlying
 * comparison against the resume is unchanged and still as strict as ever; this
 * only changes how that number is presented, the way a grading curve does.
 * Monotonic, so it never changes the order jobs are ranked in relative to
 * each other, and it leaves 0 and 100 fixed.
 */
export function curveMatch(raw: number): number {
  const r = Math.max(0, Math.min(100, raw));
  return Math.round(100 * Math.pow(r / 100, 0.4));
}
