// Tests for fitting a resume to a page and for the format controls. No browser, no network.
// Run:  npm run test:fit
import assert from "node:assert/strict";
import { autoAdjust, sizeLadder, suggestCuts, summarise, yearsOfExperience, type Measure } from "../src/lib/fit";
import { applyFormat, clampSize, linePx, MIN_SIZE, scalePoints, usablePageHeight, type Formattable, type ResumeFormat } from "../src/lib/resumeFormat";
import type { BuiltResume } from "../src/lib/resumeBuild";

let pass = 0;
let fail = 0;
const test = async (name: string, fn: () => void | Promise<void>) => {
  try {
    await fn();
    pass++;
    console.log(`  PASS  ${name}`);
  } catch (e) {
    fail++;
    console.log(`  FAIL  ${name}\n        ${(e as Error).message.split("\n")[0]}`);
  }
};

const T: Formattable = { css: "body{font-size:10.5pt;line-height:1.42}h1{font-size:20pt}", base: 10.5, lh: 1.42 };
const BLEED: Formattable = { ...T, bleed: true };

/** A fake page whose height follows the format, so the ladder can be tested without a browser. */
const render = (f: ResumeFormat) => JSON.stringify(f);
const fakeMeasure = (content: number): Measure => async (html) => {
  const f = JSON.parse(html) as ResumeFormat;
  const size = f.size ?? 10.5;
  const lh = f.lineHeight ?? 1.42;
  const margin = f.margin ?? 0.45;
  // More content, bigger type, looser spacing and wider margins all make the page taller.
  return content * (size / 10.5) * (lh / 1.42) * (1 + (margin - 0.45) * 0.35);
};

const resume = (roles: { title: string; bullets: string[] }[]): BuiltResume =>
  ({
    name: "A",
    email: "",
    phone: "",
    location: "",
    summary: "",
    education: [],
    certifications: [],
    skills: [],
    certsOwnSection: false,
    changedIds: new Set(),
    editedIds: new Set(),
    roles: roles.map((r, i) => ({ id: `r${i}`, title: r.title, company: `Co${i}`, location: "", start: "2010", end: "2015", bullets: r.bullets.map((b, j) => ({ id: `r${i}b${j}`, text: b })) })),
  }) as unknown as BuiltResume;

