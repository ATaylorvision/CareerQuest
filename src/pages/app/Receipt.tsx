import { useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, BadgeCheck, Building2, CalendarPlus, Camera, Clock, Download, ExternalLink, FileText, Globe, Mail, PenLine, Plus, Upload } from "lucide-react";
import { Card, CompanyLogo, EmptyState, SectionTitle } from "@/components/common";
import { MethodBadge, Pill, TONE_BG, VerifiedMark } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useStore } from "@/store/AppStore";
import { COLUMNS, EVENT_META, type Column, type EventType } from "@/data/applications";
import { jobById } from "@/data/jobs";
import { changesForJob } from "@/lib/selectors";
import { buildResume, downloadText, resumeToText } from "@/lib/resumeBuild";
import { fmtDate, fmtDateTime } from "@/lib/date";
import { fireConfetti } from "@/lib/confetti";
import { useDocTitle } from "@/hooks/useDocTitle";
import { cn } from "@/lib/utils";
import { api, fileToBase64 } from "@/live/api";

const EVENT_COLUMN: Partial<Record<EventType, Column>> = { review: "applied", screen: "screening", interview: "interview", offer: "offer", rejected: "closed", noresponse: "closed" };

/** Rebuild the exact document for a saved version. */
function resumeForVersion(versionId: string, changeIds?: string[]) {
  if (versionId === "v-base") return buildResume([], {});
  if (versionId === "v-supply") {
    const ch = changesForJob(jobById("j01")!);
    return buildResume(ch, Object.fromEntries(["c1", "c3", "c4", "c5", "c7", "c8", "c9"].map((id) => [id, "accepted"])));
  }
  if (versionId === "v-program") {
    const ch = changesForJob(jobById("j14")!);
    return buildResume(ch, Object.fromEntries(ch.map((c) => [c.id, "accepted"])));
  }
  const jobId = versionId.replace("v-", "");
  const job = jobById(jobId);
  if (!job) return buildResume([], {});
  const ch = changesForJob(job);
  return buildResume(ch, Object.fromEntries((changeIds ?? []).map((id) => [id, "accepted"])));
}

function ConfirmationShot({ code, company, at, initials, hue, verified, upload, real }: { code?: string; company: string; at: string | null; initials: string; hue: number; verified: boolean; upload?: string; real?: boolean }) {
  if (real && verified) {
    return (
      <div className="rounded-lg border border-success-border bg-success-soft p-4 text-sm">
        <div className="font-semibold text-success">Evidence checked</div>
        <p className="mt-1 text-foreground/85">{upload || "Confirmation you provided"}</p>
        {code && <p className="mt-2 text-xs text-muted-foreground">Reference on the confirmation: <span className="font-mono text-foreground">{code}</span></p>}
        <p className="mt-2 text-xs text-muted-foreground">You supplied this and we read it to make sure it confirms an application to {company}. We keep the file private to you.</p>
      </div>
    );
  }
  if (!verified) {
    return (
      <div className="flex aspect-[4/3] flex-col items-center justify-center rounded-lg border-2 border-dashed bg-muted/30 p-6 text-center">
        <Camera className="mb-2 h-8 w-8 text-muted-foreground/60" />
        <div className="text-sm font-medium">No confirmation yet</div>
        <p className="mt-1 text-xs text-muted-foreground">Add the confirmation email or a screenshot to verify this application.</p>
      </div>
    );
  }
  return (
    <figure className="overflow-hidden rounded-lg border bg-white text-neutral-900 shadow-sm">
      <div className="flex items-center gap-1.5 border-b bg-neutral-100 px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-neutral-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-neutral-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-neutral-300" />
        <span className="ml-2 flex-1 truncate rounded bg-white px-2 py-0.5 text-[10px] text-neutral-500">{upload ? upload : `${company.toLowerCase().replace(/[^a-z]+/g, "")} careers, application submitted`}</span>
      </div>
      <div className="p-5 text-center">
        <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-md text-xs font-bold" style={{ background: `hsl(${hue} 55% 92%)`, color: `hsl(${hue} 50% 28%)` }}>
          {initials}
        </div>
        <div className="text-sm font-semibold">{upload ? "Confirmation email" : "Thank you for applying"}</div>
        <p className="mt-1 text-[11px] text-neutral-600">We received your application and will be in touch if there is a fit.</p>
        {code && (
          <div className="mx-auto mt-3 inline-block rounded border border-neutral-200 bg-neutral-50 px-2.5 py-1 font-mono text-[11px]">
            Reference {code}
          </div>
        )}
        {at && <div className="mt-2 text-[10px] text-neutral-500">{fmtDateTime(at)}</div>}
      </div>
      <figcaption className="border-t bg-neutral-50 px-3 py-1.5 text-[10px] text-neutral-500">Screenshot placeholder, captured at submission</figcaption>
    </figure>
  );
}

