import { createHmac, timingSafeEqual } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { admin, HttpError, requireUser } from "./_lib/http.js";

/**
 * Two jobs in one function (Vercel's free plan caps how many we can have):
 *
 *  1. Stripe calls this after a payment or a change to a subscription. It is the
 *     ONLY thing that can turn on Pro or an add on. It is trusted because the
 *     request carries a signature only Stripe can make, never because of anything
 *     the browser says.
 *  2. A signed in person asks for a link to Stripe's own page for managing their
 *     card and cancelling.
 */
export const config = { api: { bodyParser: false } };

/** The end of each payment link's address. Stripe reports which link was used, and this says what it was for. */
const PRO_LINK = "aFadR25lt16O0Fq1eF38401";
const CONNECTIONS_LINK = "5kQ28kdRZ4j0dscaPf38400";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ENDED = new Set(["canceled", "unpaid", "incomplete_expired"]);

async function rawBody(req: VercelRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(typeof c === "string" ? Buffer.from(c) : (c as Buffer));
  return Buffer.concat(chunks);
}

/** Stripe signs `timestamp.body` with our webhook secret. Anything else is refused. */
export function verifySignature(payload: Buffer, header: string, secret: string, now = Date.now()): boolean {
  const parts = Object.fromEntries(header.split(",").map((p) => p.trim().split("=") as [string, string]));
  const t = Number(parts.t);
  const sigs = header
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p.startsWith("v1="))
    .map((p) => p.slice(3));
  if (!t || sigs.length === 0) return false;
  if (Math.abs(now / 1000 - t) > 300) return false; // a captured request cannot be replayed later
  const expected = createHmac("sha256", secret).update(`${t}.`).update(payload).digest("hex");
  return sigs.some((s) => s.length === expected.length && timingSafeEqual(Buffer.from(s), Buffer.from(expected)));
}

async function stripe<T = Record<string, unknown>>(path: string, init: { method?: string; form?: Record<string, string> } = {}): Promise<T> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new HttpError(500, "Payments are not set up yet.");
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: init.method ?? "GET",
    headers: { Authorization: `Bearer ${key}`, ...(init.form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
    body: init.form ? new URLSearchParams(init.form).toString() : undefined,
  });
  const json = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok) {
    console.error("[stripe]", path, json.error?.message);
    throw new HttpError(502, "Our payment provider did not answer. Please try again.");
  }
  return json;
}

const iso = (s?: number | null) => (s ? new Date(s * 1000).toISOString() : null);

interface Sub {
  id: string;
  customer: string;
  status: string;
  cancel_at_period_end?: boolean;
  current_period_end?: number;
  trial_end?: number | null;
  items?: { data?: { current_period_end?: number; price?: { recurring?: { interval?: string } } }[] };
}

function periodFields(sub: Sub) {
  const item = sub.items?.data?.[0];
  return {
    subscription_status: sub.status,
    current_period_end: iso(sub.current_period_end ?? item?.current_period_end),
    cancel_at_period_end: !!sub.cancel_at_period_end,
    billing_cycle: item?.price?.recurring?.interval === "year" ? "yearly" : "monthly",
  };
}

interface Session {
  id: string;
  mode?: string;
  payment_status?: string;
  client_reference_id?: string | null;
  customer?: string | null;
  subscription?: string | null;
  payment_link?: string | null;
}

const linkCache = new Map<string, string>();
async function whichProduct(paymentLinkId: string | null | undefined): Promise<"pro" | "connections" | null> {
  if (!paymentLinkId) return null;
  let url = linkCache.get(paymentLinkId);
  if (!url) {
    url = ((await stripe<{ url?: string }>(`payment_links/${encodeURIComponent(paymentLinkId)}`)).url ?? "").toString();
    linkCache.set(paymentLinkId, url);
  }
  if (url.endsWith(PRO_LINK)) return "pro";
  if (url.endsWith(CONNECTIONS_LINK)) return "connections";
  return null;
}

