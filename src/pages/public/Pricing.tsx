import { Link, useNavigate } from "react-router-dom";
import { Check, Minus, MousePointerClick, RotateCcw, Scale } from "lucide-react";
import { MarketingLayout } from "@/components/layout/MarketingLayout";
import { PricingTiers } from "@/components/PricingTiers";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useDocTitle } from "@/hooks/useDocTitle";

const ROWS: [string, string | boolean, string | boolean][] = [
  ["Job matching and match scores", "Unlimited", "Unlimited"],
  ["Listings checked for legitimacy", true, true],
  ["Copilot chat", "Unlimited", "Unlimited"],
  ["Career Translator", true, true],
  ["Today's Plan and streaks", true, true],
  ["Application tracker and receipts", true, true],
  ["Tailored resumes", "3 per month", "Unlimited"],
  ["Cover letters", "3 per month", "Unlimited"],
  ["One click apply with full receipts", false, true],
  ["Insider Connections and outreach drafting", false, true],
  ["Interview prep question bank and practice mode", "Sample questions", "Full bank, included"],
  ["Weekly Check In with field benchmarks", "Basic summary", "Full, with benchmarks"],
  ["Priority on newly posted roles", false, true],
  ["Resume version analytics", false, true],
];

function Cell({ v }: { v: string | boolean }) {
  if (v === true) return <Check className="mx-auto h-4 w-4 text-success" aria-label="Included" />;
  if (v === false) return <Minus className="mx-auto h-4 w-4 text-muted-foreground" aria-label="Not included" />;
  return <span className="text-sm">{v}</span>;
}

export default function Pricing() {
  useDocTitle("Pricing");
  const nav = useNavigate();
  return (
    <MarketingLayout>
      <section className="border-b">
        <div className="container py-14 sm:py-20">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <h1 className="font-display text-4xl font-semibold sm:text-5xl text-balance">One price, everything included.</h1>
            <p className="mt-4 text-lg text-muted-foreground">We do not sell the interview questions separately. No countdown timers, no hidden tiers, no surprise charges.</p>
          </div>
          <PricingTiers onFree={() => nav("/signup")} onPro={() => nav("/signup?plan=pro")} />
        </div>
      </section>

      <section className="border-b bg-canvas">
        <div className="container grid grid-cols-1 gap-5 py-14 md:grid-cols-3">
          <div className="card-base p-6">
            <MousePointerClick className="h-5 w-5 text-primary" />
            <h2 className="mt-3 font-semibold">Cancel in one click, no phone call, no email</h2>
            <p className="mt-2 text-sm text-muted-foreground">The cancel button sits right next to the upgrade button in Account and billing. One confirmation and you are done. You keep Pro until the end of the period you paid for.</p>
          </div>
          <div className="card-base p-6">
            <RotateCcw className="h-5 w-5 text-primary" />
            <h2 className="mt-3 font-semibold">Refund policy</h2>
            <p className="mt-2 text-sm text-muted-foreground">If you are charged and wish you had not been, request a refund from Account and billing within 14 days of the charge. We refund the full amount to your original payment method. No questions, no forms.</p>
          </div>
          <div className="card-base p-6">
            <Scale className="h-5 w-5 text-primary" />
            <h2 className="mt-3 font-semibold">Why we priced it lower</h2>
            <p className="mt-2 text-sm text-muted-foreground">Many AI job tools charge more than we do, then sell interview prep as an add on. We priced CareerQuest below them on purpose. The people who need this most often just lost a paycheck.</p>
          </div>
        </div>
      </section>

      <section className="border-b">
        <div className="container py-14">
          <h2 className="mb-6 text-center font-display text-2xl font-semibold">Free and Pro, side by side</h2>
          <div className="mx-auto max-w-3xl overflow-hidden rounded-xl border bg-card shadow-card">
            <table className="w-full text-left">
              <caption className="sr-only">Feature comparison between the Free and Pro plans</caption>
              <thead className="bg-muted/60 text-sm">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Feature</th>
                  <th scope="col" className="w-32 px-4 py-3 text-center font-semibold">Free, $0</th>
                  <th scope="col" className="w-40 px-4 py-3 text-center font-semibold text-primary">Pro, $24/mo</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {ROWS.map(([f, a, b]) => (
                  <tr key={f} className="transition-colors hover:bg-muted/30">
                    <th scope="row" className="px-4 py-3 text-sm font-normal">{f}</th>
                    <td className="px-4 py-3 text-center"><Cell v={a} /></td>
                    <td className="px-4 py-3 text-center"><Cell v={b} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section>
        <div className="container max-w-3xl py-14">
          <h2 className="mb-4 font-display text-2xl font-semibold">Questions people ask</h2>
          <Accordion type="single" collapsible className="rounded-xl border bg-card px-5">
            <AccordionItem value="a">
              <AccordionTrigger>What happens when the free trial ends?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                The trial lasts 7 days. On day 8 we charge the plan you chose, $24 for monthly or $180 for yearly. We show the exact date when you start and remind you by email two days before. If you cancel before then, you are never charged and you move to the Free plan.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="b">
              <AccordionTrigger>Is the Free plan actually free forever?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">Yes. Unlimited matching, the legitimacy checks on every listing, the tracker with receipts, Career Translator, Today's Plan, and Copilot chat stay free. Tailored resumes and cover letters are limited to three each per month.</AccordionContent>
            </AccordionItem>
            <AccordionItem value="c">
              <AccordionTrigger>Does one click apply mean you apply without asking me?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">No. You review and approve every application. Then we submit it, or prefill it for you to submit, and every one gets a receipt. If an employer blocks automation, we label it Manual required and tell you why.</AccordionContent>
            </AccordionItem>
            <AccordionItem value="d">
              <AccordionTrigger>Can the resume tailor make things up to help me get past filters?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">No. Tailoring can only reorder, reword, re-emphasize, and reformat what is already in your resume. It cannot add a skill, number, employer, or date you did not provide.</AccordionContent>
            </AccordionItem>
            <AccordionItem value="e">
              <AccordionTrigger>Do you offer discounts if I was laid off?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">The yearly plan works out to $15 a month. Many state workforce programs for laid off workers also reimburse job search tools. We can send a receipt formatted for those programs.</AccordionContent>
            </AccordionItem>
          </Accordion>
          <p className="mt-8 text-center text-sm text-muted-foreground">
            Still deciding?{" "}
            <Link to="/signup" className="font-medium text-primary hover:underline">
              Start on the Free plan
            </Link>{" "}
            and upgrade only if you want to.
          </p>
        </div>
      </section>
    </MarketingLayout>
  );
}