export default function Receipt() {
  const { id = "" } = useParams();
  const { state, update } = useStore();
  const app = state.applications.find((a) => a.id === id);
  const job = app ? jobById(app.jobId) : undefined;
  useDocTitle(job ? `Receipt: ${job.company.name}` : "Receipt");
  const fileRef = useRef<HTMLInputElement>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailText, setEmailText] = useState("");

  if (!app || !job) {
    return <EmptyState icon={FileText} title="Receipt not found" body="It may belong to an application that was removed." action={<Button asChild><Link to="/app/tracker">Back to tracker</Link></Button>} />;
  }

  const r = app.receipt;
  const version = r ? state.resume.versions.find((v) => v.id === r.resumeVersionId) : undefined;
  const resumeDoc = r ? resumeForVersion(r.resumeVersionId, version?.changeIds) : null;
  const column = COLUMNS.find((c) => c.id === app.column)!;
  const events = [...app.events].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  const addEvent = (type: EventType, n?: string) => {
    update((s) => {
      const a = s.applications.find((x) => x.id === app.id)!;
      a.events.push({ id: `e${Date.now()}`, type, at: new Date().toISOString(), note: n });
      const col = EVENT_COLUMN[type];
      if (col && col !== a.column) a.column = col;
      if (type === "viewed" && a.column === "saved") a.column = "applied";
    });
    toast.success(`Logged: ${EVENT_META[type].label}`);
  };

  const verify = (source: string, upload: string, reference?: string) => {
    update((s) => {
      const a = s.applications.find((x) => x.id === app.id)!;
      a.receipt!.confirmation = { verified: true, code: job.live ? reference || undefined : (a.receipt!.confirmation.code ?? `${job.company.initials}-${Math.floor(10000 + Math.random() * 89999)}`), source, userUpload: upload };
      if (!a.receipt!.submittedAt) a.receipt!.submittedAt = new Date().toISOString();
      if (a.column === "saved") a.column = "applied";
      a.events.push({ id: `e${Date.now()}`, type: "confirmed", at: new Date().toISOString(), note: source });
      a.nextStep = "Verified. Most employers respond within 7 to 10 business days.";
      if (!s.confettiShown) s.confettiShown = true;
    });
    if (!state.confettiShown) fireConfetti();
    toast.success("Verified", { description: "This application now counts toward your Proof Score." });
  };

  const [checking, setChecking] = useState(false);
  // Real accounts: Claude reads the evidence and decides whether it confirms this application.
  const checkEvidence = async (payload: { text?: string; file?: File }, label: string) => {
    setChecking(true);
    try {
      const body = payload.file
        ? { company: job.company.name, title: job.title, fileName: payload.file.name, mime: payload.file.type, data: await fileToBase64(payload.file) }
        : { company: job.company.name, title: job.title, text: payload.text };
      const res = await api<{ ok: boolean; reason: string; reference: string }>("receipt/verify", body);
      if (!res.ok) {
        toast.error("That does not confirm this application", { description: res.reason });
        return false;
      }
      verify(payload.file ? "Checked from a file you uploaded" : "Checked from the email you pasted", label, res.reference);
      return true;
    } catch (e) {
      toast.error("We could not check that", { description: (e as Error).message });
      return false;
    } finally {
      setChecking(false);
    }
  };

  const markSubmitted = () =>
    update((s) => {
      const a = s.applications.find((x) => x.id === app.id)!;
      a.receipt!.submittedAt = new Date().toISOString();
      a.column = "applied";
      a.events.push({ id: `e${Date.now()}`, type: "submitted", at: new Date().toISOString(), note: "You marked this as submitted on the employer's portal." });
    });

  const downloadReceipt = () => {
    if (!r) return;
    const lines = [
      `CAREERQUEST RECEIPT`,
      `${job.title} at ${job.company.name}`,
      `Status: ${column.label}`,
      `How it was sent: ${r.method === "submitted" ? "Submitted by CareerQuest" : r.method === "prefilled" ? "Prefilled, you submitted" : "Manual required"}`,
      `Destination: ${r.destinationLabel}`,
      `Submitted: ${r.submittedAt ? fmtDateTime(r.submittedAt) : "Not yet"}`,
      `Confirmation: ${r.confirmation.verified ? r.confirmation.code + " (" + r.confirmation.source + ")" : "Not verified"}`,
      "",
      "TIMELINE",
      ...events.map((e) => `${fmtDateTime(e.at)}  ${EVENT_META[e.type].label}${e.note ? " - " + e.note : ""}${e.future ? " (scheduled)" : ""}`),
      "",
      "FORM ANSWERS",
      ...r.fields.map((f) => `${f.q}: ${f.a}`),
      "",
      "COVER LETTER SENT",
      r.coverLetter,
      "",
      "RESUME SENT",
      resumeDoc ? resumeToText(resumeDoc) : "",
    ];
    downloadText(`Receipt_${job.company.name.replace(/\W+/g, "_")}.txt`, lines.join("\n"));
    toast.success("Receipt downloaded");
  };

  return (
    <div>
      <Link to="/app/tracker" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Tracker
      </Link>

      <Card className="mb-6">
        <div className="flex flex-col gap-5 md:flex-row md:items-start">
          <CompanyLogo company={job.company} size={56} />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Application receipt</div>
            <h1 className="mt-0.5 font-display text-2xl font-semibold leading-tight sm:text-3xl">{job.title}</h1>
            <div className="mt-1 text-sm text-muted-foreground">
              {job.company.name} · {job.location}
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {r ? <MethodBadge method={r.method} /> : <Pill tone="muted">Not sent yet</Pill>}
              {r?.submittedAt && <VerifiedMark verified={r.confirmation.verified} />}
              <Pill tone="primary">Status: {column.label}</Pill>
              {r && (
                <Pill tone={r.destination === "company" ? "success" : "info"} icon={r.destination === "company" ? Building2 : Globe}>
                  {r.destination === "company" ? "Direct: company careers page" : "Third party job board"}
                </Pill>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Plus /> Log an update
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {(["viewed", "review", "screen", "interview", "offer", "rejected", "noresponse"] as EventType[]).map((t) => (
                  <DropdownMenuItem key={t} onSelect={() => addEvent(t)}>
                    <span className={cn("mr-2 h-2 w-2 rounded-full", TONE_BG[EVENT_META[t].tone])} />
                    {EVENT_META[t].label}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuItem onSelect={() => setNoteOpen(true)}>
                  <PenLine className="mr-2 h-4 w-4" /> Add a note
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {r && (
              <Button variant="outline" size="sm" onClick={downloadReceipt}>
                <Download /> Download
              </Button>
            )}
          </div>
        </div>
        {r && (
          <dl className="mt-5 grid grid-cols-1 gap-4 border-t pt-5 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-xs text-muted-foreground">Submitted</dt>
              <dd className="mt-0.5 font-medium">{r.submittedAt ? fmtDateTime(r.submittedAt) : "Not yet"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Destination</dt>
              <dd className="mt-0.5 font-medium">{r.destinationLabel}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Confirmation</dt>
              <dd className="num mt-0.5 font-medium">{r.confirmation.verified ? r.confirmation.code : "Not verified"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Resume version</dt>
              <dd className="mt-0.5 font-medium">{version?.name ?? "Deleted version (copy kept below)"}</dd>
            </div>
          </dl>
        )}
      </Card>

      {r?.method === "manual" && !r.confirmation.verified && (
        <div className="mb-6 rounded-xl border border-warning-border bg-warning-soft p-5">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
            <div className="flex-1">
              <h2 className="font-semibold text-warning">Manual required</h2>
              <p className="mt-1 text-sm text-foreground/85">{job.manualReason}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" className="bg-background" onClick={() => (job.live && job.applyUrl ? window.open(job.applyUrl, "_blank", "noopener,noreferrer") : toast("Opening the employer's portal", { description: `In the real product this opens the ${job.company.name} application page directly.` }))}>
                  <ExternalLink /> Open {job.company.name} portal
                </Button>
                {!r.submittedAt && (
                  <Button size="sm" variant="outline" className="bg-background" onClick={markSubmitted}>
                    I submitted it
                  </Button>
                )}
                <Button size="sm" onClick={() => fileRef.current?.click()}>
                  <Upload /> Upload confirmation screenshot
                </Button>
                <Button size="sm" variant="outline" className="bg-background" onClick={() => setEmailOpen(true)}>
                  <Mail /> Paste confirmation email
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,.pdf,.eml,.txt"
                  className="sr-only"
                  aria-label="Upload confirmation"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    if (job.live) void checkEvidence({ file: f }, f.name);
                    else verify(`You uploaded ${f.name}`, f.name);
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {!r && (
        <Card className="mb-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <p className="flex-1 text-sm text-muted-foreground">This role is saved but not sent. When you apply, the receipt fills in here automatically.</p>
          <Button asChild>
            <Link to={`/app/jobs/${job.id}?apply=1`}>Apply now</Link>
          </Button>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <SectionTitle icon={Clock} sub="Everything that has happened, in order.">Timeline</SectionTitle>
            <ol className="relative ml-2 border-l-2 border-muted pl-6">
              {events.map((e) => {
                const m = EVENT_META[e.type];
                return (
                  <li key={e.id} className={cn("relative pb-5 last:pb-0", e.future && "opacity-80")}>
                    <span className={cn("absolute -left-[33px] top-1 flex h-4 w-4 items-center justify-center rounded-full ring-4 ring-card", e.future ? "border-2 border-dashed border-primary bg-card" : TONE_BG[m.tone])} aria-hidden />
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-medium">{m.label}</span>
                      <span className="text-xs text-muted-foreground">{e.future ? `Scheduled for ${fmtDate(e.at, { weekday: "long", month: "short", day: "numeric" })}` : fmtDateTime(e.at)}</span>
                    </div>
                    {e.note && <p className="mt-0.5 text-sm text-muted-foreground">{e.note}</p>}
                  </li>
                );
              })}
            </ol>
            <div className="mt-5 flex flex-wrap gap-2 border-t pt-4">
              <Button size="xs" variant="outline" onClick={() => addEvent("viewed")}>Viewed by employer</Button>
              <Button size="xs" variant="outline" onClick={() => addEvent("review")}>Moved to review</Button>
              <Button size="xs" variant="outline" onClick={() => addEvent("rejected")}>Rejected</Button>
              <Button size="xs" variant="outline" onClick={() => addEvent("noresponse")}>No response after 14 days</Button>
              <Button size="xs" variant="ghost" onClick={() => setNoteOpen(true)}>
                <CalendarPlus /> Note
              </Button>
            </div>
          </Card>

          {r && (
            <Accordion type="multiple" defaultValue={["fields"]} className="space-y-4">
              <AccordionItem value="resume" className="card-base border px-5">
                <AccordionTrigger className="hover:no-underline">
                  <span className="flex items-center gap-2 text-left">
                    <FileText className="h-4 w-4 text-primary" /> Exact resume sent: <span className="font-normal text-muted-foreground">{version?.name}</span>
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  {resumeDoc && <pre className="max-h-[480px] overflow-auto whitespace-pre-wrap rounded-lg bg-muted/40 p-4 font-sans text-[13px] leading-relaxed scrollbar-thin">{resumeToText(resumeDoc)}</pre>}
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="letter" className="card-base border px-5">
                <AccordionTrigger className="hover:no-underline">
                  <span className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-primary" /> Exact cover letter sent
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="whitespace-pre-line rounded-lg bg-muted/40 p-4 text-sm leading-relaxed">{r.coverLetter}</div>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="fields" className="card-base border px-5">
                <AccordionTrigger className="hover:no-underline">
                  <span className="flex items-center gap-2">
                    <PenLine className="h-4 w-4 text-primary" /> Every form field and the answer given ({r.fields.length})
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <table className="w-full table-fixed text-sm">
                    <caption className="sr-only">Form answers submitted</caption>
                    <tbody className="divide-y">
                      {r.fields.map((f) => (
                        <tr key={f.q} className="align-top">
                          <th scope="row" className="w-1/2 py-2.5 pr-4 text-left font-normal text-muted-foreground">{f.q}</th>
                          <td className="py-2.5 font-medium [overflow-wrap:anywhere]">{f.a}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}
        </div>

        <div className="space-y-6">
          {r && (
            <Card>
              <SectionTitle icon={BadgeCheck} sub={r.confirmation.verified ? r.confirmation.source : "Not verified yet"}>Confirmation</SectionTitle>
              <ConfirmationShot code={r.confirmation.code} company={job.company.name} at={r.submittedAt} initials={job.company.initials} hue={job.company.hue} verified={r.confirmation.verified} upload={r.confirmation.userUpload} real={job.live} />
              {!r.confirmation.verified && r.method !== "manual" && (
                <div className="mt-3 flex flex-col gap-2">
                  <Button size="sm" onClick={() => fileRef.current?.click()}>
                    <Upload /> Upload confirmation
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEmailOpen(true)}>
                    <Mail /> Paste confirmation email
                  </Button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*,.pdf,.eml,.txt"
                    className="sr-only"
                    aria-label="Upload confirmation"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      if (job.live) void checkEvidence({ file: f }, f.name);
                      else verify(`You uploaded ${f.name}`, f.name);
                    }}
                  />
                </div>
              )}
            </Card>
          )}
          <Card>
            <SectionTitle>Where it went</SectionTitle>
            <dl className="space-y-2.5 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Listing source</dt>
                <dd className="text-right">{job.source}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Legitimacy at apply</dt>
                <dd className="num">{job.legit.score} / 100</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Cover letter</dt>
                <dd>{r?.coverLetter.startsWith("(No") ? "Not included" : "Included"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Saved to tracker</dt>
                <dd>{fmtDate(app.savedAt, { month: "short", day: "numeric", year: "numeric" })}</dd>
              </div>
            </dl>
            <div className="mt-4 flex flex-col gap-2">
              <Button asChild variant="outline" size="sm">
                <Link to={`/app/jobs/${job.id}`}>Open the job posting</Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link to="/app/interview">Prepare for the next step</Link>
              </Button>
            </div>
          </Card>
        </div>
      </div>

      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a note</DialogTitle>
            <DialogDescription>Call notes, names, what they asked. It goes on the timeline.</DialogDescription>
          </DialogHeader>
          <Label htmlFor="note" className="sr-only">Note</Label>
          <Textarea id="note" rows={5} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Recruiter asked about WMS experience and my availability. Hiring manager decision next week." />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNoteOpen(false)}>Cancel</Button>
            <Button
              disabled={!note.trim()}
              onClick={() => {
                addEvent("note", note.trim());
                setNote("");
                setNoteOpen(false);
              }}
            >
              Save note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Paste the confirmation email</DialogTitle>
            <DialogDescription>We look for the employer name and a reference number. The text stays on this receipt.</DialogDescription>
          </DialogHeader>
          <Textarea rows={6} value={emailText} onChange={(e) => setEmailText(e.target.value)} placeholder={`Thank you for applying to ${job.company.name}. Your application reference is ...`} aria-label="Confirmation email text" />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEmailOpen(false)}>Cancel</Button>
            <Button
              disabled={emailText.trim().length < 20 || checking}
              onClick={async () => {
                if (job.live) {
                  const ok = await checkEvidence({ text: emailText }, "Pasted confirmation email");
                  if (!ok) return;
                } else {
                  verify("Confirmation email matched", "Pasted confirmation email");
                }
                setEmailOpen(false);
                setEmailText("");
              }}
            >
              {checking ? "Checking" : "Verify"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
