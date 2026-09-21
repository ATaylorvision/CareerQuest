import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { BadgeCheck, Copy, Download, Eye, EyeOff, FileText, Link2, Printer, RefreshCw, Save, ShieldAlert } from "lucide-react";
import { Card, PageHeader, Segmented, SectionTitle, SkeletonLines } from "@/components/common";
import { Pill, TruthModeBadge } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useStore } from "@/store/AppStore";
import { JOBS, jobById, type Job } from "@/data/jobs";
import { SEVERITY_LABEL } from "@/data/gaps";
import { BASE_RESUME, bulletById } from "@/data/user";
import { FREE_LIMITS, isPro } from "@/lib/selectors";
import { downloadText, printHtml } from "@/lib/resumeBuild";
import { LETTER_TEMPLATES, renderLetterHtml, type LetterContext } from "@/data/letterTemplates";
import { TemplatePicker } from "@/components/TemplatePicker";
import { api, ApiError } from "@/live/api";
import { supabase } from "@/live/supabase";
import { useDocTitle } from "@/hooks/useDocTitle";
import { cn } from "@/lib/utils";

type Tone = "warm" | "direct" | "formal";

interface Para {
  id: string;
  label: string;
  variants: Record<Tone, string[]>;
  sources: string[];
}

const SOURCE_LABEL: Record<string, string> = {
  situation: "Your situation, from setup",
  company: "Company insights for this employer",
};

function sourceText(id: string) {
  if (id === "situation") return "You told us you were laid off in a restructuring in May 2026.";
  if (id === "company") return "Public company information shown on the job page.";
  if (id.startsWith("gap:")) return "A requirement you do not meet, stated honestly.";
  return bulletById(id)?.text ?? id;
}

function sourceChip(id: string) {
  if (SOURCE_LABEL[id]) return SOURCE_LABEL[id];
  if (id.startsWith("gap:")) return "Gap, stated honestly";
  const b = bulletById(id);
  if (!b) return id;
  const idx = b.role.bullets.findIndex((x) => x.id === id) + 1;
  return `${b.role.title}, line ${idx}`;
}

