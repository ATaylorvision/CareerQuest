// Tests for which listings appear on the Matches page and in what order. No network.
// Run:  npm run test:matches
import assert from "node:assert/strict";
import { byShown, contextFor, dealbreakerPhrase, neverShown, splitMatches, whyExcluded, withinReach } from "../src/lib/matchRules";
import type { Job } from "../src/data/jobs";

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

const job = (over: Partial<Job> & { id: string }): Job =>
  ({
    title: "Operations Manager",
    company: { name: "Acme" },
    location: "Farmingdale, NY",
    mode: "Onsite",
    salary: [95000, 120000],
    postedDaysAgo: 4,
    gaps: [],
    legit: { score: 80, badge: "active", factors: [] },
    match: 80,
    summary: "Run the warehouse floor.",
    descriptionText: "Run the warehouse floor and manage a team.",
    distanceMiles: 8,
    live: true,
    ...over,
  }) as unknown as Job;

const state = (over: Record<string, unknown> = {}, apps: unknown[] = []) =>
  ({
    applications: apps,
    dismissedJobIds: [],
    legitThreshold: 40,
    profile: { location: "Farmingdale, NY" },
    prefs: { salaryFloor: 80000, maxDistanceMiles: 30, remote: "any", locations: ["Farmingdale, NY", "Remote (US)"], dealbreakers: ["Commission only pay", "Overnight shifts"], ...over },
  }) as never;

const ctx = (over: Record<string, unknown> = {}, apps: unknown[] = []) => contextFor(state(over, apps));

test("a good, close, fresh, well paid job is shown", () => assert.equal(whyExcluded(job({ id: "a" }), ctx()), null));

// applied
test("a job you applied to is no longer shown", () => assert.equal(whyExcluded(job({ id: "a" }), ctx({}, [{ jobId: "a", column: "applied", receipt: { submittedAt: "2026-01-01" } }])), "applied"));
test("a job moved along in the tracker is no longer shown", () => assert.equal(whyExcluded(job({ id: "a" }), ctx({}, [{ jobId: "a", column: "interview", receipt: null }])), "applied"));
test("a job you only saved is still shown", () => assert.equal(whyExcluded(job({ id: "a" }), ctx({}, [{ jobId: "a", column: "saved", receipt: null }])), null));
test("a job you marked not for me is not shown", () => assert.equal(whyExcluded(job({ id: "a" }), contextFor({ ...(state() as object), dismissedJobIds: ["a"] } as never)), "dismissed"));

// not real, and age
test("a listing that looks fake is left out without asking", () => assert.equal(whyExcluded(job({ id: "a", legit: { score: 20, badge: "ghost", factors: [] } }), ctx()), "not-real"));
test("a listing older than thirty days is left out", () => assert.equal(whyExcluded(job({ id: "a", postedDaysAgo: 45 }), ctx()), "old"));
test("a listing on day thirty is still fresh", () => assert.equal(whyExcluded(job({ id: "a", postedDaysAgo: 30 }), ctx()), null));

// where
test("a job outside your range is left out", () => assert.equal(whyExcluded(job({ id: "a", distanceMiles: 240, location: "Austin, TX" }), ctx()), "far"));
test("a job exactly at your range is kept", () => assert.equal(whyExcluded(job({ id: "a", distanceMiles: 30 }), ctx()), null));
test("with no distance, a job in a city you named is kept", () => assert.equal(whyExcluded(job({ id: "a", distanceMiles: null, location: "Farmingdale, NY" }), ctx()), null));
test("with no distance, a job in a different state's city of the same name is left out", () => assert.equal(whyExcluded(job({ id: "a", distanceMiles: null, location: "Farmingdale, NJ" }), ctx()), "far"));
test("with no distance, a job in some other city is left out", () => assert.equal(whyExcluded(job({ id: "a", distanceMiles: null, location: "Dallas, TX" }), ctx()), "far"));
test("a job that does not say where it is counts as onsite, so it needs to be near", () => assert.equal(whyExcluded(job({ id: "a", mode: "Not stated", distanceMiles: 400, location: "Location not listed" }), ctx()), "far"));
test("a remote job is kept when you are open to remote", () => assert.equal(whyExcluded(job({ id: "a", mode: "Remote", distanceMiles: null, location: "Remote" }), ctx()), null));
test("a remote job is left out when you only want to work near home", () => assert.equal(whyExcluded(job({ id: "a", mode: "Remote", distanceMiles: null }), ctx({ remote: "onsite", locations: ["Farmingdale, NY"] })), "remote"));
test("only remote means onsite jobs are left out even when close", () => assert.equal(whyExcluded(job({ id: "a" }), ctx({ remote: "remote" })), "remote"));
test("the widest setting turns distance off", () => assert.equal(whyExcluded(job({ id: "a", distanceMiles: 900 }), ctx({ maxDistanceMiles: 100 })), null));

// pay
test("pay below your floor is left out", () => assert.equal(whyExcluded(job({ id: "a", salary: [40000, 60000] }), ctx()), "pay"));
test("pay that reaches your floor is kept", () => assert.equal(whyExcluded(job({ id: "a", salary: [60000, 82000] }), ctx()), null));
test("a listing with no pay stated is kept", () => assert.equal(whyExcluded(job({ id: "a", salary: null }), ctx()), null));

