import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowRight, CheckCheck, Download, FileDown, Languages, PenLine, Printer, RotateCcw, Save, Sparkles } from "lucide-react";
import { AiWorking, Card, PageHeader, Segmented, SkeletonLines } from "@/components/common";
import { Pill } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ResumeDocument } from "@/components/studio/ResumeDocument";
import { ChangeCard, GapsPanel, TranslatorPanel, VersionsPanel } from "@/components/studio/panels";
import { AtsScorePanel, KeywordPanel } from "@/components/studio/AtsPanels";
import { TemplatePicker } from "@/components/TemplatePicker";
import { useStore } from "@/store/AppStore";
import { JOBS, jobById } from "@/data/jobs";
import type { TailorChange } from "@/data/resumeStudio";
import { changesForJob, FREE_LIMITS, isPro } from "@/lib/selectors";
import { scoreResume } from "@/lib/ats";
import { useJobKeywords } from "@/hooks/useJobKeywords";
import { buildResume, downloadText, printResume, resumeToText } from "@/lib/resumeBuild";
import { RESUME_TEMPLATES, renderResumeHtml } from "@/data/resumeTemplates";
import { api, ApiError } from "@/live/api";
import { supabase } from "@/live/supabase";
import { useSessionState } from "@/hooks/useSessionState";
import { useDocTitle } from "@/hooks/useDocTitle";
import CoverLetter from "./CoverLetter";

type Doc = "resume" | "letter";

