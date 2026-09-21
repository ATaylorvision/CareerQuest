// Tests for the links on Roadmap steps. No network.
// Run:  npm run test:links
import assert from "node:assert/strict";
import { linksFor } from "../src/data/resourceLinks";
import { GAPS } from "../src/data/gaps";

let pass = 0;
let fail = 0;
const test = (name: string, fn: () => void) => {
  try {
    fn();
    pass++;
    console.log(`  PASS  ${name}`);
  } catch (e) {
    fail++;
    console.log(`  FAIL  ${name}\n        ${(e as Error).message.split("\n")[0]}`);
  }
};

const all = Object.values(GAPS).flatMap((g) => g.resources);

test("a step we know gets its direct page", () => assert.equal(linksFor({ id: "sql-1", title: "x" })[0].url, "https://sqlbolt.com/"));
test("a video step gets a video search", () => assert.match(linksFor({ id: "zz-1", title: "Warehouse management fundamentals, free video series" })[0].url, /youtube\.com\/results/));
test("a course step gets a course search", () => assert.match(linksFor({ id: "zz-2", title: "Entry level project management certificate on a MOOC platform" })[0].url, /coursera\.org\/search/));
test("a step that is about doing something gets no link, rather than a useless one", () => assert.deepEqual(linksFor({ id: "dc-1", title: "Ask a DC contact for a 30 minute walkthrough" }), []));
test("a step the model wrote gets links too", () => assert.ok(linksFor({ id: "custom-x-1", title: "Free course on inventory forecasting", detail: "A short course" }).length > 0));
test("no step ever gets more than two links, except ones we curated", () => assert.ok(all.every((r) => linksFor(r).length <= 2)));
test("every link is https and opens a real site", () => assert.ok(all.flatMap((r) => linksFor(r)).every((l) => l.url.startsWith("https://") && !/\s/.test(l.url))));
test("search text is safely encoded", () => assert.ok(!linksFor({ id: "zz-3", title: "SQL & data <script> course" })[0].url.includes("<script>")));
test("most steps in the library lead somewhere", () => assert.ok(all.filter((r) => linksFor(r).length > 0).length >= Math.floor(all.length * 0.6)));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
