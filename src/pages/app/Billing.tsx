import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { CalendarClock, CreditCard, Receipt, RotateCcw, XCircle, Zap } from "lucide-react";
import { Card, PageHeader, ScoreBar, SectionTitle } from "@/components/common";
import { Pill, SampleTag } from "@/components/status";
import { PricingTiers } from "@/components/PricingTiers";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useStore } from "@/store/AppStore";
import { FREE_LIMITS, isPro } from "@/lib/selectors";
import { daysFromNow, diffDays, fmtLongDate } from "@/lib/date";
import { useDocTitle } from "@/hooks/useDocTitle";
import { useLive } from "@/live/LiveProvider";
import { openCheckout, openPortal } from "@/live/billing";

export default function Billing() {
  useDocTitle("Account and billing");
  const { state, update } = useStore();
  const b = state.billing;
  const pro = isPro(state);
  const live = state.mode === "live";
  const [confirmCancel, setConfirmCancel] = useState(false);
  const { user } = useLive();
  const [params] = useSearchParams();
  const justPaid = params.get("paid") === "1";
  useEffect(() => {
    if (justPaid && !pro) {
      // The payment provider tells our server a moment after the person comes back, so look again shortly.
      const t = window.setTimeout(() => window.location.reload(), 4000);
      return () => window.clearTimeout(t);
    }
  }, [justPaid, pro]);
  const price = b.cycle === "yearly" ? "$180" : "$24";
  const monthApps = state.applications.filter((a) => a.receipt?.submittedAt && diffDays(a.receipt.submittedAt) <= 30).length;
  const oneClick = state.applications.filter((a) => a.receipt?.method === "submitted" && a.receipt.submittedAt && diffDays(a.receipt.submittedAt) <= 30).length;

  const startTrial = (cycle: "monthly" | "yearly") => {
    // Real accounts pay on Stripe. What follows is the demo only.
    if (live && user) return openCheckout("pro", user);
    update((s) => {
      s.billing = { ...s.billing, tier: "trial", cycle, trialStartedAt: new Date().toISOString(), trialEndsAt: daysFromNow(7), renewsAt: daysFromNow(7), cancelledAt: null };
    });
    toast.success("Your 7 day Pro trial has started", { description: `It ends on ${fmtLongDate(daysFromNow(7))}. No charge before then.` });
  };

  const cancel = () => {
    if (live) return void openPortal();
    if (b.tier === "trial") {
      update((s) => {
        s.billing = { ...s.billing, tier: "free", cycle: s.billing.cycle, trialStartedAt: null, trialEndsAt: null, renewsAt: null, cancelledAt: new Date().toISOString() };
      });
      toast.success("Trial cancelled", { description: "You will not be charged. You are on the Free plan now, and nothing was deleted." });
    } else {
      update((s) => void (s.billing.cancelledAt = new Date().toISOString()));
      toast.success("Pro cancelled", { description: `You keep Pro until ${fmtLongDate(b.renewsAt!)}. No further charges.` });
    }
  };

  const switchCycle = () => {
    if (live) return void openPortal();
    const next = b.cycle === "monthly" ? "yearly" : "monthly";
    update((s) => void (s.billing.cycle = next));
    toast.success(next === "yearly" ? "Switched to yearly, $180" : "Switched to monthly, $24", { description: `The change applies on ${fmtLongDate(b.renewsAt ?? daysFromNow(7))}.` });
  };

  const usage = [
    { label: "Tailored resumes", used: state.usage.tailoredResumes, limit: pro ? null : FREE_LIMITS.tailoredResumes },
    { label: "Cover letters", used: state.usage.coverLetters, limit: pro ? null : FREE_LIMITS.coverLetters },
    { label: "Copilot messages", used: state.usage.copilotMessages, limit: null },
    { label: "Applications sent", used: monthApps, limit: null },
    { label: "One click submits", used: oneClick, limit: pro ? null : 0 },
  ];

  return (
    <div>
      <PageHeader title="Account and billing" sub="What you pay, when you pay it, and how to stop. All on one screen." />

      {live && justPaid && (
        <div role="status" className="mb-6 rounded-lg border border-success/40 bg-success-soft p-3.5 text-sm">
          {pro ? "Thank you. Your plan is active." : "Thank you. Your payment went through, and your plan is switching on. This page refreshes on its own in a moment."}
        </div>
      )}

      <Card className="mb-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-2xl font-semibold">{b.tier === "free" ? "Free plan" : b.tier === "trial" ? "CareerQuest Pro, free trial" : "CareerQuest Pro"}</h2>
              {b.tier === "trial" && <Pill tone="primary">Trial</Pill>}
              {b.tier === "pro" && !b.cancelledAt && <Pill tone="success">Active</Pill>}
              {b.cancelledAt && b.tier === "pro" && <Pill tone="warning">Cancelled, ends {fmtLongDate(b.renewsAt!)}</Pill>}
            </div>
            <div className="mt-3 space-y-1.5 text-[15px]">
              {b.tier === "trial" && b.trialEndsAt && (
                <>
                  <p className="flex items-start gap-2">
                    <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>
                      Your free trial ends on <b>{fmtLongDate(b.trialEndsAt)}</b>, in {-diffDays(b.trialEndsAt)} days.
                    </span>
                  </p>
                  <p className="pl-6 text-muted-foreground">
                    Next charge: <b className="text-foreground">{price}</b> on {fmtLongDate(b.trialEndsAt)}, to the card below, unless you cancel before then. We will email you two days before.
                  </p>
                </>
              )}
              {b.tier === "pro" && !b.cancelledAt && (
                <p className="text-muted-foreground">
                  Next charge: <b className="text-foreground">{price}</b> on {fmtLongDate(b.renewsAt!)}.
                </p>
              )}
              {b.tier === "free" && <p className="text-muted-foreground">You pay nothing. Free includes unlimited matching, receipts, Career Translator, Copilot, and 3 tailored resumes and cover letters each month.</p>}
            </div>
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto lg:flex-col">
            {b.tier === "free" ? (
              <Button size="lg" onClick={() => startTrial("monthly")}>
                <Zap /> {live ? "Upgrade to Pro" : "Start 7 day free trial"}
              </Button>
            ) : (
              <>
                {!b.cancelledAt && (
                  <Button size="lg" variant="outline" onClick={switchCycle}>
                    {live ? "Change plan or card" : b.cycle === "monthly" ? "Switch to yearly, $180" : "Switch to monthly, $24"}
                  </Button>
                )}
                {!b.cancelledAt ? (
                  <Button size="lg" variant="outline" onClick={() => setConfirmCancel(true)} className="border-danger-border text-danger hover:bg-danger-soft hover:text-danger">
                    <XCircle /> Cancel {b.tier === "trial" ? "trial" : "plan"}
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    onClick={() => {
                      if (live) return void openPortal();
                      update((s) => void (s.billing.cancelledAt = null));
                      toast.success("Welcome back. Pro will renew as normal.");
                    }}
                  >
                    <RotateCcw /> Undo cancellation
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
        <p className="mt-5 border-t pt-4 text-sm text-muted-foreground">Cancel in one click, no phone call, no email. If you cancel, nothing is deleted. Your tracker, receipts, and resumes stay.</p>
      </Card>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <SectionTitle sub={`Resets on ${new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toLocaleDateString("en-US", { month: "long", day: "numeric" })}.`}>Usage this month</SectionTitle>
          <ul className="space-y-4">
            {usage.map((u) => (
              <li key={u.label}>
                <div className="mb-1.5 flex justify-between text-sm">
                  <span>{u.label}</span>
                  <span className="num text-muted-foreground">
                    <b className="text-foreground">{u.used}</b> {u.limit === null ? "· unlimited" : u.limit === 0 ? "· Pro only" : `of ${u.limit}`}
                  </span>
                </div>
                <ScoreBar value={u.limit ? Math.min(u.used, u.limit) : Math.min(u.used, 50)} max={u.limit || 50} height={6} tone={u.limit && u.used >= u.limit ? "danger" : "primary"} label={u.label} />
              </li>
            ))}
          </ul>
        </Card>

        <div className="space-y-6">
          <Card>
            <SectionTitle icon={CreditCard} right={live ? undefined : <SampleTag>Sample card</SampleTag>}>Payment method</SectionTitle>
            {live ? (
              <div className="rounded-lg border border-dashed p-4 text-sm">
                <div className="font-medium">{pro ? "Your card is kept by Stripe" : "No card on file"}</div>
                <p className="mt-1 text-muted-foreground">{pro ? "We never see or store your card number. Update it, download invoices or cancel on Stripe's page." : "You pay on Stripe's secure page when you upgrade. We never see or store your card number."}</p>
                {pro && (
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => void openPortal()}>
                    Manage billing
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-4 rounded-lg border p-4">
                <div className="flex h-10 w-14 items-center justify-center rounded-md bg-gradient-to-br from-primary to-primary/70 text-xs font-bold text-primary-foreground">VISA</div>
                <div className="flex-1 text-sm">
                  <div className="font-medium">Visa ending 4242</div>
                  <div className="text-muted-foreground">Expires 08/28</div>
                </div>
                <Button variant="outline" size="sm" onClick={() => toast("Update payment method", { description: "In the real product this opens a secure payment form from our payment provider. CareerQuest never sees your full card number." })}>
                  Update
                </Button>
              </div>
            )}
          </Card>
          <Card>
            <SectionTitle icon={Receipt}>Billing history</SectionTitle>
            {live ? (
              <div className="text-sm">
                <p className="text-muted-foreground">{pro ? "Every invoice and receipt is on Stripe's billing page, where you can also ask for a refund." : "Nothing has been charged. Once you upgrade, your invoices and receipts appear on Stripe's billing page."}</p>
                {pro && (
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => void openPortal()}>
                    See invoices
                  </Button>
                )}
              </div>
            ) : (
              <>
                <ul className="divide-y text-sm">
                  {b.trialStartedAt && (
                    <li className="flex justify-between py-2.5">
                      <span>Pro trial started</span>
                      <span className="text-muted-foreground">$0.00</span>
                    </li>
                  )}
                  <li className="py-2.5 text-muted-foreground">No charges yet.{b.tier === "trial" && b.trialEndsAt ? ` Your first charge would be ${price} on ${fmtLongDate(b.trialEndsAt)}.` : ""}</li>
                </ul>
                <div className="mt-3 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                  This is the demo, so there is nothing to refund.
                </div>
              </>
            )}
          </Card>
        </div>
      </div>

      <h2 className="mb-4 font-display text-xl font-semibold">Plans</h2>
      <PricingTiers
        current={pro ? "pro" : "free"}
        onFree={() => setConfirmCancel(true)}
        freeLabel="Move to Free"
        onPro={(c) => startTrial(c)}
        proLabel={live ? "Upgrade to Pro" : b.cancelledAt ? "Start Pro again" : "Start 7 day free trial"}
      />

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{b.tier === "trial" ? "Cancel your trial?" : "Cancel Pro?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {b.tier === "trial"
                ? "You will not be charged. You move to the Free plan right away, and everything you have made stays."
                : `You keep Pro until ${b.renewsAt ? fmtLongDate(b.renewsAt) : "the end of this period"}, then move to Free. No further charges. Nothing is deleted.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Pro</AlertDialogCancel>
            <AlertDialogAction onClick={cancel} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Yes, cancel
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
