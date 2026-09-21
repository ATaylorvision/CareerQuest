import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { BadgeCheck, Check, Copy, ExternalLink, FileDown, FileText, Globe, Pencil, Printer, Undo2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ResumeDocument } from "@/components/studio/ResumeDocument";
import { useStore } from "@/store/AppStore";
import { newApplicationFromJob, type Application } from "@/data/applications";
import { renderLetterHtml, type LetterContext } from "@/data/letterTemplates";
import type { Job } from "@/data/jobs";
import { buildResume, downloadText, printHtml, printResume, resumeToText, withManualEdits, type BuiltResume } from "@/lib/resumeBuild";
import { companySiteUrl } from "@/lib/companySite";
import { fireConfetti } from "@/lib/confetti";
import { removeApplication, saveApplication } from "@/live/persist";
import { supabase } from "@/live/supabase";

const GREETING = /^(dear|hello|hi|to whom)\b/i;

/** Turns a saved letter into the paragraphs a template lays out. The template writes its own greeting. */
function letterParagraphs(text: string) {
  const parts = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  return parts.length && GREETING.test(parts[0]) && parts[0].length < 80 ? parts.slice(1) : parts;
}

/** A saved resume version, read back from the database. The base resume is built from the account's own resume. */
function useVersionResume(versionId: string, base: BuiltResume) {
  const [fetched, setFetched] = useState<{ id: string; resume: BuiltResume | null } | null>(null);
  const isBase = versionId === "v-base" || !versionId.startsWith("v-");

  useEffect(() => {
    if (isBase || !supabase) return;
    let alive = true;
    void supabase
      .from("resume_versions")
      .select("content")
      .eq("job_id", versionId.slice(2))
      .maybeSingle()
      .then(({ data }) => {
        if (!alive) return;
        const c = data?.content as Partial<BuiltResume> | undefined;
        const ok = c && Array.isArray(c.roles) && typeof c.summary === "string";
        setFetched({ id: versionId, resume: ok ? ({ ...base, ...c, changedIds: new Set(), editedIds: new Set(), certsOwnSection: !!c.certsOwnSection } as BuiltResume) : null });
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versionId, isBase]);

  if (isBase) return { resume: base, loading: false, missing: false };
  if (!fetched || fetched.id !== versionId) return { resume: base, loading: true, missing: false };
  return { resume: fetched.resume ?? base, loading: false, missing: fetched.resume === null };
}

export function LiveApply({ job, open, onOpenChange }: { job: Job; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { state, update } = useStore();
  const versions = state.resume.versions;
  const tailoredId = `v-${job.id}`;
  const hasTailored = versions.some((v) => v.id === tailoredId);
  const [versionId, setVersionId] = useState(hasTailored ? tailoredId : versions.some((v) => v.id === state.resume.activeVersionId) ? state.resume.activeVersionId : "v-base");
  const version = versions.find((v) => v.id === versionId);

  const base = useMemo(() => buildResume([], {}, { contact: state.resume.contact }), [state.resume.contact]);
  const { resume: saved, loading, missing } = useVersionResume(versionId, base);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [contactEdits, setContactEdits] = useState<Record<string, string>>({});
  const resume = useMemo(() => (Object.keys(edits).length || Object.keys(contactEdits).length ? withManualEdits(saved, { fields: edits, contact: contactEdits }) : saved), [saved, edits, contactEdits]);
  const changeVersion = (id: string) => {
    setVersionId(id);
    setEdits({});
    setContactEdits({});
  };

  const savedLetter = [...state.letters].reverse().find((l) => l.jobId === job.id);
  const [letter, setLetter] = useState(savedLetter?.text ?? "");
  const [withLetter, setWithLetter] = useState(!!savedLetter);
  const [editingLetter, setEditingLetter] = useState(false);

  const existing = state.applications.find((a) => a.jobId === job.id);
  const alreadyApplied = !!existing?.receipt?.submittedAt;
  const [applied, setApplied] = useState(alreadyApplied);
  const [didApply, setDidApply] = useState(false);
  const before = useRef<Application | null>(null);
  const site = companySiteUrl(job);
  const first = state.profile.name.replace(/\s+/g, "_") || "Resume";
  const fileBase = `${first}_${job.company.name.split(" ")[0]}`;

  const letterCtx = (): LetterContext => ({
    name: resume.name,
    location: resume.location,
    phone: resume.phone,
    email: resume.email,
    paragraphs: letterParagraphs(letter),
    company: job.company.name,
    jobTitle: job.title,
    date: new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
  });

  /**
   * Getting the documents out is the moment the person applies, so it moves the
   * card to Applied. It is recorded as they did it themselves: nothing here can
   * confirm the employer received it, and the receipt says so.
   */
  const markApplied = (how: "download" | "manual") => {
    if (applied) {
      // Already recorded. Keep the receipt pointing at what they actually took.
      if (existing?.receipt) {
        const next: Application = { ...existing, receipt: { ...existing.receipt, resumeVersionId: versionId, coverLetter: withLetter ? letter : existing.receipt.coverLetter } };
        update((s) => {
          const i = s.applications.findIndex((a) => a.id === existing.id);
          if (i >= 0) s.applications[i] = next;
        });
        void saveApplication(next);
      }
      return;
    }
    const at = new Date().toISOString();
    before.current = existing ? structuredClone(existing) : null;
    const seed = existing ?? newApplicationFromJob(job, "manual", versionId, "", version?.name ?? "Resume");
    const next: Application = {
      ...seed,
      column: "applied",
      events: [
        ...seed.events.filter((e) => e.type === "saved"),
        { id: `e${Date.now()}`, type: "submitted", at, note: how === "download" ? "You downloaded your resume and cover letter to apply." : "You marked this as submitted on the employer's site." },
      ],
      receipt: {
        method: "manual",
        destination: "company",
        destinationLabel: job.signals.companySite === "confirmed" ? `${job.company.name} careers page (you applied)` : "Applied on the employer's site (you applied)",
        submittedAt: at,
        resumeVersionId: versionId,
        coverLetter: withLetter ? letter : "(No cover letter)",
        fields: [],
        confirmation: { verified: false },
      },
      nextStep: "Finish the application on the employer's site. Add your confirmation email to the receipt to verify it.",
    };
    update((s) => {
      const i = s.applications.findIndex((a) => a.id === next.id);
      if (i >= 0) s.applications[i] = next;
      else s.applications.unshift(next);
      const v = s.resume.versions.find((x) => x.id === versionId);
      if (v) v.sends += 1;
      s.activity[0] = true;
    });
    void saveApplication(next);
    setApplied(true);
    setDidApply(true);
    fireConfetti();
    toast.success("Added to your tracker as applied", { description: `${job.title} at ${job.company.name}` });
  };

  const undoApplied = () => {
    const prev = before.current;
    if (prev) {
      update((s) => {
        const i = s.applications.findIndex((a) => a.id === prev.id);
        if (i >= 0) s.applications[i] = prev;
      });
      void saveApplication(prev);
    } else {
      update((s) => void (s.applications = s.applications.filter((a) => a.jobId !== job.id)));
      void removeApplication(job.id);
    }
    before.current = null;
    setApplied(false);
    setDidApply(false);
    toast("Moved back. It is not marked as applied.");
  };

  /* ---------------- getting things out ---------------- */

  const resumePdf = () => {
    if (!printResume(resume, fileBase, state.resume.templateId, state.profile.headline, state.resume.format)) return toast.error("Your browser blocked the print window. Allow pop ups and try again.");
    markApplied("download");
  };
  const resumeTxt = () => {
    downloadText(`${fileBase}_Resume.txt`, resumeToText(resume));
    markApplied("download");
  };
  const resumeCopy = () => {
    void navigator.clipboard?.writeText(resumeToText(resume)).then(() => toast.success("Resume copied"), () => toast.error("Could not copy. Use a download instead."));
    markApplied("download");
  };
  const letterPdf = () => {
    if (!printHtml(renderLetterHtml(letterCtx(), state.resume.letterTemplateId, `${resume.name} cover letter`, state.resume.format ? { ...state.resume.format, size: null } : undefined))) return toast.error("Your browser blocked the print window. Allow pop ups and try again.");
    markApplied("download");
  };
  const letterTxt = () => {
    downloadText(`${fileBase}_Cover_Letter.txt`, letter);
    markApplied("download");
  };
  const letterCopy = () => {
    void navigator.clipboard?.writeText(letter).then(() => toast.success("Cover letter copied"), () => toast.error("Could not copy. Use a download instead."));
    markApplied("download");
  };

  const openApplication = () => {
    const url = job.applyUrl ?? site;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Apply to {job.company.name}</DialogTitle>
          <DialogDescription>
            {job.title}. Choose your resume and cover letter, edit them if you like, download them, then finish on the employer's site.
          </DialogDescription>
        </DialogHeader>

        {/* 1. resume */}
        <section aria-labelledby="ap-resume" className="space-y-3 rounded-xl border p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-1.5">
              <Label id="ap-resume" htmlFor="ver" className="text-sm font-semibold">
                1. Your resume
              </Label>
              <Select value={versionId} onValueChange={changeVersion}>
                <SelectTrigger id="ver">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {versions.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                      {v.ats ? ` · ATS ${v.ats}` : ""}
                      {v.id === tailoredId ? " · tailored for this job" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to={`/app/studio?job=${encodeURIComponent(job.id)}`} onClick={() => onOpenChange(false)}>
                <FileText /> {hasTailored ? "Tailor it further" : "Tailor a new resume for this job"}
              </Link>
            </Button>
          </div>
          {!hasTailored && versionId === "v-base" && <p className="text-xs text-muted-foreground">This is your base resume, not yet tailored to this job. A tailored one usually scores better with the employer's screening.</p>}
          {missing && <p className="text-xs text-warning">We could not load that saved version, so this is your base resume. You can still edit it below.</p>}

          <details className="group rounded-lg border bg-muted/20" open>
            <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm font-medium hover:bg-accent/40">
              <Pencil className="h-4 w-4 text-muted-foreground" /> Preview and edit {loading ? "(loading)" : ""}
            </summary>
            <div className="max-h-[360px] overflow-y-auto border-t p-3">
              <p className="mb-2 text-xs text-muted-foreground">Click any line to change it. Edits here go into the copy you download and do not change your saved version.</p>
              <ResumeDocument
                r={resume}
                highlight={false}
                onEdit={(id, v) => setEdits((e) => ({ ...e, [id]: v }))}
                onContactEdit={(f, v) => setContactEdits((e) => ({ ...e, [f]: v }))}
              />
            </div>
          </details>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={resumePdf}>
              <Printer /> Download PDF
            </Button>
            <Button size="sm" variant="outline" onClick={resumeTxt}>
              <FileDown /> Plain text
            </Button>
            <Button size="sm" variant="outline" onClick={resumeCopy}>
              <Copy /> Copy
            </Button>
          </div>
        </section>

        {/* 2. cover letter */}
        <section aria-labelledby="ap-letter" className="space-y-3 rounded-xl border p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Label id="ap-letter" htmlFor="incl" className="text-sm font-semibold">
              2. Your cover letter
            </Label>
            <div className="flex items-center gap-2">
              <Label htmlFor="incl" className="text-xs text-muted-foreground">
                Include one
              </Label>
              <Switch id="incl" checked={withLetter} onCheckedChange={setWithLetter} />
            </div>
          </div>
          {withLetter && (
            <>
              {!letter.trim() && (
                <p className="text-sm text-muted-foreground">
                  You have not written a letter for this job yet. Write it below, or{" "}
                  <Link to={`/app/studio?job=${encodeURIComponent(job.id)}&doc=letter`} onClick={() => onOpenChange(false)} className="font-medium text-primary hover:underline">
                    have Wren draft one in the Studio
                  </Link>
                  .
                </p>
              )}
              <Textarea
                value={letter}
                onChange={(e) => setLetter(e.target.value)}
                onFocus={() => setEditingLetter(true)}
                onBlur={() => setEditingLetter(false)}
                rows={editingLetter || letter.length > 0 ? 9 : 4}
                placeholder="Dear Hiring Manager, ..."
                aria-label="Cover letter"
                className="text-sm leading-relaxed"
              />
              <p className="text-xs text-muted-foreground">Cover letters work best when they are specific to the job, so read it through and make it yours before you send it.</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={letterPdf} disabled={!letter.trim()}>
                  <Printer /> Download PDF
                </Button>
                <Button size="sm" variant="outline" onClick={letterTxt} disabled={!letter.trim()}>
                  <FileDown /> Plain text
                </Button>
                <Button size="sm" variant="outline" onClick={letterCopy} disabled={!letter.trim()}>
                  <Copy /> Copy
                </Button>
              </div>
            </>
          )}
        </section>

        {/* 3. finish */}
        <section aria-labelledby="ap-finish" className="space-y-3 rounded-xl border p-4">
          <h3 id="ap-finish" className="text-sm font-semibold">
            3. Finish on the employer's site
          </h3>
          {applied ? (
            <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-success-border bg-success-soft p-3 text-sm">
              <span className="flex items-center gap-2 font-medium">
                <BadgeCheck className="h-5 w-5 text-success" /> Marked as applied in your tracker.
              </span>
              {didApply && (
                <Button size="xs" variant="ghost" onClick={undoApplied}>
                  <Undo2 /> I have not applied yet
                </Button>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Downloading or copying a document adds this job to your tracker as applied. You can undo that here.</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button onClick={openApplication}>
              <ExternalLink /> Open the application
            </Button>
            <Button variant="outline" asChild>
              <a href={site} target="_blank" rel="noopener noreferrer">
                <Globe /> View company site
              </a>
            </Button>
            {!applied && (
              <Button variant="outline" onClick={() => markApplied("manual")}>
                <Check /> I submitted it
              </Button>
            )}
            {applied && (
              <Button variant="ghost" asChild>
                <Link to="/app/tracker" onClick={() => onOpenChange(false)}>
                  See it in the tracker
                </Link>
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">CareerQuest cannot send this to the employer for you. After you submit, add the confirmation email to your receipt and it counts as verified.</p>
        </section>
      </DialogContent>
    </Dialog>
  );
}
