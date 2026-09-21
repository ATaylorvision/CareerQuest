// Tests for the Tracker's numbers. No network, no database.
// Run:  npm run test:tracker
import assert from "node:assert/strict";
import { applicationFromImport, normalizeApplications, stageReached, trackerStats } from "../src/lib/tracker";
import type { Application, Column, EventType } from "../src/data/applications";

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

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 8, 21, 12);
const iso = (daysAgo: number) => new Date(NOW - daysAgo * DAY).toISOString();

interface Opts {
  /** Days ago it was sent. Leave out for something never sent. */
  sent?: number;
  events?: [EventType, number, boolean?][];
}

let n = 0;
const app = (column: Column, o: Opts = {}): Application => {
  const id = `a${++n}`;
  return {
    id,
    jobId: `j${n}`,
    column,
    savedAt: iso(40),
    events: [
      { id: `${id}-0`, type: "saved", at: iso(40) },
      ...(o.events ?? []).map(([type, d, future], i) => ({ id: `${id}-${i + 1}`, type, at: iso(d), future: !!future })),
    ],
    receipt:
      o.sent !== undefined
        ? { method: "manual", destination: "company", destinationLabel: "Applied outside CareerQuest", submittedAt: iso(o.sent), resumeVersionId: "", coverLetter: "", fields: [], confirmation: { verified: false } }
        : undefined,
  };
};

console.log("\n[1] Counting");
test("an empty board is all zeros and has no rates to show", () => {
  const s = trackerStats([], NOW);
  assert.equal(s.total, 0);
  assert.equal(s.applied, 0);
  assert.equal(s.answerRate, null);
  assert.equal(s.interviewRate, null);
  assert.deepEqual(s.funnel.map((f) => f.n), [0, 0, 0, 0]);
});
test("a saved job is not an application", () => {
  const s = trackerStats([app("saved")], NOW);
  assert.equal(s.saved, 1);
  assert.equal(s.applied, 0);
});
test("something sent and not answered is waiting", () => {
  const s = trackerStats([app("applied", { sent: 5 })], NOW);
  assert.deepEqual([s.applied, s.waiting, s.answered, s.inPlay], [1, 1, 0, 1]);
});
test("a card marked applied with no receipt still counts as sent", () => {
  assert.equal(trackerStats([app("applied")], NOW).applied, 1);
});
test("withdrawing something that was never sent does not make it an application", () => {
  const s = trackerStats([app("withdrawn")], NOW);
  assert.equal(s.applied, 0);
  assert.equal(s.withdrawn, 1);
});
test("a rejection is an answer", () => {
  const s = trackerStats([app("rejected", { sent: 20, events: [["rejected", 3]] })], NOW);
  assert.deepEqual([s.applied, s.answered, s.rejected, s.interviews], [1, 1, 1, 0]);
});
test("silence is not an answer", () => {
  const s = trackerStats([app("withdrawn", { sent: 40, events: [["noresponse", 10]] })], NOW);
  assert.equal(s.applied, 1);
  assert.equal(s.answered, 0);
});
test("a rejection after an interview still counts as an interview", () => {
  const a = app("rejected", { sent: 30, events: [["screen", 20], ["interview", 10], ["rejected", 2]] });
  assert.equal(stageReached(a), 3);
  const s = trackerStats([a], NOW);
  assert.deepEqual([s.answered, s.interviews, s.rejected], [1, 1, 1]);
});
test("an interview that is only planned has not happened yet", () => {
  const a = app("screening", { sent: 10, events: [["screen", 6], ["interview", -3, true]] });
  const s = trackerStats([a], NOW);
  assert.equal(s.interviews, 0);
  assert.equal(s.answered, 1);
});
test("an offer counts as an interview reached, so the funnel never grows", () => {
  const s = trackerStats([app("offer", { sent: 30, events: [["offer", 1]] })], NOW);
  assert.deepEqual(s.funnel.map((f) => f.n), [1, 1, 1, 1]);
});
test("rejected and withdrawn are not in play", () => {
  const s = trackerStats([app("applied", { sent: 3 }), app("rejected", { sent: 9, events: [["rejected", 2]] }), app("withdrawn", { sent: 9 })], NOW);
  assert.equal(s.inPlay, 1);
});

console.log("\n[2] Rates");
test("the answer rate is answers over applications sent", () => {
  const apps = [
    app("applied", { sent: 4 }),
    app("applied", { sent: 4 }),
    app("screening", { sent: 9, events: [["screen", 2]] }),
    app("rejected", { sent: 12, events: [["rejected", 1]] }),
  ];
  const s = trackerStats(apps, NOW);
  assert.equal(s.applied, 4);
  assert.equal(s.answered, 2);
  assert.equal(s.answerRate, 50);
});
test("saved jobs do not drag the rate down", () => {
  const s = trackerStats([app("saved"), app("saved"), app("screening", { sent: 5, events: [["screen", 2]] })], NOW);
  assert.equal(s.answerRate, 100);
});
test("the funnel shows each step as a share of the one before", () => {
  const apps = [
    app("applied", { sent: 4 }),
    app("screening", { sent: 9, events: [["screen", 2]] }),
    app("interview", { sent: 20, events: [["screen", 10], ["interview", 3]] }),
    app("offer", { sent: 30, events: [["interview", 10], ["offer", 1]] }),
  ];
  const f = trackerStats(apps, NOW).funnel;
  assert.deepEqual(f.map((x) => x.n), [4, 3, 2, 1]);
  assert.deepEqual(f.map((x) => x.ofPrevious), [null, 75, 67, 50]);
});
test("no funnel step ever exceeds the one before it", () => {
  // Random boards, to make sure no combination breaks the arithmetic.
  const cols: Column[] = ["saved", "applied", "screening", "interview", "offer", "rejected", "withdrawn"];
  const evs: EventType[] = ["screen", "interview", "offer", "rejected", "noresponse", "viewed", "review"];
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let round = 0; round < 60; round++) {
    const apps = Array.from({ length: 1 + Math.floor(rnd() * 25) }, () =>
      app(cols[Math.floor(rnd() * cols.length)], {
        sent: rnd() < 0.7 ? Math.floor(rnd() * 60) : undefined,
        events: Array.from({ length: Math.floor(rnd() * 4) }, () => [evs[Math.floor(rnd() * evs.length)], Math.floor(rnd() * 40), rnd() < 0.15] as [EventType, number, boolean]),
      }),
    );
    const f = trackerStats(apps, NOW).funnel;
    for (let i = 1; i < f.length; i++) assert.ok(f[i].n <= f[i - 1].n, `round ${round}: ${f.map((x) => x.n).join(" > ")}`);
    const s = trackerStats(apps, NOW);
    assert.ok(s.answerRate === null || (s.answerRate >= 0 && s.answerRate <= 100));
    assert.ok(s.inPlay <= s.applied);
  }
});

