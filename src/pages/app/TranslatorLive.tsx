import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowRight, Briefcase, Copy, FileText, Languages, Loader2, Quote, RefreshCcw, Sparkles, Target, Upload, Wand2 } from "lucide-react";
import { Card, SectionTitle } from "@/components/common";
import { TranslatorRow } from "@/components/TranslatorRows";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useStore } from "@/store/AppStore";
import { BASE_RESUME } from "@/data/user";
import { TARGET_FIELDS } from "@/data/translator";
import type { TargetField } from "@/data/jobs";
import { api } from "@/live/api";
import { cn } from "@/lib/utils";
import { useDocTitle } from "@/hooks/useDocTitle";

type Row = { from: string; phrases: string[] };
const cache = new Map<string, { rows: Row[]; story: string }>();

export default function LiveTranslator() {
  useDocTitle("Career Translator");
  const { state, update } = useStore();
  const [params, setParams] = useSearchParams();
  const target = ((params.get("target") as TargetField) || (state.prefs.targetField as TargetField) || "supply") as TargetField;
  const roles = BASE_RESUME.roles;
  const [roleId, setRoleId] = useState(roles[0]?.id ?? "");
  const role = roles.find((r) => r.id === roleId) ?? roles[0];
  const tf = TARGET_FIELDS.find((t) => t.id === target)!;

  const [data, setData] = useState<{ rows: Row[]; story: string } | null>(null);
  const [err, setErr] = useState("");
  const [nonce, setNonce] = useState(0);
  const seq = useRef(0);
  const [free, setFree] = useState("");
  const [freeOut, setFreeOut] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);

  const items = (role?.bullets ?? []).map((b) => b.text).filter((t) => t.trim().length > 12);
  const key = `${role?.id}|${target}|${state.prefs.prevField}|${items.length}`;

  useEffect(() => {
    if (!role || items.length === 0) {
      setData({ rows: [], story: "" });
      return;
    }
    const hit = cache.get(key);
    if (hit && nonce === 0) {
      setData(hit);
      return;
    }
    const id = ++seq.current;
    setData(null);
    setErr("");
    api<{ rows: Row[]; story: string }>("translate", { target, items, prevField: state.prefs.prevField })
      .then((out) => {
        if (id !== seq.current) return;
        cache.set(key, out);
        setData(out);
      })
      .catch((e: Error) => id === seq.current && setErr(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, nonce]);

  const translateFree = async () => {
    const t = free.trim();
    if (!t) return;
    setBusy(true);
    try {
      const out = await api<{ rows: Row[] }>("translate", { target, items: [t], prevField: state.prefs.prevField });
      setFreeOut((o) => [{ from: t, phrases: out.rows[0]?.phrases.length ? out.rows[0].phrases : [] }, ...o]);
      setFree("");
    } catch (e) {
      toast.error("We could not translate that", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const lead = (data?.rows ?? []).map((r) => r.phrases[0]).filter(Boolean).slice(0, 3);
  const summary = lead.length ? `Experienced in ${lead.map((p) => p.toLowerCase()).join(", ")}.` : "";

  if (roles.length === 0) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center py-16 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Upload className="h-6 w-6 text-muted-foreground" />
        </div>
        <h1 className="font-display text-3xl font-semibold">Upload your resume first</h1>
        <p className="mt-3 text-muted-foreground">The Career Translator works on the work you have actually done. Replay setup from Settings to upload your resume.</p>
        <Button asChild className="mt-6">
          <Link to="/app/settings">Open Settings</Link>
        </Button>
      </div>
    );
  }

  return (
    <div>
      <section className="relative mb-8 overflow-hidden rounded-2xl border bg-gradient-to-br from-primary-soft via-background to-success-soft/60 p-6 sm:p-10">
        <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-primary/10 blur-3xl" aria-hidden />
        <div className="relative">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border bg-background/80 px-3 py-1 text-xs font-semibold text-primary">
            <Languages className="h-3.5 w-3.5" /> Career Translator
          </div>
          <h1 className="max-w-3xl font-display text-3xl font-semibold leading-tight sm:text-5xl text-balance">You have done this work. Here is what it is called where you are going.</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground sm:text-lg">Pick a role you held and a field you want. Every line of your real resume is relabeled in the words hiring managers there use. Nothing is added.</p>

          <div className="mt-8 grid grid-cols-1 items-stretch gap-3 md:grid-cols-[1fr_auto_1fr]">
            <div className="rounded-xl border bg-card p-4 shadow-card">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Briefcase className="h-3.5 w-3.5" /> Where you have been
              </div>
              <div role="radiogroup" aria-label="Past role" className="space-y-2">
                {roles.map((r) => (
                  <button
                    key={r.id}
                    role="radio"
                    aria-checked={roleId === r.id}
                    onClick={() => setRoleId(r.id)}
                    className={cn("w-full rounded-lg border p-3 text-left transition-all", roleId === r.id ? "border-primary bg-primary-soft" : "hover:border-primary/40")}
                  >
                    <div className="font-semibold">{r.title || "Role"}</div>
                    <div className="text-xs text-muted-foreground">
                      {[r.company, r.start && r.end ? `${r.start} to ${r.end}` : ""].filter(Boolean).join(" · ")}
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
          {(data === null || data.story) && (
            <blockquote className="relative rounded-2xl border-l-4 border-primary bg-card p-6 shadow-card">
              <Quote className="absolute right-5 top-5 h-8 w-8 text-primary/15" aria-hidden />
              <div className="text-xs font-semibold uppercase tracking-wide text-primary">Your story in one line</div>
              {data === null && !err ? (
                <div className="mt-3 space-y-2">
                  <div className="skeleton h-5 w-full" />
                  <div className="skeleton h-5 w-2/3" />
                </div>
              ) : (
                <p className="mt-2 font-display text-xl leading-snug sm:text-2xl">{data?.story}</p>
              )}
              <p className="mt-3 text-xs text-muted-foreground">Built only from facts in your resume. Use it in your summary, your cover letter, or when someone asks "so what do you do?"</p>
            </blockquote>
          )}

          <div>
            <h2 className="text-lg font-semibold">
              {role.title || "Your role"} <span className="text-muted-foreground">to</span> {tf.roleTitle}
            </h2>
            <p className="mb-3 text-sm text-muted-foreground">{items.length} lines from your resume. The chips are the terms hiring managers search for.</p>
            {err && (
              <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-danger-border bg-danger-soft p-4 text-sm" role="alert">
                <span>{err}</span>
                <Button size="sm" variant="outline" onClick={() => setNonce((n) => n + 1)}>
                  <RefreshCcw /> Try again
                </Button>
              </div>
            )}
            {data === null && !err ? (
              <div className="space-y-2.5" aria-busy="true">
                {items.slice(0, 6).map((t) => (
                  <div key={t} className="grid grid-cols-1 gap-3 rounded-xl border bg-card p-5 md:grid-cols-[1fr_40px_1.05fr]">
                    <p className="text-sm text-foreground/70">{t}</p>
                    <div className="skeleton mx-auto h-8 w-8 rounded-full" />
                    <div className="flex gap-2">
                      <div className="skeleton h-7 w-32" />
                      <div className="skeleton h-7 w-24" />
                    </div>
                  </div>
                ))}
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Translating your resume. About 10 seconds.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {(data?.rows ?? []).map((r, i) => (
                  <TranslatorRow key={r.from} index={i} from={r.from} phrases={r.phrases.length ? r.phrases : ["No clean translation for this line"]} />
                ))}
              </div>
            )}
          </div>

          <Card>
            <SectionTitle icon={Wand2} sub="Paste any responsibility, from any job you have had. We relabel the idea and never add facts.">Translate anything</SectionTitle>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void translateFree();
              }}
              className="space-y-3"
            >
              <Label htmlFor="free" className="sr-only">
                A responsibility to translate
              </Label>
              <Textarea id="free" rows={3} value={free} onChange={(e) => setFree(e.target.value)} placeholder="For example: Managed 40 rental vehicle locations across three states" />
              <Button type="submit" disabled={!free.trim() || busy}>
                {busy ? <Loader2 className="animate-spin" /> : <Sparkles />} Translate
              </Button>
            </form>
            {freeOut.length > 0 && (
              <div className="mt-4 space-y-2.5">
                {freeOut.map((o, i) => (
                  <TranslatorRow key={`${o.from}-${i}`} from={o.from} phrases={o.phrases.length ? o.phrases : ["No clean translation for this line"]} highlight={i === 0} />
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6 lg:sticky lg:top-20 lg:self-start">
          <Card>
            <SectionTitle>Use it</SectionTitle>
            {summary ? <p className="rounded-lg bg-muted/50 p-3 text-sm">{summary}</p> : <p className="text-sm text-muted-foreground">Your summary line appears once the translation finishes.</p>}
            <div className="mt-3 flex flex-col gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!summary}
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
                <Link to="/app/matches">See matching roles</Link>
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
