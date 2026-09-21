import { toast } from "sonner";
import { api } from "./api";

/** Stripe's own payment pages. The address is public; what turns something on is Stripe telling our server the payment cleared. */
const LINKS = {
  pro: "https://buy.stripe.com/test_aFadR25lt16O0Fq1eF38401",
  connections: "https://buy.stripe.com/test_5kQ28kdRZ4j0dscaPf38400",
} as const;

/** Sends the person to Stripe to pay. Their account id rides along so we know who paid. */
export function openCheckout(product: keyof typeof LINKS, user: { id: string; email?: string | null }) {
  const url = new URL(LINKS[product]);
  url.searchParams.set("client_reference_id", user.id);
  if (user.email) url.searchParams.set("prefilled_email", user.email);
  window.location.assign(url.toString());
}

/** Stripe's page for cards, invoices and cancelling. */
export async function openPortal() {
  try {
    const { url } = await api<{ url: string }>("stripe", {});
    window.location.assign(url);
  } catch (e) {
    toast.error("We could not open your billing page", { description: e instanceof Error ? e.message : "Please try again." });
  }
}
