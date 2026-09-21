// Tests for the check that a payment message really came from Stripe. No network.
// Run:  npm run test:stripe
import { createHmac } from "node:crypto";
import assert from "node:assert/strict";
import { verifySignature } from "../api/stripe";

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

const SECRET = "whsec_test_secret";
const body = Buffer.from(JSON.stringify({ type: "checkout.session.completed", data: { object: { client_reference_id: "abc" } } }));
const now = 1_800_000_000_000;
const t = Math.floor(now / 1000);
const sign = (payload: Buffer, secret = SECRET, ts = t) => createHmac("sha256", secret).update(`${ts}.`).update(payload).digest("hex");

test("a properly signed message is accepted", () => assert.equal(verifySignature(body, `t=${t},v1=${sign(body)}`, SECRET, now), true));
test("a message signed with someone else's secret is refused", () => assert.equal(verifySignature(body, `t=${t},v1=${sign(body, "whsec_other")}`, SECRET, now), false));
test("a changed message is refused", () => assert.equal(verifySignature(Buffer.from(body.toString() + " "), `t=${t},v1=${sign(body)}`, SECRET, now), false));
test("an old message is refused, so a captured one cannot be replayed", () => assert.equal(verifySignature(body, `t=${t - 600},v1=${sign(body, SECRET, t - 600)}`, SECRET, now), false));
test("a missing signature is refused", () => assert.equal(verifySignature(body, "", SECRET, now), false));
test("a garbled header is refused", () => assert.equal(verifySignature(body, "nonsense", SECRET, now), false));
test("a signature of the wrong length is refused", () => assert.equal(verifySignature(body, `t=${t},v1=abcd`, SECRET, now), false));
test("when Stripe sends two signatures, either one may match", () => assert.equal(verifySignature(body, `t=${t},v1=${"0".repeat(64)},v1=${sign(body)}`, SECRET, now), true));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