function buildParas(job: Job, gapIds: string[]): Para[] {
  const co = job.company.name;
  const proof: Record<string, { text: Record<Tone, string[]>; src: string[] }> = {
    supply: {
      src: ["r2", "r3"],
      text: {
        warm: ["I managed weekly inventory counts and replenishment for six locations and cut stockouts by 22% in 2024. I also worked with 14 vendors on delivery schedules and damaged goods claims, and recovered $210K in credits over two years.", "The work I am proudest of is the unglamorous kind. Weekly counts and replenishment across six stores cut our stockouts by 22% in 2024, and holding 14 vendors to their commitments recovered $210K in credits over two years."],
        direct: ["Two results are most relevant. I cut stockouts 22% in 2024 by running weekly counts and replenishment across six locations. I recovered $210K in vendor credits over two years by managing 14 vendors on schedules and claims."],
        formal: ["In that role I managed weekly inventory counts and replenishment across six locations, reducing stockouts by 22% in 2024. I also managed relationships with 14 vendors regarding delivery schedules and damaged goods claims, recovering $210K in credits over two years."],
      },
    },
    program: {
      src: ["s4", "r5"],
      text: {
        warm: ["I coordinated seasonal floor sets and a full store remodel without missing a single opening day. Later, I rolled out a new Kronos scheduling process across six stores that reduced overtime by 18%.", "Two projects shaped how I work. A full store remodel, delivered with no missed opening days, and a scheduling rollout across six stores that cut overtime by 18%."],
        direct: ["I delivered a full store remodel with no missed opening days. I rolled out a new Kronos scheduling process across six stores and cut overtime 18%."],
        formal: ["I coordinated seasonal floor sets and a full store remodel with no missed opening days, and led the rollout of a new Kronos scheduling process that reduced overtime spending by 18%."],
      },
    },
    cs: {
      src: ["s5", "r3"],
      text: {
        warm: ["I kept store NPS above the district average for 11 straight quarters, largely by handling escalated customer issues myself. I also worked with 14 vendors on schedules and claims, recovering $210K in credits.", "Customers were the scoreboard in my old job. My store stayed above the district NPS average for 11 straight quarters, and I recovered $210K from 14 vendors by staying on top of every claim."],
        direct: ["My store stayed above district average NPS for 11 straight quarters. I handled escalations personally. I also recovered $210K from 14 vendors through claims."],
        formal: ["I maintained store NPS above the district average for 11 consecutive quarters and personally handled escalated customer issues. I also recovered $210K in vendor credits by managing 14 vendor relationships."],
      },
    },
    health: {
      src: ["r4", "r5", "s5"],
      text: {
        warm: ["I led six store managers and about 120 hourly associates. I rolled out a new scheduling process that reduced overtime by 18%, and kept customer satisfaction above the district average for 11 straight quarters.", "Running six stores taught me that scheduling, staffing, and service are one problem. A new scheduling process cut overtime 18%, and satisfaction stayed above district average for 11 straight quarters."],
        direct: ["I led 6 store managers and about 120 associates. I cut overtime 18% with a new scheduling process. Customer satisfaction stayed above district average for 11 straight quarters."],
        formal: ["I led a team of six store managers and approximately 120 hourly associates, implemented a scheduling process that reduced overtime by 18%, and maintained customer satisfaction above the district average for 11 consecutive quarters."],
      },
    },
    project: {
      src: ["s4", "r3"],
      text: {
        warm: ["I coordinated seasonal floor sets and a full store remodel without missing an opening day, and I worked with 14 vendors every week on delivery schedules and claims.", "Coordination was the core of my job. A full remodel with no missed opening days, seasonal resets every quarter, and 14 vendors on a weekly schedule."],
        direct: ["I delivered a full store remodel with no missed opening days. I coordinated 14 vendors weekly on schedules and claims."],
        formal: ["I coordinated seasonal floor sets and a full store remodel with no missed opening days, and managed delivery schedules and claims with 14 vendors."],
      },
    },
  };
  const p = proof[job.target];
  const gapLines = job.gaps.filter((g) => gapIds.includes(g.id));
  const paras: Para[] = [
    {
      id: "intro",
      label: "Opening",
      sources: ["r1", "r4"],
      variants: {
        warm: [`I am applying for the ${job.title} role. I spent eight years running retail operations at Harbor & Pine Home, most recently six stores with about 120 people, and much of the work you describe is work I have been doing under a different title.`, `The ${job.title} role caught my attention because it describes what I did for eight years at Harbor & Pine Home, just in a different setting. Most recently I ran six stores and about 120 people across Rhode Island and southeastern Massachusetts.`],
        direct: [`I am applying for the ${job.title} role. For eight years I ran retail operations at Harbor & Pine Home, most recently six stores and about 120 people across Rhode Island and southeastern Massachusetts.`],
        formal: [`I am writing to apply for the ${job.title} position. Over eight years at Harbor & Pine Home, I progressed from Store Operations Manager to Regional Operations Manager, overseeing six locations with combined annual revenue of $38M.`],
      },
    },
    { id: "proof", label: "Proof", sources: p.src, variants: p.text },
  ];
  if (gapLines.length) {
    const joined = gapLines.map((g) => g.coverLetterLine).join(" ");
    paras.push({
      id: "gaps",
      label: "Gaps, addressed honestly",
      sources: gapLines.map((g) => `gap:${g.id}`),
      variants: { warm: [joined], direct: [joined], formal: [joined] },
    });
  }
  paras.push(
    {
      id: "why",
      label: "Why now",
      sources: ["situation"],
      variants: {
        warm: [`My role was eliminated in a restructuring this spring. I am using the change to move toward ${job.category.toLowerCase()} work, which was always the part of my job I liked most.`],
        direct: [`I was laid off in a restructuring in May. I am moving toward ${job.category.toLowerCase()} work on purpose, because it is what I was best at.`],
        formal: [`Following a restructuring that eliminated my position this spring, I am deliberately pursuing ${job.category.toLowerCase()} roles, which align most closely with my strongest work.`],
      },
    },
    {
      id: "company",
      label: "Why this company",
      sources: ["company", "r1"],
      variants: {
        warm: [`I would bring the same steadiness to ${co} that I brought to my region. I know what it takes to keep several sites running the same way, and I like that work.`],
        direct: [`I can bring ${co} the same consistency I built across six sites.`],
        formal: [`I would welcome the opportunity to bring the same consistency and operational discipline to ${co} that I brought to my region.`],
      },
    },
    {
      id: "close",
      label: "Close",
      sources: [],
      variants: {
        warm: ["I would like to talk about how I could help. Thank you for reading.\n\nRenee Castillo"],
        direct: ["I would welcome a conversation. Thank you.\n\nRenee Castillo"],
        formal: ["Thank you for your consideration. I would welcome the opportunity to discuss how my experience fits your needs.\n\nSincerely,\nRenee Castillo"],
      },
    },
  );
  return paras;
}

function greetingFor(job: Job, tone: Tone) {
  return tone === "formal" ? `Dear ${job.company.name} Hiring Team,` : tone === "direct" ? `Hello ${job.company.name} team,` : `Hi ${job.company.name} team,`;
}

