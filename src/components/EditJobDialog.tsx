import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Loader2, PenLine, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/live/api";
import { useLive } from "@/live/LiveProvider";
import { useUrlLookup } from "@/hooks/useUrlLookup";
import type { Job } from "@/data/jobs";
import { cn } from "@/lib/utils";

const MIN_DESCRIPTION = 200;

/**
 * Edits a job the person added themselves: title, company, location, the link, the
 * description, salary, the company's site, and a short note on the employer. Only
 * ever opened for a job with `job.imported`, since that is the only kind a person
 * owns and can change.
 */
export function EditJobDialog({ job, open, onOpenChange }: { job: Job; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { reloadJobs } = useLive();
  const { lookup, busy: looking } = useUrlLookup();

  const [title, setTitle] = useState(job.title);
  const [company, setCompany] = useState(job.company.name);
  const [location, setLocation] = useState(job.location === "Location not listed" ? "" : job.location);
  const [url, setUrl] = useState(job.applyUrl ?? "");
  const [description, setDescription] = useState(job.descriptionText ?? "");
  const [salaryMin, setSalaryMin] = useState(job.salary ? String(job.salary[0]) : "");
  const [salaryMax, setSalaryMax] = useState(job.salary ? String(job.salary[1]) : "");
  const [companyWebsite, setCompanyWebsite] = useState(job.company.website ?? "");
  const [employerAbout, setEmployerAbout] = useState(job.company.about ?? "");
  const [showMore, setShowMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(job.title);
    setCompany(job.company.name);
    setLocation(job.location === "Location not listed" ? "" : job.location);
    setUrl(job.applyUrl ?? "");
    setDescription(job.descriptionText ?? "");
    setSalaryMin(job.salary ? String(job.salary[0]) : "");
    setSalaryMax(job.salary ? String(job.salary[1]) : "");
    setCompanyWebsite(job.company.website ?? "");
    setEmployerAbout(job.company.about ?? "");
    setShowMore(false);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, job.id]);

  const chars = description.trim().length;
  const ready = title.trim().length >= 2 && company.trim().length >= 2 && chars >= MIN_DESCRIPTION;

  const runLookup = async () => {
    if (!url.trim()) return;
    const found = await lookup(url.trim());
    if (!found?.found) return;
    if (found.salaryMin != null && found.salaryMax != null && !salaryMin && !salaryMax) {
      setSalaryMin(String(found.salaryMin));
      setSalaryMax(String(found.salaryMax));
      setShowMore(true);
    }
    if (found.companyWebsite && !companyWebsite.trim()) {
      setCompanyWebsite(found.companyWebsite);
      setShowMore(true);
    }
    if (found.description && description.trim().length < MIN_DESCRIPTION) setDescription(found.description);
    toast.success("Filled in what we could find", { description: "Check it over, everything here can still be edited." });
  };

  const submit = async () => {
    setError(null);
    setSaving(true);
    try {
      const out = await api<{ ok: boolean; rescored: boolean }>("studio", {
        action: "updateJob",
        jobId: job.id,
        title,
        company,
        location,
        url,
        description,
        salaryMin: salaryMin ? Number(salaryMin) : null,
        salaryMax: salaryMax ? Number(salaryMax) : null,
        companyWebsite,
        employerAbout,
      });
      if (out.rescored) {
        // The description changed enough to invalidate the old read. Re-score now so the
        // page does not sit on a stale match, and let the deeper read follow behind.
        await api("jobs/match", { ids: [job.id], mode: "score", force: true }).catch(() => undefined);
        void api("jobs/match", { ids: [job.id], mode: "detail", force: true }).catch(() => undefined);
      }
      await reloadJobs();
      toast.success("Job updated");
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenLine className="h-5 w-5 text-primary" /> Edit job details
          </DialogTitle>
          <DialogDescription>Fill in what the listing left out: salary, the company's site, or a note about the employer. This job is only visible to you.</DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (ready && !saving) void submit();
          }}
          noValidate
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ej-title">Job title</Label>
              <Input id="ej-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} autoComplete="off" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ej-company">Company</Label>
              <Input id="ej-company" value={company} onChange={(e) => setCompany(e.target.value)} maxLength={120} autoComplete="off" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ej-location">
                Where is it? <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input id="ej-location" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={120} autoComplete="off" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ej-url">
                Link to the posting <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <div className="flex gap-2">
                <Input id="ej-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" inputMode="url" autoComplete="off" className="flex-1" />
                <Button type="button" variant="outline" size="icon" disabled={!url.trim() || looking} onClick={() => void runLookup()} aria-label="Look up this link" title="Look up this link">
                  {looking ? <Loader2 className="animate-spin" /> : <Search />}
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ej-desc">The job description</Label>
            <Textarea id="ej-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={8} aria-describedby="ej-desc-help" />
            <p id="ej-desc-help" className={cn("text-xs", chars > 0 && chars < MIN_DESCRIPTION ? "text-warning" : "text-muted-foreground")}>
              {chars < MIN_DESCRIPTION ? `${chars} characters. Paste the whole description, not just a line or two.` : `${chars.toLocaleString()} characters. Changing this re-reads it against your resume.`}
            </p>
          </div>

          <div>
            <button type="button" onClick={() => setShowMore((v) => !v)} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              {showMore ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              Salary, company site, and notes about the employer
            </button>
            {showMore && (
              <div className="mt-3 space-y-3 rounded-lg border bg-muted/20 p-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="ej-sal-min">Salary, low end</Label>
                    <Input id="ej-sal-min" value={salaryMin} onChange={(e) => setSalaryMin(e.target.value.replace(/[^\d]/g, ""))} placeholder="65000" inputMode="numeric" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ej-sal-max">Salary, high end</Label>
                    <Input id="ej-sal-max" value={salaryMax} onChange={(e) => setSalaryMax(e.target.value.replace(/[^\d]/g, ""))} placeholder="80000" inputMode="numeric" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ej-website">Company website</Label>
                  <Input id="ej-website" value={companyWebsite} onChange={(e) => setCompanyWebsite(e.target.value)} placeholder="https://" inputMode="url" autoComplete="off" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ej-about">About the employer</Label>
                  <Textarea id="ej-about" value={employerAbout} onChange={(e) => setEmployerAbout(e.target.value.slice(0, 2000))} rows={3} placeholder="A line or two on what the company does." />
                </div>
              </div>
            )}
          </div>

          {error && (
            <p role="alert" className="rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm">
              {error}
            </p>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="ghost" disabled={saving} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!ready || saving}>
              {saving && <Loader2 className="animate-spin" />}
              {saving ? "Saving" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
