import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowRight, ChevronDown, ChevronUp, ClipboardPaste, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useStore } from "@/store/AppStore";
import { api, ApiError } from "@/live/api";
import { saveApplication } from "@/live/persist";
import { useLive } from "@/live/LiveProvider";
import { applicationFromImport } from "@/lib/tracker";
import { useUrlLookup } from "@/hooks/useUrlLookup";
import { guessSalaryFromText } from "@/lib/salaryGuess";
import type { Column } from "@/data/applications";
import { cn } from "@/lib/utils";

/** The shortest description we will take. A line or two tells us nothing about what the job needs. */
const MIN_DESCRIPTION = 200;

const STAGES: { id: Column; label: string; hint: string }[] = [
  { id: "saved", label: "Not yet", hint: "I am thinking about applying" },
  { id: "applied", label: "I have applied", hint: "Waiting to hear back" },
  { id: "screening", label: "I have heard back", hint: "A recruiter has been in touch" },
  { id: "interview", label: "I am interviewing", hint: "Talking to the team" },
  { id: "offer", label: "I have an offer", hint: "Decision time" },
  { id: "rejected", label: "They said no", hint: "Keep it for your records" },
];

const today = () => new Date().toLocaleDateString("en-CA");

/**
 * Add a job that was not in your matches: one you found yourself, or one you
 * already applied to. You paste the description, because it is the only text we
 * read. The link is kept so you can find the posting again and is never opened
 * by our servers.
 */