export default function Studio() {
  useDocTitle("Studio");
  const { state, update } = useStore();
  const [params, setParams] = useSearchParams();
  const pro = isPro(state);
  const jobId = params.get("job") ?? state.resume.jobId;
  const job = jobById(jobId) ?? JOBS[0];
  const live = state.mode === "live";

  const [doc, setDoc] = useSessionState<Doc>("studio-doc", "resume");
  const [liveChanges, setLiveChanges] = useSessionState<Record<string, TailorChange[]>>("live-changes", {});
  const demoChanges = useMemo(() => (live ? [] : changesForJob(job)), [live, job]);
  const changes = live ? (liveChanges[job.id] ?? []) : demoChanges;
  const decisions = state.resume.decisions;
  const [analyzed, setAnalyzed] = useSessionState<string[]>("analyzed", ["j01"]);
  const [working, setWorking] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [showLayouts, setShowLayouts] = useState(false);

  useEffect(() => {
    if (state.resume.jobId !== job.id) update((s) => void (s.resume.jobId = job.id));
  }, [job.id, state.resume.jobId, update]);

  // Arriving from setup with the free tailored resume already claimed: run it
  // once, on its own, so the page is working before they have to ask.
  const autoTailor = params.get("tailor") === "1";
  const kicked = useRef(false);
  useEffect(() => {
    if (!autoTailor || kicked.current) return;
    kicked.current = true;
    setParams({ job: job.id }, { replace: true });
    setDoc("resume");
    if (!liveChanges[job.id] && !analyzed.includes(job.id)) void startTailor();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoTailor]);

  const isAnalyzed = live ? !!liveChanges[job.id] : analyzed.includes(job.id);
  const freeLeft = FREE_LIMITS.tailoredResumes - state.usage.tailoredResumes;
  const accepted = changes.filter((c) => decisions[c.id] === "accepted").length;
  const pending = changes.filter((c) => !decisions[c.id]).length;

  const edits = state.resume.edits?.[job.id] ?? {};
  const contact = state.resume.contact ?? {};
  const added = state.resume.added?.[job.id];
  const built = useMemo(() => buildResume(changes, decisions, { fields: edits, contact, added }), [changes, decisions, edits, contact, added]);

  // What is being typed right now, before it is committed. The score reads it so
  // it follows every keystroke, while the page itself only changes on commit.
  const [draft, setDraft] = useState<Record<string, string>>({});
  const drafted = useDeferredValue(draft);
  const scored = useMemo(() => {
    if (!Object.keys(drafted).length) return built;
    const fields = { ...edits };
    const c = { ...contact } as Record<string, string>;
    for (const [k, v] of Object.entries(drafted)) {
      if (k.startsWith("contact.")) c[k.slice(8)] = v;
      else fields[k] = v;
    }
    return buildResume(changes, decisions, { fields, contact: c, added });
  }, [built, drafted, changes, decisions, edits, contact, added]);

  const pasted = state.resume.postingText?.[job.id];
  const { keywords: postingKeywords, source: kwSource, loading: kwLoading, excerpt } = useJobKeywords(job, { live, pasted });
  const ats = useMemo(() => scoreResume(scored, postingKeywords), [scored, postingKeywords]);
  const savedVersion = state.resume.versions.find((v) => v.id === `v-${job.id}`);
  const touched = accepted > 0 || Object.keys(edits).length > 0;

  /* ---------------- editing the document itself ---------------- */

  const editField = (fieldId: string, value: string) =>
    update((s) => {
      if (!s.resume.edits) s.resume.edits = {};
      if (!s.resume.edits[job.id]) s.resume.edits[job.id] = {};
      s.resume.edits[job.id][fieldId] = value;
    });

  // Name and contact details are the same person on every application, so these
  // are written back to the account rather than kept with one version.
  const editContact = (field: "name" | "email" | "phone" | "location", value: string) =>
    update((s) => {
      if (!s.resume.contact) s.resume.contact = {};
      s.resume.contact[field] = value;
      if (field === "name") s.profile.name = value;
      if (field === "location") s.profile.location = value;
    });

  const revertEdits = () =>
    update((s) => {
      if (s.resume.edits) delete s.resume.edits[job.id];
      if (s.resume.added) delete s.resume.added[job.id];
    });

  const onLive = (fieldId: string, text: string | null) =>
    setDraft((d) => {
      if (text === null) {
        if (!(fieldId in d)) return d;
        const { [fieldId]: _gone, ...rest } = d;
        return rest;
      }
      return d[fieldId] === text ? d : { ...d, [fieldId]: text };
    });

  /** Scrolls to a line on the document and puts the cursor in it. */
  const jumpTo = (field?: string) => {
    if (!field) return;
    setDoc("resume");
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(`[data-field="${CSS.escape(field)}"]`);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.focus({ preventScroll: true });
    });
  };

  // Lines and skills the person confirmed with "Have you done this?". They go in
  // exactly as written, and land on the page ready to be edited.
  const addLine = (roleId: string, text: string) => {
    const id = `add-${Date.now().toString(36)}`;
    update((s) => {
      if (!s.resume.added) s.resume.added = {};
      if (!s.resume.added[job.id]) s.resume.added[job.id] = {};
      (s.resume.added[job.id][roleId] ??= []).push({ id, text });
    });
    toast.success("Added to your resume", { description: "It is your own wording. Edit it on the page if you like." });
    setTimeout(() => jumpTo(id), 60);
  };
  const addSkill = (term: string) => {
    editField("skills", [...built.skills, term].join(", "));
    toast.success(`Added "${term}" to your skills`);
    setTimeout(() => jumpTo("skills"), 60);
  };
  const setPosting = (text: string | null) =>
    update((s) => {
      if (!s.resume.postingText) s.resume.postingText = {};
      // Capped so a huge paste cannot bloat the saved working state.
      if (text) s.resume.postingText[job.id] = text.slice(0, 20000);
      else delete s.resume.postingText[job.id];
    });

  /* ---------------- tailoring ---------------- */

  const decide = (id: string, d: "accepted" | "rejected" | null) =>
    update((s) => {
      if (d) s.resume.decisions[id] = d;
      else delete s.resume.decisions[id];
    });

  const acceptAll = () =>
    update((s) => {
      changes.forEach((c) => {
        if (!s.resume.decisions[c.id]) s.resume.decisions[c.id] = "accepted";
      });
    });

  const startTailor = async () => {
    setFailed(null);
    setWorking(true);
    if (!live) return; // the demo runs on a timer inside AiWorking
    try {
      const out = await api<{ changes: TailorChange[] }>("studio", { action: "tailor", jobId: job.id });
      if (!out.changes.length) {
        setFailed("We could not find a change worth making from this posting. Your resume may already line up well, or the posting may be too thin to read.");
      } else {
        setLiveChanges((m) => ({ ...m, [job.id]: out.changes }));
      }
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : "Something went wrong. Please try again.");
    } finally {
      setWorking(false);
    }
  };

  const saveVersion = async () => {
    const name = `${job.title}, ${job.company.name.replace(/ (Co\.|Inc\.)$/, "")}`;
    if (live && supabase) {
      const uid = (await supabase.auth.getUser()).data.user?.id;
      if (uid) {
        const { error } = await supabase.from("resume_versions").upsert(
          {
            user_id: uid,
            job_id: job.id,
            name,
            target: `${job.title} at ${job.company.name}`,
            content: built as unknown as Record<string, unknown>,
            changes: changes.map((c) => ({ ...c, decision: decisions[c.id] ?? "pending" })),
            ats_score: ats.total,
          },
          { onConflict: "user_id,job_id" },
        );
        if (error) {
          toast.error("We could not save that version", { description: "Your changes are still here. Please try again." });
          return;
        }
      }
    }
    const ownEdits = Object.keys(edits).length;
    const note = [accepted ? `${accepted} suggested change${accepted === 1 ? "" : "s"} kept` : "", ownEdits ? `${ownEdits} line${ownEdits === 1 ? "" : "s"} you wrote yourself` : ""].filter(Boolean).join(", ") || "No changes yet.";
    update((s) => {
      const existing = s.resume.versions.find((v) => v.id === `v-${job.id}`);
      if (existing) {
        existing.ats = ats.total;
        existing.note = `${note}.`;
        existing.changeIds = changes.filter((c) => decisions[c.id] === "accepted").map((c) => c.id);
      } else {
        s.resume.versions.push({
          id: `v-${job.id}`,
          name,
          target: `${job.title} at ${job.company.name}`,
          ats: ats.total,
          createdDaysAgo: 0,
          sends: 0,
          responses: 0,
          note: `${note}.`,
          changeIds: changes.filter((c) => decisions[c.id] === "accepted").map((c) => c.id),
        });
        s.usage.tailoredResumes += 1;
        if (!s.resume.tailoredJobs.includes(job.id)) s.resume.tailoredJobs.push(job.id);
        if (job.id === "j01") {
          s.planDone.p3 = true;
          s.activity[0] = true;
        }
      }
    });
    toast.success(savedVersion ? "Version updated" : "Saved as a new version", { description: `${name}. ATS ${ats.total}. Ready to attach when you apply.` });
  };

  const jobOptions = useMemo(() => {
    const tracked = state.applications.map((a) => a.jobId);
    const ids = Array.from(new Set([job.id, ...tracked, ...JOBS.filter((j) => j.match >= 85).map((j) => j.id)]));
    return ids.map((id) => jobById(id)!).filter((j) => j && j.legit.badge !== "ghost");
  }, [state.applications, job.id]);

  const fileBase = `${built.name.replace(/\s+/g, "_")}_${job.company.name.split(" ")[0]}`;

  return (
    <div>
      <PageHeader
        title="Studio"
        sub="Your resume and cover letter for one job, on one page. Type anywhere on the document to change it."
        actions={
          <>
            {doc === "resume" && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download /> Download
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={() => {
                    if (!printResume(built, fileBase, state.resume.templateId, state.profile.headline))
                      toast.error("Your browser blocked the print window. Allow pop ups and try again.");
                  }}
                >
                  <Printer className="mr-2 h-4 w-4" /> PDF (print to PDF)
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    downloadText(`${fileBase}_Resume.txt`, resumeToText(built));
                    toast.success("Plain text resume downloaded");
                  }}
                >
                  <FileDown className="mr-2 h-4 w-4" /> Plain text (.txt)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            )}
          </>
        }
      />

      <Card className="mb-5 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="min-w-0 flex-1">
            <label htmlFor="job-pick" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Working on
            </label>
            <Select value={job.id} onValueChange={(v) => setParams({ job: v })}>
              <SelectTrigger id="job-pick" className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {jobOptions.map((j) => (
                  <SelectItem key={j.id} value={j.id}>
                    {j.title} · {j.company.name} · {j.match}% match
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Segmented<Doc>
              value={doc}
              onChange={setDoc}
              options={[
                { value: "resume", label: "Resume" },
                { value: "letter", label: "Cover letter" },
              ]}
            />
            {!pro && doc === "resume" && (
              <Pill tone={freeLeft > 0 ? "muted" : "danger"}>
                <span className="num">{Math.max(0, freeLeft)}</span> of 3 free tailored resumes left
              </Pill>
            )}
            <Button asChild variant="ghost" size="sm">
              <Link to={`/app/jobs/${job.id}`}>
                View posting <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
      </Card>

      {doc === "letter" ? (
        <CoverLetter embedded />
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          {/* ---------------- the document ---------------- */}
          <div className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
              <p>
                <PenLine className="mr-1.5 inline h-4 w-4" aria-hidden />
                Click any line to rewrite it. Empty a line to remove it.
              </p>
              <div className="flex gap-2">
                <Button variant="ghost" size="xs" onClick={() => setShowLayouts((v) => !v)}>
                  {showLayouts ? "Hide layouts" : "Change layout"}
                </Button>
                {Object.keys(edits).length > 0 && (
                  <Button variant="ghost" size="xs" onClick={revertEdits}>
                    <RotateCcw /> Undo my edits
                  </Button>
                )}
              </div>
            </div>

            {showLayouts && (
              <div className="card-base p-5">
                <TemplatePicker
                  label="Page layout"
                  items={RESUME_TEMPLATES.map((t) => ({
                    id: t.id,
                    name: t.name,
                    blurb: t.blurb,
                    bestFor: t.bestFor,
                    html: renderResumeHtml(built, t.id, t.name, state.profile.headline),
                  }))}
                  value={state.resume.templateId}
                  onChange={(id) => update((d) => void (d.resume.templateId = id))}
                />
              </div>
            )}

            <ResumeDocument r={built} onEdit={editField} onContactEdit={editContact} onLive={onLive} />

            <div className="z-10 flex flex-col gap-3 rounded-xl border bg-background/95 p-4 shadow-lift backdrop-blur sm:flex-row sm:items-center xl:sticky xl:bottom-4">
              <div className="flex-1 text-sm">
                {touched ? (
                  <>
                    This version has <b className="num">{accepted}</b> kept suggestion{accepted === 1 ? "" : "s"} and <b className="num">{Object.keys(edits).length}</b> line{Object.keys(edits).length === 1 ? "" : "s"} in your own words.
                  </>
                ) : (
                  "Use a suggestion or type on the document, then save it as a version."
                )}
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  if (!printResume(built, fileBase, state.resume.templateId, state.profile.headline)) toast.error("Your browser blocked the print window. Allow pop ups and try again.");
                }}
              >
                <Printer /> Download PDF
              </Button>
              <Button disabled={!touched} onClick={() => void saveVersion()}>
                <Save /> {savedVersion ? "Update version" : "Save as new version"}
              </Button>
            </div>
          </div>

          {/* ---------------- everything about this version ---------------- */}
          <div className="space-y-4 xl:sticky xl:top-20 xl:self-start">
            <Card className="p-4">
              <h2 className="mb-3 text-sm font-semibold">ATS score</h2>
              <AtsScorePanel result={ats} onJump={jumpTo} hasJob={!!job} />
            </Card>

            <Card className="p-4">
              <h2 className="mb-3 text-sm font-semibold">Keywords in this posting</h2>
              <KeywordPanel
                results={ats.keywords}
                source={kwSource}
                loading={kwLoading}
                excerpt={excerpt}
                roles={built.roles.map((r) => ({ id: r.id, title: r.title, company: r.company }))}
                onJump={jumpTo}
                onAddLine={addLine}
                onAddSkill={addSkill}
                pasted={!!pasted}
                onPaste={setPosting}
                onClearPaste={() => setPosting(null)}
              />
            </Card>

            <Card className="p-0 sm:p-0">
              <Accordion type="single" collapsible defaultValue="tailor">
                <AccordionItem value="tailor" className="border-b-0">
                  <AccordionTrigger className="px-4 text-sm font-semibold hover:no-underline">
                    Suggestions{changes.length > 0 && <span className="ml-1 font-normal text-muted-foreground">({pending} waiting)</span>}
                  </AccordionTrigger>
                  <AccordionContent className="px-4">
                    {working ? (
                      live ? (
                        <SkeletonLines lines={6} />
                      ) : (
                        <AiWorking
                          title={`Tailoring for ${job.title}`}
                          stepMs={650}
                          steps={["Reading the posting", "Comparing it against every line", "Finding lines to reorder and reword", "Checking each one against your original", "Setting aside what you do not meet"]}
                          onDone={() => {
                            setAnalyzed((a) => [...a, job.id]);
                            setWorking(false);
                          }}
                        />
                      )
                    ) : !isAnalyzed ? (
                      <div className="py-2">
                        <p className="text-sm text-muted-foreground">We will compare your resume against this posting and suggest changes. Reordering, rewording, emphasis. Nothing invented.</p>
                        <Button className="mt-3 w-full" onClick={() => void startTailor()}>
                          <Sparkles /> Suggest changes
                        </Button>
                        {failed && (
                          <div className="mt-3 rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm">
                            <p>{failed}</p>
                            <Button variant="outline" size="sm" className="mt-2" onClick={() => void startTailor()}>
                              Try again
                            </Button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {pending > 0 && (
                          <Button size="xs" variant="outline" className="w-full" onClick={acceptAll}>
                            <CheckCheck /> Use all {pending} remaining
                          </Button>
                        )}
                        <ul className="space-y-2.5">
                          {changes.map((c) => (
                            <ChangeCard key={c.id} c={c} decision={decisions[c.id]} onDecide={(d) => decide(c.id, d)} />
                          ))}
                        </ul>
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="gaps" className="border-b-0">
                  <AccordionTrigger className="px-4 text-sm font-semibold hover:no-underline">
                    Gaps we did not fill{job.gaps.length > 0 && <span className="ml-1 font-normal text-muted-foreground">({job.gaps.length})</span>}
                  </AccordionTrigger>
                  <AccordionContent className="px-4">
                    <GapsPanel job={job} />
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="xs" variant="outline" onClick={() => setDoc("letter")}>
                        <PenLine /> Address these in the letter
                      </Button>
                      <Button asChild size="xs" variant="ghost">
                        <Link to="/app/roadmap">Close them over time</Link>
                      </Button>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="translator" className="border-b-0">
                  <AccordionTrigger className="px-4 text-sm font-semibold hover:no-underline">
                    <span className="flex items-center gap-1.5">
                      <Languages className="h-4 w-4 text-primary" aria-hidden /> Career Translator
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="px-4">
                    <TranslatorPanel job={job} live={live} />
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="versions" className="border-b-0">
                  <AccordionTrigger className="px-4 text-sm font-semibold hover:no-underline">
                    Saved versions <span className="ml-1 font-normal text-muted-foreground">({state.resume.versions.length})</span>
                  </AccordionTrigger>
                  <AccordionContent className="px-4">
                    <VersionsPanel
                      versions={state.resume.versions}
                      activeId={state.resume.activeVersionId}
                      pro={pro}
                      onMakeDefault={(id) => update((s) => void (s.resume.activeVersionId = id))}
                      onDelete={setConfirmDelete}
                    />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </Card>
          </div>
        </div>
      )}

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this version?</AlertDialogTitle>
            <AlertDialogDescription>Receipts that used it keep their own copy, so your proof is safe. This only removes it from your list.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                update((s) => {
                  s.resume.versions = s.resume.versions.filter((v) => v.id !== confirmDelete);
                  if (s.resume.activeVersionId === confirmDelete) s.resume.activeVersionId = s.resume.versions[0]?.id ?? "v-base";
                });
                toast("Version deleted");
                setConfirmDelete(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
