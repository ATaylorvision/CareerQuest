/** Picks a salary range out of pasted job text, so the field can fill itself in instead of asking twice. */
const SALARY_RE = /\$?\s?(\d{2,3}(?:,\d{3})?)\s?(k)?\s?(?:-|to|–|—)\s?\$?\s?(\d{2,3}(?:,\d{3})?)\s?(k)?\s?(?:per\s*(?:year|yr|annum)|\/\s*(?:year|yr)|annually)?/i;

export function guessSalaryFromText(text: string): [number, number] | null {
  const m = text.match(SALARY_RE);
  if (!m) return null;
  const num = (s: string, k: string | undefined) => Math.round(parseFloat(s.replace(/,/g, "")) * (k ? 1000 : 1));
  const a = num(m[1], m[2]);
  const b = num(m[3], m[4] ?? m[2]);
  if (!a || !b || a > b || a < 8000 || b > 2_000_000) return null;
  return [a, b];
}