function numberCheck(text: string, resumeText: string) {
  const nums = Array.from(new Set((text.match(/\$?\d[\d,.]*[KkM%]?/g) ?? []).map((n) => n.replace(/[.,]+$/, ""))));
  return nums.map((n) => ({ n, ok: resumeText.includes(n) }));
}

/** `embedded` drops the page header and the job picker, because the Studio owns both. */
export default function CoverLetter({ embedded }: { embedded?: boolean } = {}) {
  useDocTitle(embedded ? "Studio" : "Cover Letter Studio");
  const { state, update } = useStore();
  const pro = isPro(state);
  const [params, setParams] = useSearchParams();
  const job = jobById(params.get("job") ?? "") ?? jobById(state.resume.jobId) ?? JOBS[0];
  const [tone, setTone] = useState<Tone>("warm");
  const [gapIds, setGapIds] = useState<string[]>(() => job.gaps.filter((g) => g.severity !== "preferred").map((g) => g.id));
  const [removed, setRemoved] = useState<Record<string, boolean>>({});
  const [variantIdx, setVariantIdx] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [showSources, setShowSources] = useState(true);
  const [hoverSrc, setHoverSrc] = useState<string | null>(null);
  const live = state.mode === "live";
  const [liveParas, setLiveParas] = useState<Para[] | null>(null);
  const [liveGreeting, setLiveGreeting] = useState("");
  const [failed, setFailed] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const resumeText = useMemo(() => [BASE_RESUME.summary, ...BASE_RESUME.roles.flatMap((r) => r.bullets.map((b) => b.text))].join(" "), [state.uploadedFileName]);

  useEffect(() => {
    setGapIds(job.gaps.filter((g) => g.severity !== "preferred").map((g) => g.id));
    setRemoved({});
    setVariantIdx({});
  }, [job.id]);

  useEffect(() => {
    if (!live) {
      setLoading(true);
      const t = setTimeout(() => setLoading(false), 900);
      return () => clearTimeout(t);
    }
    let current = true;
    setLoading(true);
    setFailed(null);
    setLiveParas(null);
    api<{ greeting: string; paragraphs: { id: string; role: string; text: string; sources: string[] }[] }>("studio", {
      action: "letter",
      jobId: job.id,
      tone,
      addressGaps: gapIds,
    })
      .then((out) => {
        if (!current) return;
        setLiveGreeting(out.greeting);
        setLiveParas(
          out.paragraphs.map((x) => ({
            id: x.id,
            label: x.role === "opening" ? "Opening" : x.role === "gap" ? "Gap, addressed" : x.role === "closing" ? "Closing" : "Proof",
            sources: x.sources,
            variants: { warm: [x.text], direct: [x.text], formal: [x.text] },
          })),
        );
      })
      .catch((e) => current && setFailed(e instanceof ApiError ? e.message : "We could not write that letter. Please try again."))
      .finally(() => current && setLoading(false));
    return () => {
      current = false;
    };
  }, [job.id, tone, live, gapIds, retry]);

  const demoParas = useMemo(() => (live ? [] : buildParas(job, gapIds)), [live, job, gapIds]);
  const paras = live ? (liveParas ?? []) : demoParas;
  const textOf = (p: Para) => {
    const v = p.variants[tone];
    return v[(variantIdx[p.id] ?? 0) % v.length];
  };
  const greeting = live ? liveGreeting : greetingFor(job, tone);
  const letter = [greeting, ...paras.filter((p) => !removed[p.id]).map(textOf)].join("\n\n");
  const letterCtx: LetterContext = {
    name: state.profile.name,
    location: state.profile.location,
    phone: BASE_RESUME.phone,
    email: state.profile.email,
    paragraphs: paras.filter((x) => !removed[x.id]).map(textOf),
    company: job.company.name,
    jobTitle: job.title,
    date: new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
  };
  const checks = numberCheck(letter, resumeText);
  const freeLeft = FREE_LIMITS.coverLetters - state.usage.coverLetters;
  const saved = state.letters.filter((l) => l.jobId === job.id);

  const save = async () => {
    if (!pro && freeLeft <= 0) {
      toast.error("You have used your 3 free cover letters this month", { description: "They reset on the 1st. Pro includes unlimited." });
      return;
    }
    // A real account keeps the letter in the database so it survives this browser.
    if (live && supabase) {
      const uid = (await supabase.auth.getUser()).data.user?.id;
      if (uid) {
        const { error } = await supabase
          .from("cover_letters")
          .upsert({ user_id: uid, job_id: job.id, tone, content: letter, sources: paras.map((x) => ({ id: x.id, sources: x.sources })) }, { onConflict: "user_id,job_id" });
        if (error) {
          toast.error("We could not save that letter", { description: "It is still on screen. Please try again." });
          return;
        }
      }
    }
    update((s) => {
      s.letters.push({ id: `l${Date.now()}`, jobId: job.id, tone, text: letter, createdAt: new Date().toISOString() });
      s.usage.coverLetters += 1;
    });
    toast.success("Cover letter saved", { description: `It will be attached when you apply to ${job.company.name}.` });
  };

  const jobOptions = Array.from(new Set(["j01", ...state.applications.map((a) => a.jobId), ...JOBS.filter((j) => j.match >= 85).map((j) => j.id)]))
    .map((id) => jobById(id)!)
    .filter((j) => j.legit.badge !== "ghost");

  return (
    <div>
      {!embedded && (
        <PageHeader
          title="Cover Letter Studio"
          sub="Built only from your resume. Every paragraph shows where it came from, and gaps are addressed plainly instead of hidden."
          actions={<TruthModeBadge />}
        />
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-5">
          <Card className="space-y-5">
            {!embedded && (
              <div className="space-y-1.5">
                <Label htmlFor="cl-job">Writing for</Label>
                <Select value={job.id} onValueChange={(v) => setParams({ job: v })}>
                  <SelectTrigger id="cl-job">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {jobOptions.map((j) => (
                      <SelectItem key={j.id} value={j.id}>
                        {j.title} · {j.company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <div className="text-sm font-medium">Tone</div>
              <Segmented<Tone>
                value={tone}
                onChange={setTone}
                options={[
                  { value: "warm", label: "Warm" },
                  { value: "direct", label: "Direct" },
                  { value: "formal", label: "Formal" },
                ]}
              />
              <p className="text-xs text-muted-foreground">
                {tone === "warm" && "Friendly and human. Good for smaller companies and mission driven teams."}
                {tone === "direct" && "Short sentences, results first. Good for operations and logistics hiring managers."}
                {tone === "formal" && "Traditional and polished. Good for hospitals and large employers."}
              </p>
            </div>
            {!pro && (
              <Pill tone={freeLeft > 0 ? "muted" : "danger"}>
                <span className="num">{Math.max(0, freeLeft)}</span> of 3 free cover letters left this month
              </Pill>
            )}
          </Card>

          <section className="rounded-xl border border-warning-border bg-warning-soft p-5">
            <h2 className="flex items-center gap-2 font-semibold text-warning">
              <ShieldAlert className="h-4 w-4" /> Address gaps honestly
            </h2>
            <p className="mt-1 text-sm text-foreground/80">Pick which gaps to name. Naming a gap with a plan reads as confidence. Hiding it reads as a surprise later.</p>
            {job.gaps.length === 0 ? (
              <p className="mt-3 text-sm">No gaps for this role.</p>
            ) : (
              <ul className="mt-3 space-y-2.5">
                {job.gaps.map((g) => (
                  <li key={g.id} className="flex items-start gap-2.5 rounded-lg bg-background/80 p-3">
                    <Checkbox
                      id={`g-${g.id}`}
                      checked={gapIds.includes(g.id)}
                      onCheckedChange={(v) => setGapIds((ids) => (v ? [...ids, g.id] : ids.filter((x) => x !== g.id)))}
                      className="mt-0.5"
                    />
                    <Label htmlFor={`g-${g.id}`} className="font-normal leading-snug">
                      <span className="block text-sm font-medium">{g.label}</span>
                      <span className="text-xs text-muted-foreground">{SEVERITY_LABEL[g.severity]}</span>
                    </Label>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <Card>
            <SectionTitle icon={BadgeCheck} sub="Every number in the letter must already be in your resume.">Truth check</SectionTitle>
            <ul className="flex flex-wrap gap-1.5">
              {checks.map((c) => (
                <li key={c.n}>
                  <Pill size="xs" tone={c.ok ? "success" : "danger"}>
                    {c.ok ? "✓" : "✕"} <span className="num">{c.n}</span>
                  </Pill>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">{checks.every((c) => c.ok) ? `All ${checks.length} numbers match your resume.` : "A number does not match your resume. It will be removed before saving."}</p>
          </Card>
        </div>

        <div className="min-w-0">
          <div className="card-base mb-5 p-5 sm:p-6">
            <TemplatePicker
              label="Letter layout"
              items={LETTER_TEMPLATES.map((t) => ({
                id: t.id,
                name: t.name,
                blurb: t.blurb,
                bestFor: t.bestFor,
                html: renderLetterHtml(letterCtx, t.id, t.name),
              }))}
              value={state.resume.letterTemplateId}
              onChange={(id) => update((d) => void (d.resume.letterTemplateId = id))}
            />
          </div>
          <Card className="p-0 sm:p-0">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <FileText className="h-4 w-4 text-muted-foreground" /> Letter to {job.company.name}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Button size="xs" variant="ghost" onClick={() => setShowSources((s) => !s)}>
                  {showSources ? <EyeOff /> : <Eye />} {showSources ? "Hide sources" : "Show sources"}
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => {
                    navigator.clipboard?.writeText(letter).catch(() => undefined);
                    toast.success("Copied to clipboard");
                  }}
                >
                  <Copy /> Copy
                </Button>
                <Button size="xs" variant="ghost" onClick={() => downloadText(`${state.profile.name.replace(/\s+/g, "_") || "Cover"}_Cover_Letter_${job.company.name.split(" ")[0]}.txt`, letter)}>
                  <Download /> .txt
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => {
                    const html = renderLetterHtml(letterCtx, state.resume.letterTemplateId, `${state.profile.name} cover letter`);
                    if (!printHtml(html)) toast.error("Your browser blocked the print window. Allow pop ups and try again.");
                  }}
                >
                  <Printer /> Print or PDF
                </Button>
              </div>
            </div>
            <div className="px-5 py-6 sm:px-8" aria-live="polite" aria-busy={loading}>
              {failed ? (
                <div className="rounded-lg border border-danger/30 bg-danger/5 p-4 text-sm">
                  <p>{failed}</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => setRetry((n) => n + 1)}>
                    Try again
                  </Button>
                </div>
              ) : loading ? (
                <div className="space-y-6">
                  <SkeletonLines lines={1} className="w-1/3" />
                  <SkeletonLines lines={3} />
                  <SkeletonLines lines={4} />
                  <SkeletonLines lines={3} />
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="pb-2 text-[15px]">{greeting}</p>
                  {paras.map((p, i) => {
                    const off = !!removed[p.id];
                    return (
                      <div
                        key={p.id}
                        className={cn(
                          "group relative -mx-3 rounded-lg px-3 py-2.5 transition-colors animate-fade-up",
                          p.id === "gaps" && !off && "bg-warning-soft/60",
                          off ? "opacity-45" : "hover:bg-accent/50",
                        )}
                        style={{ animationDelay: `${i * 80}ms` }}
                      >
                        <p className={cn("whitespace-pre-line text-[15px] leading-relaxed", off && "line-through decoration-muted-foreground/60")}>{textOf(p)}</p>
                        {showSources && (
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{p.label}</span>
                            {p.sources.map((s) => (
                              <Tooltip key={s}>
                                <TooltipTrigger asChild>
                                  <button
                                    onMouseEnter={() => setHoverSrc(s)}
                                    onMouseLeave={() => setHoverSrc(null)}
                                    onFocus={() => setHoverSrc(s)}
                                    onBlur={() => setHoverSrc(null)}
                                    className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] transition-colors", hoverSrc === s ? "border-primary bg-primary-soft text-primary" : "text-muted-foreground hover:border-primary/40")}
                                  >
                                    <Link2 className="h-3 w-3" /> {sourceChip(s)}
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs text-xs">{sourceText(s)}</TooltipContent>
                              </Tooltip>
                            ))}
                            <span className="ml-auto flex gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                              {p.variants[tone].length > 1 && !off && (
                                <Button size="xs" variant="ghost" onClick={() => setVariantIdx((v) => ({ ...v, [p.id]: (v[p.id] ?? 0) + 1 }))}>
                                  <RefreshCw /> Other wording
                                </Button>
                              )}
                              {p.id !== "close" && (
                                <Button size="xs" variant="ghost" onClick={() => setRemoved((r) => ({ ...r, [p.id]: !r[p.id] }))}>
                                  {off ? "Put back" : "Remove"}
                                </Button>
                              )}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-3 border-t px-5 py-4 sm:flex-row sm:items-center">
              <p className="flex-1 text-sm text-muted-foreground">{saved.length > 0 ? `You have ${saved.length} saved letter${saved.length > 1 ? "s" : ""} for this job. The newest is used when you apply.` : "Save it to attach it automatically when you apply."}</p>
              <Button variant="outline" asChild>
                <Link to={`/app/jobs/${job.id}?apply=1`}>Apply with this letter</Link>
              </Button>
              <Button onClick={() => void save()} disabled={loading || !!failed}>
                <Save /> Save letter
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
