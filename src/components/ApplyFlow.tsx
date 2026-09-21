import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { AlertTriangle, BadgeCheck, Copy, ExternalLink, FileText, Hand, Lock, Receipt, Send } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AiWorking } from "@/components/common";
import { MethodBadge } from "@/components/status";
import { useStore } from "@/store/AppStore";
import { coverLetterFor, newApplicationFromJob, type Method } from "@/data/applications";
import { saveApplication } from "@/live/persist";
import type { Job } from "@/data/jobs";
import { isPro } from "@/lib/selectors";
import { fireConfetti } from "@/lib/confetti";
import { LiveApply } from "@/components/LiveApply";
import { cn } from "@/lib/utils";

type Stage = "review" | "prefill" | "working" | "done" | "manual-done";

/** Real accounts get the materials flow. The sample account keeps the simulated one. */
export function ApplyFlow(props: { job: Job; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { state } = useStore();
  return state.mode === "live" ? <LiveApply {...props} /> : <DemoApplyFlow {...props} />;
}

function DemoApplyFlow({ job, open, onOpenChange }: { job: Job; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { state, update } = useStore();
  const pro = isPro(state);
  const versions = state.resume.versions;
  const tailored = versions.find((v) => v.id === `v-${job.id}`);
  const [versionId, setVersionId] = useState(tailored?.id ?? state.resume.activeVersionId);
  const savedLetter = [...state.letters].reverse().find((l) => l.jobId === job.id);
  const [includeLetter, setIncludeLetter] = useState(job.live ? !!savedLetter : true);
  const [stage, setStage] = useState<Stage>("review");
  const [newAppId, setNewAppId] = useState<string | null>(null);
  // Real accounts only send a letter the user actually wrote or approved.
  const letter = savedLetter?.text ?? (job.live ? "" : coverLetterFor(job));

  // Free users cannot use one click submit, so auto becomes prefill for them.
  const method: Method = job.applyMethod === "manual" ? "manual" : job.applyMethod === "auto" && pro ? "submitted" : "prefilled";
  const version = versions.find((v) => v.id === versionId)!;

  const preview = useMemo(() => newApplicationFromJob(job, method, versionId, includeLetter ? letter : "(No cover letter sent)", version?.name ?? "Resume"), [job, method, versionId, includeLetter, letter, version?.name]);

  const commit = (m: Method) => {
    const app = newApplicationFromJob(job, m, versionId, includeLetter ? letter : "(No cover letter sent)", version.name.replace(/\W+/g, "_"));
    let id = app.id;
    update((s) => {
      const existing = s.applications.find((a) => a.jobId === job.id);
      if (existing) {
        id = existing.id;
        existing.receipt = app.receipt;
        existing.events = [...existing.events.filter((e) => e.type === "saved"), ...app.events.filter((e) => e.type !== "saved")];
        existing.column = app.column;
        existing.nextStep = app.nextStep;
      } else {
        s.applications.unshift(app);
      }
      const v = s.resume.versions.find((x) => x.id === versionId);
      if (v && m !== "manual") v.sends += 1;
    });
    setNewAppId(id);
    // Write it out as a real row as well, so the receipt survives this browser
    // and the record exists outside the working state blob.
    if (state.mode === "live") {
      const saved = { ...app, id };
      void saveApplication(saved);
    }
    return id;
  };

  const finishConfirmed = () => {
    setStage("done");
    if (!state.confettiShown) {
      fireConfetti();
      update((s) => void (s.confettiShown = true));
    }
  };

  const close = (o: boolean) => {
    onOpenChange(o);
    if (!o) setTimeout(() => setStage("review"), 250);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        {stage === "review" && (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">Apply to {job.company.name}</DialogTitle>
              <DialogDescription>
                {job.title}. Review exactly what will be sent. Everything here goes on your receipt.
              </DialogDescription>
            </DialogHeader>

            <div className={cn("rounded-xl border p-4 text-sm", method === "manual" ? "border-warning-border bg-warning-soft" : method === "prefilled" ? "border-info-border bg-info-soft" : "border-success-border bg-success-soft")}>
              <div className="mb-1.5">
                <MethodBadge method={method} withTip={false} />
              </div>
              {method === "submitted" && <p>We will submit this on the {job.company.name} careers page and capture the confirmation screen.</p>}
              {method === "prefilled" && (
                <p>
                  {job.applyMethod === "auto" && !pro ? (
                    <>
                      One click submit is part of Pro. On the Free plan we fill the form and you press submit yourself. It still gets a full receipt.{" "}
                      <Link to="/app/billing" className="font-medium text-primary underline-offset-2 hover:underline">
                        See Pro
                      </Link>
                    </>
                  ) : (
                    "This listing lives on a third party job board. We fill in the form, then you review it and press submit yourself."
                  )}
                </p>
              )}
              {method === "manual" && (
                <div className="flex gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                  <p>{job.manualReason}</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ver">Resume version</Label>
                <Select value={versionId} onValueChange={setVersionId}>
                  <SelectTrigger id="ver">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {versions.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name}
                        {v.ats ? ` · ATS ${v.ats}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!tailored && (
                  <p className="text-xs text-muted-foreground">
                    Not tailored for this role yet.{" "}
                    <Link to={`/app/studio?job=${job.id}`} className="font-medium text-primary hover:underline">
                      Tailor it first
                    </Link>
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="incl">Include cover letter</Label>
                  <Switch id="incl" checked={includeLetter} onCheckedChange={setIncludeLetter} />
                </div>
                <p className="text-xs text-muted-foreground">{savedLetter ? "Using the letter you saved in the Studio." : job.live ? "You have not saved a cover letter for this job. It will be sent without one." : "Using a Truth Mode draft built from your resume."}</p>
              </div>
            </div>

            {includeLetter && (
              <details className="group rounded-lg border">
                <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-medium hover:bg-accent/50">
                  <FileText className="h-4 w-4 text-muted-foreground" /> Preview cover letter
                </summary>
                <div className="whitespace-pre-line border-t px-4 py-3 text-sm leading-relaxed text-foreground/85">{letter}</div>
              </details>
            )}

            <div className="rounded-lg border">
              <div className="border-b px-4 py-3 text-sm font-medium">Form answers ({preview.receipt!.fields.length})</div>
              <dl className="max-h-56 divide-y overflow-y-auto text-sm scrollbar-thin">
                {preview.receipt!.fields.map((f) => (
                  <div key={f.q} className="grid grid-cols-1 gap-1 px-4 py-2.5 sm:grid-cols-[1fr_1.2fr] sm:gap-4">
                    <dt className="text-muted-foreground">{f.q}</dt>
                    <dd className="font-medium">{f.a}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:flex-wrap sm:justify-end">
              <Button variant="ghost" onClick={() => close(false)}>
                Not yet
              </Button>
              {method === "submitted" && (
                <Button
                  onClick={() => {
                    commit("submitted");
                    setStage("working");
                  }}
                >
                  <Send /> Submit application
                </Button>
              )}
              {method === "prefilled" && (
                <Button onClick={() => setStage("prefill")}>
                  <Hand /> Prefill the form
                </Button>
              )}
              {method === "manual" && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard?.writeText(preview.receipt!.fields.map((f) => `${f.q}: ${f.a}`).join("\n")).catch(() => undefined);
                      toast.success("Answers copied", { description: "Paste them into the employer's form." });
                    }}
                  >
                    <Copy /> Copy answers
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (job.live && job.applyUrl) window.open(job.applyUrl, "_blank", "noopener,noreferrer");
                      else toast("Opening the employer's site", { description: `In the real product this opens the ${job.company.name} application portal in a new tab.` });
                    }}
                  >
                    <ExternalLink /> Open the application
                  </Button>
                  <Button
                    onClick={() => {
                      const id = commit("manual");
                      update((s) => {
                        s.activity[0] = true;
                        const a = s.applications.find((x) => x.id === id)!;
                        a.column = "applied";
                        a.receipt!.submittedAt = new Date().toISOString();
                        a.events.push({ id: `e${Date.now()}`, type: "submitted", at: new Date().toISOString(), note: "You marked this as submitted on the employer's portal." });
                        a.nextStep = "Add your confirmation email or screenshot to verify it.";
                      });
                      setStage("manual-done");
                    }}
                  >
                    I submitted it
                  </Button>
                </>
              )}
            </div>
          </>
        )}

        {stage === "prefill" && (
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle>Your prefilled form</DialogTitle>
              <DialogDescription>This is what the job board form looks like with your answers filled in. Check it, then press submit yourself.</DialogDescription>
            </DialogHeader>
            <div className="rounded-xl border bg-muted/30 p-4">
              <div className="mb-3 flex items-center justify-between border-b pb-3">
                <span className="text-sm font-semibold">{job.title}</span>
                <span className="text-xs text-muted-foreground">Job board application form</span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {preview.receipt!.fields.slice(0, 8).map((f) => (
                  <div key={f.q} className="space-y-1">
                    <div className="text-[11px] text-muted-foreground">{f.q}</div>
                    <div className="rounded-md border bg-background px-2.5 py-1.5 text-sm">{f.a}</div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">+ {Math.max(0, preview.receipt!.fields.length - 8)} more answers, resume, and cover letter attached.</p>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" onClick={() => setStage("review")}>
                Back
              </Button>
              <Button
                onClick={() => {
                  commit("prefilled");
                  setStage("working");
                }}
              >
                <Send /> Submit on the job board
              </Button>
            </div>
          </div>
        )}

        {stage === "working" && (
          <div className="py-4">
            <DialogTitle className="sr-only">Submitting</DialogTitle>
            <AiWorking
              title={method === "submitted" ? `Submitting to ${job.company.name}` : "Capturing your submission"}
              stepMs={650}
              steps={
                method === "submitted"
                  ? ["Opening the careers page", `Filling ${preview.receipt!.fields.length} fields`, `Attaching ${version.name}`, includeLetter ? "Attaching your cover letter" : "Skipping cover letter, as you chose", "Submitting", "Capturing the confirmation screen"]
                  : ["Watching for the job board confirmation", "Confirmation screen found", "Saving a copy to your receipt"]
              }
              onDone={finishConfirmed}
            />
          </div>
        )}

        {stage === "done" && newAppId && (
          <div className="py-2 text-center">
            <DialogTitle className="sr-only">Application confirmed</DialogTitle>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-success-soft text-success animate-pop">
              <BadgeCheck className="h-8 w-8" />
            </div>
            <h2 className="font-display text-2xl font-semibold">Confirmed. Your receipt is ready.</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              {job.company.name} received your application. We saved the exact resume, cover letter, and answers that were sent, plus the confirmation.
            </p>
            <div className="mx-auto mt-5 max-w-sm rounded-xl border bg-muted/30 p-4 text-left text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Confirmation</span>
                <span className="num font-semibold">{state.applications.find((a) => a.id === newAppId)?.receipt?.confirmation.code}</span>
              </div>
              <div className="mt-1.5 flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <MethodBadge method={method} size="xs" withTip={false} />
              </div>
            </div>
            <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
              <Button variant="outline" onClick={() => close(false)}>
                Close
              </Button>
              <Button asChild>
                <Link to={`/app/receipts/${newAppId}`} onClick={() => close(false)}>
                  <Receipt /> View receipt
                </Link>
              </Button>
            </div>
          </div>
        )}

        {stage === "manual-done" && newAppId && (
          <div className="py-2 text-center">
            <DialogTitle className="sr-only">Marked as submitted</DialogTitle>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-warning-soft text-warning">
              <Lock className="h-7 w-7" />
            </div>
            <h2 className="font-display text-2xl font-semibold">Marked as submitted</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Because you submitted this one yourself, we cannot verify it yet. Add the confirmation email or a screenshot to the receipt and it will count toward your Proof Score.
            </p>
            <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
              <Button variant="outline" onClick={() => close(false)}>
                Later
              </Button>
              <Button asChild>
                <Link to={`/app/receipts/${newAppId}`} onClick={() => close(false)}>
                  Add confirmation now
                </Link>
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
