import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowRight, Briefcase, Copy, FileText, Languages, Loader2, Quote, Sparkles, Target, Wand2 } from "lucide-react";
import { Card, SectionTitle } from "@/components/common";
import { TranslatorRow } from "@/components/TranslatorRows";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useStore } from "@/store/AppStore";
import { BASE_RESUME } from "@/data/user";
import { BULLET_TRANSLATIONS, STORY_LINES, TARGET_FIELDS, TRANSLATOR_EXAMPLE, translateFreeText } from "@/data/translator";
import type { TargetField } from "@/data/jobs";
import { visibleJobs } from "@/lib/selectors";
import { useDocTitle } from "@/hooks/useDocTitle";
import LiveTranslator from "./TranslatorLive";
import { cn } from "@/lib/utils";

function DemoTranslator() {
  useDocTitle("Career Translator");
  const { state, update } = useStore();
  const [params, setParams] = useSearchParams();
  const target = (params.get("target") as TargetField) || (state.prefs.targetField as TargetField) || "supply";
  const [roleId, setRoleId] = useState(params.get("role") ?? "role-rom");
  const [free, setFree] = useState("");
  const [freeOut, setFreeOut] = useState<{ text: string; phrases: string[] }[]>([]);
  const [busy, setBusy] = useState(false);
  const [switching, setSwitching] = useState(false);

  const role = BASE_RESUME.roles.find((r) => r.id === roleId)!;
  const tf = TARGET_FIELDS.find((t) => t.id === target)!;
  const feed = visibleJobs(state);
  const feedCount = feed.length;
  const savedInField = feed.filter((j) => j.target === target).length;

  useEffect(() => {
    setSwitching(true);
    const t = setTimeout(() => setSwitching(false), 500);
    return () => clearTimeout(t);
  }, [target, roleId]);

  const rows = role.bullets.map((b) => ({ b, t: BULLET_TRANSLATIONS[b.id][target] }));
  const keywords = useMemo(() => {
    const m = new Map<string, number>();
    BASE_RESUME.roles.forEach((r) =>
      r.bullets.forEach((b) => {
        const t = BULLET_TRANSLATIONS[b.id][target];
        t.keywords.forEach((k) => m.set(k, Math.max(m.get(k) ?? 0, t.appearsIn)));
      }),
    );
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [target]);
  const coverage = Math.min(94, 52 + keywords.length * 3);

  const translate = (text: string) => {
    const t = text.trim();
    if (!t) return;
    setBusy(true);
    setTimeout(() => {
      const phrases = translateFreeText(t);
      setFreeOut((o) => [{ text: t, phrases: phrases.length ? phrases : ["Operational ownership", "Cross team coordination"] }, ...o]);
      setBusy(false);
      setFree("");
    }, 900);
  };

  const summary = `${tf.roleTitle} candidate with eight years leading multi site operations: ${rows
    .slice(0, 3)
    .map((r) => r.t.phrases[0].toLowerCase())
    .join(", ")}.`;

  return (
    <div>
      {/* Hero */}
      <section className="relative mb-8 overflow-hidden rounded-2xl border bg-gradient-to-br from-primary-soft via-background to-success-soft/60 p-6 sm:p-10">
        <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-primary/10 blur-3xl" aria-hidden />
        <div className="relative">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border bg-background/80 px-3 py-1 text-xs font-semibold text-primary">
            <Languages className="h-3.5 w-3.5" /> Career Translator
          </div>
          <h1 className="max-w-3xl font-display text-3xl font-semibold leading-tight sm:text-5xl text-balance">You have done this work. Here is what it is called where you are going.</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground sm:text-lg">Pick a role you held and a role you want. Every line of your experience is mapped to the words hiring managers in that field actually use.</p>

          <div className="mt-8 grid grid-cols-1 items-stretch gap-3 md:grid-cols-[1fr_auto_1fr]">
            <div className="rounded-xl border bg-card p-4 shadow-card">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Briefcase className="h-3.5 w-3.5" /> Where you have been
              </div>
              <div role="radiogroup" aria-label="Past role" className="space-y-2">
                {BASE_RESUME.roles.map((r) => (
                  <button
                    key={r.id}
                    role="radio"
                    aria-checked={roleId === r.id}
                    onClick={() => setRoleId(r.id)}
                    className={cn("w-full rounded-lg border p-3 text-left transition-all", roleId === r.id ? "border-primary bg-primary-soft" : "hover:border-primary/40")}
                  >
                    <div className="font-semibold">{r.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.company} · {r.start} to {r.end}
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-center py-1" aria-hidden>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lift">
                <ArrowRight className="h-5 w-5 rotate-90 md:rotate-0" />
              </div>
            </div>
            <div className="rounded-xl border bg-card p-4 shadow-card">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Target className="h-3.5 w-3.5" /> Where you are going
              </div>
              <div role="radiogroup" aria-label="Target field" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {TARGET_FIELDS.map((t) => (
                  <button
                    key={t.id}
                    role="radio"
                    aria-checked={target === t.id}
                    onClick={() => {
                      setParams({ target: t.id });
                      update((s) => void (s.prefs.targetField = t.id));
                    }}
                    className={cn("rounded-lg border p-2.5 text-left transition-all", target === t.id ? "border-primary bg-primary-soft" : "hover:border-primary/40")}
                  >
                    <div className="text-sm font-semibold leading-snug">{t.roleTitle}</div>
                    <div className="text-[11px] text-muted-foreground">{t.label}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-6">
          <blockquote className="relative rounded-2xl border-l-4 border-primary bg-card p-6 shadow-card">
            <Quote className="absolute right-5 top-5 h-8 w-8 text-primary/15" aria-hidden />
            <div className="text-xs font-semibold uppercase tracking-wide text-primary">Your story in one line</div>
            <p className={cn("mt-2 font-display text-xl leading-snug transition-opacity sm:text-2xl", switching && "opacity-40")}>{STORY_LINES[roleId][target]}</p>
            <p className="mt-3 text-xs text-muted-foreground">Built only from facts in your resume. Use it in your summary, your cover letter, or when someone asks "so what do you do?"</p>
          </blockquote>

          <div>
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">
                  {role.title} <span className="text-muted-foreground">to</span> {tf.roleTitle}
                </h2>
                <p className="text-sm text-muted-foreground">{rows.length} responsibilities translated. The chips are the terms hiring managers search for.</p>
              </div>
            </div>
            {switching ? (
              <div className="space-y-2.5">
                {rows.map((r) => (
                  <div key={r.b.id} className="grid grid-cols-1 gap-3 rounded-xl border bg-card p-5 md:grid-cols-[1fr_40px_1.05fr]">
                    <div className="space-y-2">
                      <div className="skeleton h-3.5 w-full" />
                      <div className="skeleton h-3.5 w-2/3" />
                    </div>
                    <div className="skeleton mx-auto h-8 w-8 rounded-full" />
                    <div className="flex gap-2">
                      <div className="skeleton h-7 w-32" />
                      <div className="skeleton h-7 w-24" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2.5">
                {rows.map((r, i) => (
                  <TranslatorRow
                    key={r.b.id}
                    index={i}
                    from={r.b.text}
                    phrases={r.t.phrases}
                    meta={
                      <>
                        Hiring managers use this language in <b className="num text-foreground">{r.t.appearsIn}</b> of the {feedCount} listings in your feed.
                      </>
                    }
                  />
                ))}
              </div>
            )}
          </div>

          <Card>
            <SectionTitle icon={Wand2} sub="Paste any responsibility, from any job you have had. We translate the idea, and never add facts.">Translate anything</SectionTitle>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                translate(free);
              }}
              className="space-y-3"
            >
              <Label htmlFor="free" className="sr-only">
                A responsibility to translate
              </Label>
              <Textarea id="free" rows={3} value={free} onChange={(e) => setFree(e.target.value)} placeholder={`For example: ${TRANSLATOR_EXAMPLE}`} />
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={!free.trim() || busy}>
                  {busy ? <Loader2 className="animate-spin" /> : <Sparkles />} Translate
                </Button>
                <Button type="button" variant="outline" onClick={() => translate(TRANSLATOR_EXAMPLE)} disabled={busy}>
                  Try the example
                </Button>
              </div>
            </form>
            {busy && (
              <div className="mt-4 flex gap-2">
                <div className="skeleton h-7 w-44" />
                <div className="skeleton h-7 w-28" />
                <div className="skeleton h-7 w-36" />
              </div>
            )}
            {freeOut.length > 0 && (
              <div className="mt-4 space-y-2.5">
                {freeOut.map((o, i) => (
                  <TranslatorRow key={`${o.text}-${i}`} from={o.text} phrases={o.phrases} highlight={i === 0} />
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6 lg:sticky lg:top-20 lg:self-start">
          <Card>
            <SectionTitle sub={`How much of the language in ${tf.label} postings your translated experience covers.`}>Language coverage</SectionTitle>
            <div className="flex items-baseline gap-1">
              <span className="num font-display text-5xl font-semibold">{coverage}</span>
              <span className="text-lg text-muted-foreground">%</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Across the {savedInField} {tf.label.toLowerCase()} roles in your feed.
            </p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {keywords.slice(0, 14).map(([k, n]) => (
                <span key={k} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs" style={{ fontSize: `${Math.min(14, 11 + n / 6)}px` }}>
                  {k}
                  <span className="num text-[10px] text-muted-foreground">{n}</span>
                </span>
              ))}
            </div>
          </Card>

          <Card>
            <SectionTitle>Use it</SectionTitle>
            <p className="rounded-lg bg-muted/50 p-3 text-sm">{summary}</p>
            <div className="mt-3 flex flex-col gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard?.writeText(summary).catch(() => undefined);
                  toast.success("Summary copied");
                }}
              >
                <Copy /> Copy summary line
              </Button>
              <Button asChild size="sm">
                <Link to="/app/resume">
                  <FileText /> Tailor a resume with this language
                </Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link to={`/app/matches`}>See matching {tf.label.toLowerCase()} roles</Link>
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function Translator() {
  const { state } = useStore();
  return state.mode === "live" ? <LiveTranslator /> : <DemoTranslator />;
}
