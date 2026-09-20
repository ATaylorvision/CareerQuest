import { useState } from "react";
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

export default function Billing() {
  useDocTitle("Account and billing");
  const { state, update } = useStore();
  const b = state.billing;
  const pro = isPro(state);
  const live = state.mode === "live";
  const [confirmCancel, setConfirmCancel] = useState(false);
  const price = b.cycle === "yearly" ? "$180" : "$24";
  const monthApps = state.applications.filter((a) => a.receipt?.submittedAt && diffDays(a.receipt.submittedAt) <= 30).length;
  const oneClick = state.applications.filter((a) => a.receipt?.method === "submitted" && a.receipt.submittedAt && diffDays(a.receipt.submittedAt) <= 30).length;

  const startTrial = (cycle: "monthly" | "yearly") => {
    update((s) => {
      s.billing = { ...s.billing, tier: "trial", cycle, trialStartedAt: new Date().toISOString(), trialEndsAt: daysFromNow(7), renewsAt: daysFromNow(7), cancelledAt: null };
    });
    toast.success("Your 7 day Pro trial has started", { description: `It ends on ${fmtLongDate(daysFromNow(7))}. No charge before then.` });
  };

  const cancel = () => {
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
                <Zap /> Start 7 day free trial
              </Button>
            ) : (
              <>
                {!b.cancelledAt && (
                  <Button size="lg" variant="outline" onClick={switchCycle}>
                    {b.cycle === "monthly" ? "Switch to yearly, $180" : "Switch to monthly, $24"}
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
                <div className="font-medium">No card on file</div>
                <p className="mt-1 text-muted-foreground">Payments are not switched on yet, so there is nothing to charge and nothing to store. Your account is free while we finish this.</p>
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
              <b className="text-foreground">Refunds:</b> request a full refund here within 14 days of any charge. No questions, no forms.{" "}
              <Button variant="link" size="xs" className="h-auto p-0 text-xs" onClick={() => toast("Nothing to refund yet", { description: "You have not been charged. If you are, the refund button appears next to that charge." })}>
                Request a refund
              </Button>
            </div>
          </Card>
        </div>
      </div>

      <h2 className="mb-4 font-display text-xl font-semibold">Plans</h2>
      <PricingTiers
        current={pro ? "pro" : "free"}
        onFree={() => setConfirmCancel(true)}
        freeLabel="Move to Free"
        onPro={(c) => startTrial(c)}
        proLabel={b.cancelledAt ? "Start Pro again" : "Start 7 day free trial"}
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