export function ImportJobDialog({ open, onOpenChange, onAdded }: { open: boolean; onOpenChange: (o: boolean) => void; onAdded?: (jobId: string) => void }) {
  const { state, update } = useStore();
  const { reloadJobs } = useLive();
  const nav = useNavigate();
  const live = state.mode === "live";

  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [location, setLocation] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [employerAbout, setEmployerAbout] = useState("");
  const [showMore, setShowMore] = useState(false);
  const [stage, setStage] = useState<Column>("saved");
  const [appliedOn, setAppliedOn] = useState(today());
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { lookup, busy: looking } = useUrlLookup();
  // Set once the job exists, so a retry after a later step fails never adds it twice.
  const created = useRef<string | null>(null);

  const chars = description.trim().length;
  const dateOk = stage === "saved" || (!!appliedOn && appliedOn <= today());
  const ready = title.trim().length >= 2 && company.trim().length >= 2 && chars >= MIN_DESCRIPTION && dateOk;

  const reset = () => {
    setTitle("");
    setCompany("");
    setLocation("");
    setUrl("");
    setDescription("");
    setSalaryMin("");
    setSalaryMax("");
    setCompanyWebsite("");
    setEmployerAbout("");
    setShowMore(false);
    setStage("saved");
    setAppliedOn(today());
    setError(null);
    created.current = null;
  };

  // The link is the fastest way in: look it up and fill in whatever it finds,
  // without overwriting anything the person already typed themselves.
  const runLookup = async () => {
    if (!url.trim()) return;
    const found = await lookup(url.trim());
    if (!found?.found) return;
    if (found.title && !title.trim()) setTitle(found.title);
    if (found.company && !company.trim()) setCompany(found.company);
    if (found.location && !location.trim()) setLocation(found.location);
    if (found.description && !description.trim()) setDescription(found.description);
    if (found.salaryMin != null && found.salaryMax != null && !salaryMin && !salaryMax) {
      setSalaryMin(String(found.salaryMin));
      setSalaryMax(String(found.salaryMax));
      setShowMore(true);
    }
    if (found.companyWebsite && !companyWebsite.trim()) {
      setCompanyWebsite(found.companyWebsite);
      setShowMore(true);
    }
    if (found.title || found.company || found.description) toast.success("Filled in what we could find", { description: "Check it over, everything here can still be edited." });
  };

  const onDescriptionChange = (text: string) => {
    setDescription(text);
    if (!salaryMin && !salaryMax) {
      const guess = guessSalaryFromText(text);
      if (guess) {
        setSalaryMin(String(guess[0]));
        setSalaryMax(String(guess[1]));
        setShowMore(true);
      }
    }
  };

  const submit = async (then: "track" | "tailor") => {
    setError(null);
    try {
      if (!created.current) {
        setBusy("Saving the job");
        const out = await api<{ jobId: string }>("studio", {
          action: "importJob",
          title,
          company,
          location,
          url,
          description,
          salaryMin: salaryMin ? Number(salaryMin) : undefined,
          salaryMax: salaryMax ? Number(salaryMax) : undefined,
          companyWebsite: companyWebsite || undefined,
          employerAbout: employerAbout || undefined,
        });
        created.current = out.jobId;
      }
      const jobId = created.current;

      // Read it against the resume. A failure here is not fatal: the job is already
      // usable, and the score simply stays blank until it is read again.
      setBusy("Reading it against your resume");
      try {
        await api("jobs/match", { ids: [jobId], mode: "score", force: true });
      } catch {
        /* the placeholder match keeps the job usable */
      }
      await reloadJobs();

      // Noon local time, so the date the person picked cannot slide a day in another time zone.
      const when = new Date(`${appliedOn || today()}T12:00:00`);
      const entry = applicationFromImport({ id: `a${Date.now().toString(36)}`, jobId, stage, appliedOn: when });
      update((s) => {
        if (!s.applications.some((a) => a.jobId === jobId)) s.applications.unshift(entry);
      });
      void saveApplication(entry);

      // The deeper read (requirements, gaps) is slower and only improves the Studio, so it runs behind.
      void api("jobs/match", { ids: [jobId], mode: "detail" })
        .then(() => reloadJobs())
        .catch(() => undefined);

      toast.success("Added to your tracker", { description: `${title.trim()} at ${company.trim()}.` });
      reset();
      onOpenChange(false);
      onAdded?.(jobId);
      if (then === "tailor") nav(`/app/studio?job=${encodeURIComponent(jobId)}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardPaste className="h-5 w-5 text-primary" /> Add a job
          </DialogTitle>
          <DialogDescription>Found one yourself, or already applied? Paste it in and we will track it, and you can tailor your resume for it.</DialogDescription>
        </DialogHeader>

        {!live ? (
          <div className="rounded-lg border bg-muted/40 p-4 text-sm">
            <p className="font-medium">This works on a real account.</p>
            <p className="mt-1 text-muted-foreground">The sample account does not save anything. Create a free account to add your own jobs.</p>
            <Button asChild size="sm" className="mt-3">
              <Link to="/signup">Create a free account</Link>
            </Button>
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (ready && !busy) void submit("track");
            }}
            noValidate
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ij-title">Job title</Label>
                <Input id="ij-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Operations Coordinator" maxLength={140} autoComplete="off" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ij-company">Company</Label>
                <Input id="ij-company" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Acme Logistics" maxLength={120} autoComplete="off" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ij-location">
                  Where is it? <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Input id="ij-location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Providence, RI, or Remote" maxLength={120} autoComplete="off" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="ij-url">
                  Link to the posting <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <div className="flex gap-2">
                  <Input id="ij-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" inputMode="url" autoComplete="off" className="flex-1" />
                  <Button type="button" variant="outline" disabled={!url.trim() || looking} onClick={() => void runLookup()}>
                    {looking ? <Loader2 className="animate-spin" /> : <Search />} {looking ? "Looking it up" : "Look it up"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">We only open this link when you press "Look it up", to try to fill in the title, description, salary, and company site for you.</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ij-desc">The job description</Label>
              <Textarea
                id="ij-desc"
                value={description}
                onChange={(e) => onDescriptionChange(e.target.value)}
                rows={8}
                placeholder="Copy the whole description from the employer's page and paste it here. The more of it, the better we can match your resume to it."
                aria-describedby="ij-desc-help"
              />
              <p id="ij-desc-help" className={cn("text-xs", chars > 0 && chars < MIN_DESCRIPTION ? "text-warning" : "text-muted-foreground")}>
                {chars === 0
                  ? "Paste it here, or use \"Look it up\" above."
                  : chars < MIN_DESCRIPTION
                    ? `${chars} characters so far. Paste the whole description, not just a line or two.`
                    : `${chars.toLocaleString()} characters. That is plenty.`}
              </p>
            </div>

            <div>
              <button type="button" onClick={() => setShowMore((v) => !v)} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                {showMore ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                Salary, company site, and notes about the employer <span className="font-normal text-muted-foreground">(optional)</span>
              </button>
              {showMore && (
                <div className="mt-3 space-y-3 rounded-lg border bg-muted/20 p-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="ij-sal-min">Salary, low end</Label>
                      <Input id="ij-sal-min" value={salaryMin} onChange={(e) => setSalaryMin(e.target.value.replace(/[^\d]/g, ""))} placeholder="65000" inputMode="numeric" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="ij-sal-max">Salary, high end</Label>
                      <Input id="ij-sal-max" value={salaryMax} onChange={(e) => setSalaryMax(e.target.value.replace(/[^\d]/g, ""))} placeholder="80000" inputMode="numeric" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ij-website">Company website</Label>
                    <Input id="ij-website" value={companyWebsite} onChange={(e) => setCompanyWebsite(e.target.value)} placeholder="https://" inputMode="url" autoComplete="off" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ij-about">About the employer</Label>
                    <Textarea id="ij-about" value={employerAbout} onChange={(e) => setEmployerAbout(e.target.value.slice(0, 2000))} rows={3} placeholder="A line or two on what the company does." />
                  </div>
                </div>
              )}
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Where does this stand?</legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Where this application stands">
                {STAGES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    role="radio"
                    aria-checked={stage === s.id}
                    onClick={() => setStage(s.id)}
                    className={cn("rounded-lg border p-2.5 text-left transition-colors", stage === s.id ? "border-primary bg-primary-soft" : "hover:border-primary/40")}
                  >
                    <span className={cn("block text-sm font-medium", stage === s.id && "text-primary")}>{s.label}</span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">{s.hint}</span>
                  </button>
                ))}
              </div>
              {stage !== "saved" && (
                <div className="max-w-[220px] space-y-1.5 pt-1">
                  <Label htmlFor="ij-date">When did you apply?</Label>
                  <Input id="ij-date" type="date" value={appliedOn} max={today()} onChange={(e) => setAppliedOn(e.target.value)} />
                  {!dateOk && <p className="text-xs text-warning">That date is in the future.</p>}
                </div>
              )}
            </fieldset>

            {error && (
              <p role="alert" className="rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm">
                {error}
              </p>
            )}

            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" variant="ghost" disabled={!!busy} onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="outline" disabled={!ready || !!busy}>
                {busy && <Loader2 className="animate-spin" />}
                {busy ?? "Add to my tracker"}
              </Button>
              <Button type="button" disabled={!ready || !!busy} onClick={() => void submit("tailor")}>
                Add and tailor my resume <ArrowRight />
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