console.log("\n[3] Nudges");
test("something waiting two weeks or more is flagged, oldest first", () => {
  const apps = [app("applied", { sent: 15 }), app("applied", { sent: 30 }), app("applied", { sent: 3 })];
  const nudges = trackerStats(apps, NOW).nudges;
  assert.deepEqual(nudges.map((x) => x.days), [30, 15]);
});
test("thirteen days is not yet a nudge", () => {
  assert.equal(trackerStats([app("applied", { sent: 13 })], NOW).nudges.length, 0);
});
test("only applications still waiting are flagged", () => {
  const apps = [app("interview", { sent: 40, events: [["interview", 5]] }), app("rejected", { sent: 40, events: [["rejected", 5]] }), app("saved")];
  assert.equal(trackerStats(apps, NOW).nudges.length, 0);
});

console.log("\n[4] Older saved boards");
test("an old closed card with a rejection becomes rejected", () => {
  const old = { ...app("applied", { sent: 20, events: [["rejected", 3]] }), column: "closed" } as unknown as Application;
  assert.equal(normalizeApplications([old])[0].column, "rejected");
});
test("an old closed card without one becomes withdrawn", () => {
  const old = { ...app("applied", { sent: 40, events: [["noresponse", 10]] }), column: "closed" } as unknown as Application;
  assert.equal(normalizeApplications([old])[0].column, "withdrawn");
});
test("a planned rejection does not decide it", () => {
  const old = { ...app("applied", { sent: 40, events: [["rejected", -2, true]] }), column: "closed" } as unknown as Application;
  assert.equal(normalizeApplications([old])[0].column, "withdrawn");
});
test("cards already in the new columns are left alone", () => {
  const a = app("interview", { sent: 9 });
  assert.equal(normalizeApplications([a])[0], a);
});

console.log("\n[5] Adding a job you have already acted on");
const APPLIED_ON = new Date(NOW - 9 * DAY);
const imp = (stage: Column) => applicationFromImport({ id: "x1", jobId: "mine:1", stage, appliedOn: APPLIED_ON, now: new Date(NOW) });
test("just saving it makes a saved card and nothing more", () => {
  const a = imp("saved");
  assert.equal(a.column, "saved");
  assert.equal(a.receipt, undefined);
  assert.equal(a.events.length, 1);
  assert.equal(trackerStats([a], NOW).applied, 0);
});
test("having applied records the date they gave, not today", () => {
  const a = imp("applied");
  assert.equal(a.receipt?.submittedAt, APPLIED_ON.toISOString());
  assert.equal(stageReached(a), 1);
  assert.equal(trackerStats([a], NOW).waiting, 1);
});
test("an application added weeks ago is nudged like any other", () => {
  const a = applicationFromImport({ id: "x2", jobId: "mine:2", stage: "applied", appliedOn: new Date(NOW - 20 * DAY), now: new Date(NOW) });
  assert.equal(trackerStats([a], NOW).nudges[0]?.days, 20);
});
test("it is never marked verified, and holds no resume or letter of ours", () => {
  for (const stage of ["applied", "screening", "interview", "offer", "rejected", "withdrawn"] as Column[]) {
    const r = imp(stage).receipt!;
    assert.equal(r.confirmation.verified, false, stage);
    assert.equal(r.method, "manual", stage);
    assert.equal(r.resumeVersionId, "", stage);
    assert.equal(r.coverLetter, "", stage);
  }
});
test("each stage lands where the person said", () => {
  const reached: Record<string, number> = { applied: 1, screening: 2, interview: 3, offer: 4, rejected: 2 };
  for (const [stage, want] of Object.entries(reached)) assert.equal(stageReached(imp(stage as Column)), want, stage);
});
test("a rejection they report counts as a rejection and an answer", () => {
  const s = trackerStats([imp("rejected")], NOW);
  assert.deepEqual([s.rejected, s.answered, s.applied], [1, 1, 1]);
});
test("a withdrawal is not treated as an answer", () => {
  const s = trackerStats([imp("withdrawn")], NOW);
  assert.deepEqual([s.withdrawn, s.answered, s.applied], [1, 0, 1]);
});
test("the timeline says it was told to us", () => {
  const notes = imp("interview").events.map((e) => e.note ?? "").join(" ");
  assert.ok(/You told us|Added by you/.test(notes), notes);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
