// Tests for matching what someone says they can do to what a posting asks for. No network.
// Run:  npm run test:claims
import assert from "node:assert/strict";
import { claimForRequirement, claimMatches, keyWords, relevantClaims, type SkillClaim } from "../src/lib/skillClaims";
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

const claim = (label: string, gapId = "custom-x"): SkillClaim => ({ gapId, label, level: "some", roleId: "role-1", where: "", detail: "built decks", extra: "", line: "Built the monthly slide deck", at: "2026-01-01" });
const job = (over: Partial<Job>): Job => ({ title: "Customer Success Manager", summary: "", descriptionText: "", gaps: [], reqChecks: [], keywords: null, ...over }) as unknown as Job;

test("key words drop the filler", () => assert.deepEqual(keyWords("Experience with PowerPoint deck creation"), ["powerpoint", "deck"]));
test("a claim answers a requirement that names its skill", () => assert.equal(claimMatches(claim("PowerPoint deck creation"), "Experience creating PowerPoint decks for executives"), true));
test("it does not answer one about something else", () => assert.equal(claimMatches(claim("PowerPoint deck creation"), "Advanced SQL and reporting"), false));
test("a one word skill needs that word", () => {
  assert.equal(claimMatches(claim("Salesforce"), "Salesforce administration experience"), true);
  assert.equal(claimMatches(claim("Salesforce"), "CRM experience"), false);
});
test("a requirement finds the claim that covers it", () => assert.equal(claimForRequirement({ a: claim("Forecasting") }, "Strong forecasting skills")?.label, "Forecasting"));
test("with no claims nothing is covered", () => assert.equal(claimForRequirement(undefined, "Anything at all"), undefined));
test("a job that lists the gap is relevant", () => assert.equal(relevantClaims(job({ gaps: [{ id: "wms" }] as never }), { wms: claim("Warehouse systems", "wms") }).length, 1));
test("a job whose posting talks about the skill is relevant", () => assert.equal(relevantClaims(job({ descriptionText: "You will build PowerPoint decks for our customers." }), { p: claim("PowerPoint deck creation") }).length, 1));
test("an unrelated job is not", () => assert.equal(relevantClaims(job({ descriptionText: "Drive a forklift." }), { p: claim("PowerPoint deck creation") }).length, 0));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