// dealbreakers and requirements
test("a dealbreaker phrase drops its filler words", () => assert.equal(dealbreakerPhrase("Commission only pay"), "commission only"));
test("a listing that says commission only is left out", () => assert.equal(whyExcluded(job({ id: "a", descriptionText: "This is a commission only position." }), ctx()), "dealbreaker"));
test("a listing that merely mentions commission is kept", () => assert.equal(whyExcluded(job({ id: "a", descriptionText: "Base salary plus commission." }), ctx()), null));
test("an overnight shift job is left out", () => assert.equal(whyExcluded(job({ id: "a", descriptionText: "Overnight shifts required." }), ctx()), "dealbreaker"));
test("a requirement you cannot meet leaves a job out", () => assert.equal(whyExcluded(job({ id: "a", gaps: [{ severity: "dealbreaker" }] as never }), ctx()), "required"));
test("a trainable gap does not", () => assert.equal(whyExcluded(job({ id: "a", gaps: [{ severity: "trainable" }] as never }), ctx()), null));

// score
test("a weak match is held back", () => assert.equal(whyExcluded(job({ id: "a", match: 55 }), ctx()), "weak"));
test("a score of exactly sixty is shown", () => assert.equal(whyExcluded(job({ id: "a", match: 60 }), ctx()), null));

test("weak matches are kept aside so they can be shown on request", () => {
  const s = splitMatches([job({ id: "a" }), job({ id: "b", match: 40 }), job({ id: "c", distanceMiles: 500, location: "Reno, NV" })], ctx());
  assert.deepEqual(s.shown.map((j) => j.id), ["a"]);
  assert.deepEqual(s.weaker.map((j) => j.id), ["b"]);
  assert.equal(s.left.far, 1);
});
test("a job you added yourself never appears in matches", () => assert.equal(splitMatches([job({ id: "a", imported: true })], ctx()).shown.length, 0));

// once shown, always shown
test("a match already shown stays even if it is now too far, old, cheap and weak", () => assert.equal(whyExcluded(job({ id: "a", kept: true, distanceMiles: 900, location: "Reno, NV", postedDaysAgo: 80, salary: [10000, 20000], match: 20 }), ctx()), null));
test("a kept match still goes away once you apply to it", () => assert.equal(whyExcluded(job({ id: "a", kept: true }), ctx({}, [{ jobId: "a", column: "applied", receipt: { submittedAt: "2026-01-01" } }])), "applied"));
test("a kept match still goes away when you mark it not for me", () => assert.equal(whyExcluded(job({ id: "a", kept: true }), contextFor({ ...(state() as object), dismissedJobIds: ["a"] } as never)), "dismissed"));

// a short list is topped up, never left empty
test("with few good matches, the best fair ones fill the list", () => {
  const jobs = [job({ id: "a", match: 80 }), job({ id: "b", match: 58 }), job({ id: "c", match: 52 }), job({ id: "d", match: 47 }), job({ id: "e", match: 30 })];
  const s = splitMatches(jobs, ctx());
  assert.deepEqual(s.shown.map((j) => j.id), ["a", "b", "c", "d"]);
  assert.deepEqual(s.weaker.map((j) => j.id), ["e"]);
});
test("a score under the floor is never brought in to fill", () => assert.equal(splitMatches([job({ id: "a", match: 44 })], ctx()).shown.length, 0));

// the job board: everything we have, held to where you can work
const reach = (over: Record<string, unknown> = {}) => ({ miles: 30, includeRemote: true, places: ["Farmingdale, NY"], ...over });
test("the board keeps a job inside your distance", () => assert.equal(withinReach(job({ id: "a", distanceMiles: 12 }), reach()), "ok"));
test("the board leaves out a job beyond your distance", () => assert.equal(withinReach(job({ id: "a", distanceMiles: 240 }), reach()), "far"));
test("widening the distance lets it in", () => assert.equal(withinReach(job({ id: "a", distanceMiles: 240 }), reach({ miles: 300 })), "ok"));
test("any distance lets everything onsite in", () => assert.equal(withinReach(job({ id: "a", distanceMiles: 2400 }), reach({ miles: 100 })), "ok"));
test("a job that cannot be placed is held back, and counted", () => assert.equal(withinReach(job({ id: "a", distanceMiles: null, location: "Dallas, TX" }), reach()), "unplaced"));
test("a job that names your city is placed even without coordinates", () => assert.equal(withinReach(job({ id: "a", distanceMiles: null, location: "Farmingdale, NY" }), reach()), "ok"));
test("remote follows the remote switch", () => {
  assert.equal(withinReach(job({ id: "a", mode: "Remote", distanceMiles: null }), reach()), "ok");
  assert.equal(withinReach(job({ id: "a", mode: "Remote", distanceMiles: null }), reach({ includeRemote: false })), "remote");
});
test("the board never shows something you applied to, dismissed, or that looks fake", () => {
  const c = ctx({}, [{ jobId: "applied", column: "applied", receipt: { submittedAt: "2026-01-01" } }]);
  assert.equal(neverShown(job({ id: "applied" }), c), true);
  assert.equal(neverShown(job({ id: "x", legit: { score: 10, badge: "ghost", factors: [] } }), c), true);
  assert.equal(neverShown(job({ id: "y" }), c), false);
});
test("a job we did not call a match still reaches the board", () => assert.equal(neverShown(job({ id: "w", match: 20 }), ctx()), false));

// order
test("newest to you comes first, whatever the posting date", () => {
  const a = job({ id: "a", postedDaysAgo: 1, shownAt: "2026-09-01T00:00:00Z" });
  const b = job({ id: "b", postedDaysAgo: 25, shownAt: "2026-09-20T00:00:00Z" });
  assert.deepEqual([a, b].sort(byShown).map((j) => j.id), ["b", "a"]);
});
test("jobs shown at the same moment go best match first", () => {
  const t = "2026-09-20T00:00:00Z";
  const a = job({ id: "a", match: 70, shownAt: t });
  const b = job({ id: "b", match: 90, shownAt: t });
  assert.deepEqual([a, b].sort(byShown).map((j) => j.id), ["b", "a"]);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