await test("point sizes are scaled by one variable", () => assert.match(scalePoints("h1{font-size:20pt}"), /calc\(20pt \* var\(--z\)\)/));
await test("a size change scales the layout rather than just the body", () => {
  const css = applyFormat(T, { font: "template", size: 9.5, lineHeight: null, margin: null });
  assert.match(css, /--z:0\.9048/);
  assert.match(css, /h1\{font-size:calc\(20pt/);
});
await test("no changes leaves the layout exactly as designed", () => assert.equal(applyFormat(T, { font: "template", size: null, lineHeight: null, margin: null }), T.css));
await test("a chosen font overrides the layout's own", () => assert.match(applyFormat(T, { font: "arial", size: null, lineHeight: null, margin: null }), /font-family:Arial/));
await test("margins use the page rule so every page gets them", () => assert.match(applyFormat(T, { font: "template", size: null, lineHeight: null, margin: 0.5 }), /@page\{margin:0\.5in\}/));
await test("a layout that paints to the edge ignores the margin setting", () => assert.doesNotMatch(applyFormat(BLEED, { font: "template", size: null, lineHeight: null, margin: 0.5 }), /@page\{margin:0\.5in\}/));
await test("size is never allowed below the readable minimum", () => assert.equal(clampSize(8), MIN_SIZE));
await test("size is never allowed above the maximum", () => assert.equal(clampSize(20), 12));
await test("the usable page shrinks with the margin", () => assert.ok(usablePageHeight(T, { font: "template", size: null, lineHeight: null, margin: 1 }) < usablePageHeight(T, { font: "template", size: null, lineHeight: null, margin: 0.5 })));
await test("a line of text is taller at a bigger size", () => assert.ok(linePx(T, { font: "template", size: 12, lineHeight: null, margin: null }) > linePx(T, { font: "template", size: 10, lineHeight: null, margin: null })));

await test("the size ladder stops at the readable minimum", () => {
  const l = sizeLadder(10.5);
  assert.equal(Math.min(...l), MIN_SIZE);
  assert.equal(l[0], 10.5);
  assert.ok(l.every((s, i) => i === 0 || s < l[i - 1]));
});

await test("a short page reports room left and is not over", () => {
  const f = summarise(500, T, { font: "template", size: null, lineHeight: null, margin: null }, 1);
  assert.equal(f.pages, 1);
  assert.equal(f.linesOver, 0);
  assert.ok(f.linesLeft > 10);
  assert.ok(f.fill < 0.6);
});
await test("a long page reports how many lines it is over", () => {
  const f = summarise(1200, T, { font: "template", size: null, lineHeight: null, margin: null }, 1);
  assert.equal(f.pages, 2);
  assert.ok(f.linesOver > 5);
});

await test("years of experience read the earliest start to the latest end", () => assert.equal(yearsOfExperience([{ start: "Mar 2001", end: "2008" }, { start: "2009", end: "Present" }], new Date("2026-06-01")), 25));
await test("unreadable dates count as nothing rather than crashing", () => assert.equal(yearsOfExperience([{ start: "long ago", end: "recently" }]), 0));

await test("a page that already fits is left alone and reported as fitting", async () => {
  const out = await autoAdjust(render, T, { font: "template", size: null, lineHeight: null, margin: null }, 5, fakeMeasure(900));
  assert.equal(out.fits, true);
  assert.equal(out.allowedPages, 1);
  assert.equal(out.format.size, null);
});
await test("a slightly long page is fixed by spacing before the type gets smaller", async () => {
  const out = await autoAdjust(render, T, { font: "template", size: null, lineHeight: null, margin: null }, 5, fakeMeasure(1100));
  assert.equal(out.fits, true);
  assert.equal(out.format.size, null, "type size should not have changed");
  assert.ok((out.format.lineHeight ?? 2) < 1.42);
});
await test("a longer page shrinks the type, but never below the minimum", async () => {
  const out = await autoAdjust(render, T, { font: "template", size: null, lineHeight: null, margin: null }, 5, fakeMeasure(1300));
  assert.equal(out.fits, true);
  assert.ok((out.format.size ?? 10.5) >= MIN_SIZE);
  assert.ok((out.format.size ?? 10.5) < 10.5);
});
await test("a page too long to fit at the smallest setting says so, and stays readable", async () => {
  const out = await autoAdjust(render, T, { font: "template", size: null, lineHeight: null, margin: null }, 5, fakeMeasure(3000));
  assert.equal(out.fits, false);
  assert.ok((out.format.size ?? 10.5) >= MIN_SIZE);
  assert.ok(out.fit.linesOver > 0);
});
await test("a long career is allowed two pages, without shrinking the type to fit one", async () => {
  const out = await autoAdjust(render, T, { font: "template", size: null, lineHeight: null, margin: null }, 20, fakeMeasure(1700));
  assert.equal(out.fits, true);
  assert.equal(out.allowedPages, 2);
  assert.equal(out.format.size, null);
});
await test("a long career that would fit one page at a comfortable size uses one", async () => {
  const out = await autoAdjust(render, T, { font: "template", size: null, lineHeight: null, margin: null }, 20, fakeMeasure(1000));
  assert.equal(out.allowedPages, 1);
  assert.equal(out.fits, true);
});
await test("a long career that needs shrinking to fit one page gets two comfortable pages instead", async () => {
  const out = await autoAdjust(render, T, { font: "template", size: null, lineHeight: null, margin: null }, 20, fakeMeasure(1300));
  assert.equal(out.allowedPages, 2);
  assert.equal(out.format.size, null);
  assert.equal(out.fits, true);
});
await test("a shorter career is not given a second page", async () => {
  const out = await autoAdjust(render, T, { font: "template", size: null, lineHeight: null, margin: null }, 8, fakeMeasure(1700));
  assert.equal(out.allowedPages, 1);
  assert.equal(out.fits, false);
});
await test("a layout with fixed margins never has its margin set", async () => {
  const out = await autoAdjust(render, BLEED, { font: "template", size: null, lineHeight: null, margin: null }, 5, fakeMeasure(1100));
  assert.equal(out.format.margin, null);
});
await test("the user's chosen font survives an adjustment", async () => {
  const out = await autoAdjust(render, T, { font: "georgia", size: null, lineHeight: null, margin: null }, 5, fakeMeasure(1100));
  assert.equal(out.format.font, "georgia");
});

await test("cuts are suggested from older roles first", () => {
  const r = resume([
    { title: "New", bullets: ["a new line ".repeat(6), "another new line ".repeat(6), "third new line ".repeat(6)] },
    { title: "Old", bullets: ["old one ".repeat(10), "old two ".repeat(10), "old three ".repeat(10)] },
  ]);
  const cuts = suggestCuts(r, 2);
  assert.ok(cuts.length > 0);
  assert.ok(cuts.every((c) => c.role.startsWith("Old")));
});
await test("no role is ever cut down to nothing", () => {
  const r = resume([
    { title: "New", bullets: ["keep me one", "keep me two"] },
    { title: "Old", bullets: ["only line ".repeat(8), "second line ".repeat(8)] },
  ]);
  const cuts = suggestCuts(r, 50);
  const oldLeft = 2 - cuts.filter((c) => c.role.startsWith("Old")).length;
  assert.ok(oldLeft >= 1);
});
await test("nothing is suggested when nothing needs to go", () => assert.deepEqual(suggestCuts(resume([{ title: "A", bullets: ["x y z", "p q r"] }]), 0), []));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