async function onCheckoutCompleted(s: Session) {
  const db = admin();
  const uid = s.client_reference_id ?? "";
  if (!UUID.test(uid)) {
    console.error("[stripe] payment with no account attached", s.id);
    return;
  }
  // A payment that has not actually cleared does not unlock anything yet.
  if (s.payment_status !== "paid" && s.payment_status !== "no_payment_required") return;
  const product = await whichProduct(s.payment_link);
  if (!product) {
    console.error("[stripe] payment for a link we do not recognise", s.id);
    return;
  }
  const { data: profile } = await db.from("profiles").select("id, add_ons").eq("id", uid).maybeSingle();
  if (!profile) {
    console.error("[stripe] payment for an account that does not exist", uid);
    return;
  }
  const sub = s.subscription ? await stripe<Sub>(`subscriptions/${encodeURIComponent(s.subscription)}`) : null;
  const now = new Date().toISOString();

  if (product === "pro") {
    const { error } = await db
      .from("profiles")
      .update({ plan_tier: "pro", stripe_customer_id: s.customer ?? null, stripe_subscription_id: s.subscription ?? null, ...(sub ? periodFields(sub) : {}), updated_at: now })
      .eq("id", uid);
    if (error) throw new HttpError(500, "Could not record the payment.");
  } else {
    const add_ons = { ...((profile.add_ons as Record<string, unknown>) ?? {}), connections: true, connections_sub: s.subscription ?? null };
    const { error } = await db.from("profiles").update({ add_ons, stripe_customer_id: s.customer ?? null, updated_at: now }).eq("id", uid);
    if (error) throw new HttpError(500, "Could not record the payment.");
  }
}

async function onSubscriptionChanged(sub: Sub) {
  const db = admin();
  const ended = ENDED.has(sub.status) || sub.status === "canceled";

  const { data: proOwner } = await db.from("profiles").select("id").eq("stripe_subscription_id", sub.id).maybeSingle();
  if (proOwner) {
    await db
      .from("profiles")
      .update({ ...periodFields(sub), ...(ended ? { plan_tier: "free", cancel_at_period_end: false } : { plan_tier: "pro" }), updated_at: new Date().toISOString() })
      .eq("id", proOwner.id);
    return;
  }
  const { data: addOnOwner } = await db.from("profiles").select("id, add_ons").eq("add_ons->>connections_sub", sub.id).maybeSingle();
  if (addOnOwner) {
    const add_ons = { ...((addOnOwner.add_ons as Record<string, unknown>) ?? {}), connections: !ended };
    await db.from("profiles").update({ add_ons, updated_at: new Date().toISOString() }).eq("id", addOnOwner.id);
  }
}

async function webhook(req: VercelRequest, res: VercelResponse) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new HttpError(500, "Payments are not set up yet.");
  const payload = await rawBody(req);
  if (!verifySignature(payload, String(req.headers["stripe-signature"] ?? ""), secret)) throw new HttpError(400, "Bad signature.");

  const event = JSON.parse(payload.toString("utf8")) as { type: string; data: { object: unknown } };
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      await onCheckoutCompleted(event.data.object as Session);
      break;
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await onSubscriptionChanged(event.data.object as Sub);
      break;
    default:
      break; // everything else is not ours to act on
  }
  res.status(200).json({ received: true });
}

/** A link to Stripe's page for this person's card, invoices and cancellation. */
async function portal(req: VercelRequest, res: VercelResponse) {
  const user = await requireUser(req);
  const { data: profile } = await admin().from("profiles").select("stripe_customer_id").eq("id", user.id).maybeSingle();
  if (!profile?.stripe_customer_id) throw new HttpError(400, "There is no subscription on this account yet.");
  const origin = String(req.headers.origin ?? "");
  const returnTo = /^https:\/\/[a-z0-9.-]+$/i.test(origin) ? origin : "https://careerquest-app-nine.vercel.app";
  const session = await stripe<{ url: string }>("billing_portal/sessions", {
    method: "POST",
    form: { customer: profile.stripe_customer_id as string, return_url: `${returnTo}/#/app/billing` },
  });
  res.status(200).json({ url: session.url });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") throw new HttpError(405, "Use POST.");
    if (req.headers["stripe-signature"]) return await webhook(req, res);
    return await portal(req, res);
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    if (!(e instanceof HttpError)) console.error("[stripe error]", e);
    // Stripe retries anything that is not a 2xx, which is what we want for a real failure.
    res.status(status).json({ error: e instanceof HttpError ? e.message : "Something went wrong on our side." });
  }
}
