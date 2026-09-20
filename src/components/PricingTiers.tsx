import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/common";
import { cn } from "@/lib/utils";
import { daysFromNow, fmtLongDate } from "@/lib/date";

export const FREE_FEATURES = [
  "Unlimited job matching and match scores",
  "Unlimited Copilot chat",
  "Every listing checked against the employer's own careers page",
  "Application tracker and receipts",
  "Career Translator",
  "Today's Plan and streaks",
  "3 tailored resumes per month",
  "3 cover letters per month",
];

export const PRO_FEATURES = [
  "Everything in Free",
  "Unlimited tailored resumes and cover letters",
  "One click apply with full receipts",
  "Insider Connections and outreach drafting",
  "The full interview prep bank, included",
  "Weekly Check In with benchmarks",
  "Priority on newly posted roles",
  "Resume version analytics",
];

export function PricingTiers({
  onFree,
  onPro,
  freeLabel = "Start free",
  proLabel = "Start 7 day free trial",
  current,
  compact,
}: {
  onFree: () => void;
  onPro: (cycle: "monthly" | "yearly") => void;
  freeLabel?: string;
  proLabel?: string;
  current?: "free" | "pro";
  compact?: boolean;
}) {
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");
  const trialEnd = fmtLongDate(daysFromNow(7));
  return (
    <div>
      <div className="mb-6 flex justify-center">
        <Segmented<"monthly" | "yearly">
          size="md"
          value={cycle}
          onChange={setCycle}
          options={[
            { value: "monthly", label: "Monthly" },
            { value: "yearly", label: <>Yearly <span className="ml-1 text-success">save 37%</span></> },
          ]}
        />
      </div>
      <div className="mx-auto grid grid-cols-1 max-w-4xl gap-5 md:grid-cols-2">
        <div className={cn("card-base flex flex-col p-6 sm:p-8", current === "free" && "ring-2 ring-primary/30")}>
          <div className="flex items-center justify-between">
            <h3 className="font-display text-xl font-semibold">Free forever</h3>
            {current === "free" && <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">Your plan</span>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Everything you need to run a real search.</p>
          <div className="mt-5 flex items-baseline gap-1.5">
            <span className="num font-display text-5xl font-semibold">$0</span>
            <span className="text-sm text-muted-foreground">forever</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">No card needed.</p>
          <ul className="mt-6 flex-1 space-y-2.5 text-sm">
            {FREE_FEATURES.map((f) => (
              <li key={f} className="flex gap-2.5">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
                {f}
              </li>
            ))}
          </ul>
          <Button variant="outline" size="lg" className="mt-7 w-full" onClick={onFree} disabled={current === "free"}>
            {current === "free" ? "Current plan" : freeLabel}
          </Button>
        </div>

        <div className={cn("card-base relative flex flex-col border-primary/40 p-6 shadow-lift sm:p-8", current === "pro" && "ring-2 ring-primary/40")}>
          <span className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">Everything included</span>
          <div className="flex items-center justify-between">
            <h3 className="font-display text-xl font-semibold">CareerQuest Pro</h3>
            {current === "pro" && <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-medium text-primary">Your plan</span>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">For when you want every tool working for you.</p>
          <div className="mt-5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="num font-display text-5xl font-semibold">{cycle === "monthly" ? "$24" : "$180"}</span>
            <span className="text-sm text-muted-foreground">{cycle === "monthly" ? "per month" : "per year"}</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {cycle === "monthly" ? "Or $180 per year, which works out to $15 a month." : "Billed once a year. That is $15 a month. Or $24 month to month."}
          </p>
          <ul className="mt-6 flex-1 space-y-2.5 text-sm">
            {PRO_FEATURES.map((f) => (
              <li key={f} className="flex gap-2.5">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                {f}
              </li>
            ))}
          </ul>
          <Button size="lg" className="mt-7 w-full" onClick={() => onPro(cycle)} disabled={current === "pro"}>
            {current === "pro" ? "Current plan" : proLabel}
          </Button>
          {!compact && (
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              7 day free trial. If you start today, your trial ends on <b className="text-foreground">{trialEnd}</b>. You will be charged {cycle === "monthly" ? "$24" : "$180"} that day unless you cancel. We remind you two days before.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
