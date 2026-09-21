// Tests for turning LinkedIn scraper output into listings. No network.
// Run:  npm run test:apify
import assert from "node:assert/strict";
import { LIMITS, mapLinkedIn, parseSalary } from "../api/_lib/apify";

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

// The shape the scraper really returned in a test run.
const item = {
  id: "4467926441",
  link: "https://www.linkedin.com/jobs/view/laundries-operations-manager-2-at-sodexo-4467926441?position=1",
  title: "Laundries Operations Manager 2",
  companyName: "Sodexo",
  location: "Jamaica, NY",
  postedAt: "2026-09-16",
  descriptionHtml: "<strong>Sodexo</strong> is seeking an Operations Manager &amp; leader",
  descriptionText: "Sodexo is seeking an Operations Manager for Laundry in Jamaica, New York.",
  applyUrl: "",
  salary: "$77,605.00/yr - $100,430.00/yr",
  applicantsCount: "25",
  employmentType: "Full-time",
  jobFunction: "Management and Manufacturing",
};

test("a real result becomes a listing", () => {
  const j = mapLinkedIn(item)!;
  assert.equal(j.source, "linkedin");
  assert.equal(j.external_id, "4467926441");
  assert.equal(j.title, "Laundries Operations Manager 2");
  assert.equal(j.company, "Sodexo");
  assert.equal(j.location, "Jamaica, NY");
});
test("the state is read from City, ST so the listing can be placed", () => assert.equal(mapLinkedIn(item)!.state, "NY"));
test("a long form state is understood too", () => assert.equal(mapLinkedIn({ ...item, location: "Austin, Texas, United States" })!.state, "TX"));
test("no state is guessed when there is none", () => assert.equal(mapLinkedIn({ ...item, location: "United States" })!.state, null));
test("a yearly salary range is read", () => {
  const j = mapLinkedIn(item)!;
  assert.deepEqual([j.salary_min, j.salary_max], [77605, 100430]);
  assert.equal(j.salary_period, "year");
});
test("an hourly rate is not turned into a yearly salary", () => assert.equal(parseSalary("$32.00/hr - $41.00/hr"), null));
test("no salary stays no salary", () => assert.equal(mapLinkedIn({ ...item, salary: "" })!.salary_min, null));
test("the posting date becomes a real date", () => assert.equal(mapLinkedIn(item)!.posted_at, "2026-09-16T00:00:00.000Z"));
test("a date we cannot read is left empty, not invented", () => assert.equal(mapLinkedIn({ ...item, postedAt: "2 days ago" })!.posted_at, null));
test("with no employer link the LinkedIn posting is the apply link", () => assert.equal(mapLinkedIn(item)!.apply_url, item.link));
test("an employer link is preferred when LinkedIn gives one", () => assert.equal(mapLinkedIn({ ...item, applyUrl: "https://careers.sodexo.com/job/123" })!.apply_url, "https://careers.sodexo.com/job/123"));
test("an unsafe apply link is ignored", () => assert.equal(mapLinkedIn({ ...item, applyUrl: "javascript:alert(1)" })!.apply_url, item.link));
test("description falls back to the HTML with tags removed", () => assert.equal(mapLinkedIn({ ...item, descriptionText: "" })!.description, "Sodexo is seeking an Operations Manager & leader"));
test("a listing with no title or link is dropped", () => {
  assert.equal(mapLinkedIn({ ...item, title: "" }), null);
  assert.equal(mapLinkedIn({ ...item, link: "" }), null);
  assert.equal(mapLinkedIn({ ...item, link: "http://insecure.example/job" }), null);
});
test("the id can come from the link when the scraper omits it", () => assert.equal(mapLinkedIn({ ...item, id: "" })!.external_id, "4467926441"));
test("remote is picked up from the location or title", () => assert.equal(mapLinkedIn({ ...item, location: "Remote" })!.remote_hint, true));
test("nothing else is trusted: coordinates are never taken from the scraper", () => assert.equal(mapLinkedIn({ ...item, latitude: 1, longitude: 2 } as never)!.latitude, null));

test("the spending limits are what we promised", () => {
  assert.equal(LIMITS.maxItems, 25);
  assert.ok(LIMITS.maxChargeUsd <= 0.25);
  assert.equal(LIMITS.perUserPerDay, 3);
  assert.equal(LIMITS.globalPerDay, 40);
  // Even every allowed run at its price ceiling stays inside a day's budget of ten dollars.
  assert.ok(LIMITS.globalPerDay * LIMITS.maxChargeUsd <= 10);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
