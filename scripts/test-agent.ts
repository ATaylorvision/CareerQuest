// Tests for the rules Wren's proposals must pass. No network.
// Run:  npm run test:agent
import assert from "node:assert/strict";
import { cleanSnapshot, validateOptions, validateProposals, type RawProposal } from "../api/_lib/agentGuard";

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

const snap = cleanSnapshot({
  summary: "Retail operations manager with seven years running high volume stores, known for inventory accuracy.",
  skills: ["Inventory control", "Team leadership", "Excel"],
  roles: [{ id: "role-1", title: "Store Manager", company: "Bayside", bullets: [{ id: "b1", text: "Cut shrink from 2.4% to 1.1% by redesigning receiving checks." }, { id: "b2", text: "Led a team of 28 associates across two shifts." }] }],
})!;
const rep = (field: string, after: string): RawProposal => ({ kind: "replace", field, role_id: "", after, why: "Matches the posting." });
const add = (role: string, after: string): RawProposal => ({ kind: "add", field: "", role_id: role, after, why: "You told me this." });
const v = (raw: RawProposal[], said = "make it stronger") => validateProposals(raw, snap, said);

test("a snapshot with nothing in it is refused", () => assert.equal(cleanSnapshot({ summary: "", roles: [] }), null));
test("garbage is not a snapshot", () => assert.equal(cleanSnapshot("hello"), null));
test("a real rewrite of a line is kept, with the old text attached", () => {
  const out = v([rep("b2", "Led 28 associates and supervisors across two shifts, keeping coverage on schedule.")]);
  assert.equal(out.length, 1);
  assert.equal(out[0].before, "Led a team of 28 associates across two shifts.");
});
test("a rewrite of a line that does not exist is dropped", () => assert.equal(v([rep("b99", "Led 28 associates across two shifts every week.")]).length, 0));
test("a number nobody gave is dropped", () => assert.equal(v([rep("b2", "Led a team of 45 associates across two shifts.")]).length, 0));
test("a number that only appears in the posting is dropped, since it would be a false claim", () => assert.equal(v([rep("b2", "Led 28 associates across two shifts, supervising 50 employees.")]).length, 0));
test("a change that changes nothing is dropped", () => assert.equal(v([rep("b2", "Led a team of 28 associates across two shifts.")]).length, 0));
test("a new skill from the posting is dropped", () => assert.equal(v([rep("skills", "Inventory control, Team leadership, Excel, WMS")]).length, 0));
test("a new skill the person just named is kept", () => assert.equal(v([rep("skills", "Inventory control, Team leadership, Excel, WMS")], "I have used WMS at my last job").length, 1));
test("reordering existing skills is kept", () => assert.equal(v([rep("skills", "Excel, Inventory control, Team leadership")]).length, 1));
test("the summary can be rewritten", () => assert.equal(v([rep("summary", "Operations manager with seven years running high volume stores and a record of inventory accuracy.")]).length, 1));
test("a summary that is a fragment is dropped", () => assert.equal(v([rep("summary", "Great manager")]).length, 0));
test("an added line must come from what the person said", () => {
  assert.equal(v([add("role-1", "Trained new hires on receiving procedures and safety.")], "make it stronger").length, 0);
  assert.equal(v([add("role-1", "Trained new hires on receiving procedures and safety.")], "I trained new hires on receiving procedures").length, 1);
});
test("an added line cannot go under a role that does not exist", () => assert.equal(v([add("role-9", "Trained new hires on receiving procedures.")], "I trained new hires on receiving procedures").length, 0));
test("an added line with an invented number is dropped", () => assert.equal(v([add("role-1", "Trained 12 new hires on receiving procedures.")], "I trained new hires on receiving procedures").length, 0));
test("two proposals for one line keep only the first", () => assert.equal(v([rep("b2", "Led 28 associates and supervisors across two shifts every week."), rep("b2", "Managed 28 associates across two shifts every single week.")]).length, 1));
test("no more than six come back", () => {
  const many = Array.from({ length: 10 }, (_, i) => add("role-1", `Trained new hires on receiving procedures, batch number ${i}.`));
  assert.ok(v(many, "I trained new hires on receiving procedures").length <= 6);
});
test("stretching the scope of a line is dropped", () => {
  assert.equal(v([rep("b1", "Cut shrink from 2.4% to 1.1% by redesigning receiving checks across the store.")]).length, 0);
  assert.equal(v([rep("b1", "Cut shrink from 2.4% to 1.1% with company-wide receiving checks.")]).length, 0);
  assert.equal(v([rep("b1", "Drove strategic shrink reduction from 2.4% to 1.1% through receiving checks.")]).length, 0);
});
test("a scope word the resume already uses may stay", () => {
  const s2 = cleanSnapshot({ summary: "Ran operations across the store for seven years with strong results.", skills: [], roles: [{ id: "role-1", title: "Manager", company: "Bayside", bullets: [{ id: "b1", text: "Led inventory counts across the store every week." }] }] })!;
  const out = validateProposals([rep("b1", "Led weekly inventory counts across the store with steady accuracy.")], s2, "make it stronger");
  assert.equal(out.length, 1);
});
test("a scope word the person just used may be used", () => assert.equal(v([rep("b2", "Led 28 associates across two shifts company-wide.")], "I did this company-wide").length, 1));
test("a new tool or employer name is dropped", () => {
  assert.equal(v([rep("b2", "Led 28 associates across two shifts using Kronos scheduling.")]).length, 0);
  assert.equal(v([rep("b2", "Led 28 associates across two shifts using Kronos scheduling.")], "I used Kronos").length, 1);
});
test("a capital letter at the start of a sentence is not a new name", () => assert.equal(v([rep("summary", "Operations manager with seven years running high volume stores. Known for inventory accuracy and process fixes.")]).length, 1));
test("options that stretch the scope of the notes are dropped", () => assert.equal(validateOptions(["Trained new hires on receiving across the entire company."], "I trained new hires on receiving").length, 0));
test("options must build on the person's own notes", () => {
  const notes = "I trained new hires on receiving and safety";
  const out = validateOptions(["Trained new hires on receiving and safety procedures.", "Won an industry award for excellence in logistics.", "Coached new hires through receiving and safety checks."], notes);
  assert.equal(out.length, 2);
});
test("options with an invented number are dropped", () => assert.equal(validateOptions(["Trained 40 new hires on receiving and safety."], "I trained new hires on receiving").length, 0));
test("a result borrowed from another line of the resume is dropped", () => assert.equal(validateOptions(["Trained new hires on receiving, cutting shrink from 2.4% to 1.1%."], "I trained new hires on receiving").length, 0));
test("duplicate options collapse", () => assert.equal(validateOptions(["Trained new hires on receiving.", "Trained new hires on receiving."], "trained new hires on receiving").length, 1));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
