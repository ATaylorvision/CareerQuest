import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Loader2, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStore } from "@/store/AppStore";
import { BASE_RESUME } from "@/data/user";
import { LEVELS, type SkillClaim } from "@/lib/skillClaims";
import { api, ApiError } from "@/live/api";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  gap: { id: string; label: string };
  /** A job that asks for this, so the wording can lean on what the posting says. */
  jobId: string | null;
}

/**
 * "I already have this." A few questions about the skill, so we know where it belongs on the resume, and then
 * some ways to write it up. What they say is kept and used whenever their resume is tailored for a job that wants it.
 */
export function SkillClaimDialog({ open, onOpenChange, gap, jobId }: Props) {
  const { state, update } = useStore();
  const existing = state.resume.skillClaims?.[gap.id];
  const roles = BASE_RESUME.roles;

  const [level, setLevel] = useState<SkillClaim["level"]>(existing?.level ?? "some");
  const [roleId, setRoleId] = useState(existing?.roleId ?? roles[0]?.id ?? "outside");
  const [where, setWhere] = useState(existing?.where ?? "");
  const [detail, setDetail] = useState(existing?.detail ?? "");
  const [extra, setExtra] = useState(existing?.extra ?? "");
  const [line, setLine] = useState(existing?.line ?? "");
  const [options, setOptions] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) return;
    setOptions(null);
    setErr("");
  }, [open]);

  const notes = () => {
    const role = roles.find((r) => r.id === roleId);
    const at = roleId === "outside" ? where.trim() : role ? `${role.title} at ${role.company}` : "";
    return [`${gap.label}.`, LEVELS.find((l) => l.id === level)?.label ? `Level: ${LEVELS.find((l) => l.id === level)!.label}.` : "", at ? `Used at: ${at}.` : "", `What I did: ${detail.trim()}`, extra.trim() ? `Also: ${extra.trim()}` : ""].filter(Boolean).join(" ");
  };

  const suggest = async () => {
    if (detail.trim().split(/\s+/).length < 3) return setErr("Tell us a little about what you did with it, even roughly.");
    setBusy(true);
    setErr("");
    try {
      const snapshot = { summary: BASE_RESUME.summary, skills: BASE_RESUME.skills, roles: BASE_RESUME.roles.map((r) => ({ id: r.id, title: r.title, company: r.company, bullets: r.bullets.map((b) => ({ id: b.id, text: b.text })) })) };
      const out = await api<{ options: string[] }>("studio", { action: "writeLine", jobId, target: "bullet", notes: notes(), resume: snapshot });
      setOptions(out.options);
    } catch (e) {
      // Not being able to word it is not a reason to lose what they told us, so they can still save it plainly.
      setErr(e instanceof ApiError ? e.message : "We could not write that just now.");
      setOptions([]);
    } finally {
      setBusy(false);
    }
  };

  const save = (chosen: string) => {
    if (detail.trim().split(/\s+/).length < 3) return setErr("Tell us a little about what you did with it, even roughly.");
    update((s) => {
      if (!s.resume.skillClaims) s.resume.skillClaims = {};
      s.resume.skillClaims[gap.id] = { gapId: gap.id, label: gap.label, level, roleId, where: where.trim(), detail: detail.trim(), extra: extra.trim(), line: chosen, at: new Date().toISOString() };
    });
    toast.success("Added to what you can do", { description: "We will use it whenever your resume is tailored for a job that asks for it." });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">You have {gap.label}?</DialogTitle>
          <DialogDescription>Tell us about it. Your answers decide where it goes on your resume, and they are used to tailor it for jobs that ask for this.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">How would you describe your experience?</legend>
            <div role="radiogroup" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {LEVELS.map((l) => (
                <button key={l.id} type="button" role="radio" aria-checked={level === l.id} onClick={() => setLevel(l.id)} className={cn("rounded-lg border p-3 text-left transition-colors", level === l.id ? "border-primary bg-primary-soft/50 ring-2 ring-primary/20" : "hover:border-primary/40")}>
                  <span className="block text-sm font-semibold">{l.label}</span>
                  <span className="block text-xs text-muted-foreground">{l.hint}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <div className="space-y-1.5">
            <Label htmlFor="sc-where">Where did you use it?</Label>
            <Select value={roleId} onValueChange={setRoleId}>
              <SelectTrigger id="sc-where">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.title}, {r.company}
                  </SelectItem>
                ))}
                <SelectItem value="outside">Outside of a job: school, volunteering, or on my own</SelectItem>
              </SelectContent>
            </Select>
            {roleId === "outside" && <Input value={where} onChange={(e) => setWhere(e.target.value)} placeholder="For example: volunteer coordinator at my church, 2022" aria-label="Where outside of work" />}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sc-detail">What did you do with it?</Label>
            <Textarea id="sc-detail" rows={3} value={detail} onChange={(e) => setDetail(e.target.value)} maxLength={400} placeholder="For example: I built the monthly slide deck for the district team and presented it every month" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sc-extra">Anything else we should know? (optional)</Label>
            <Textarea id="sc-extra" rows={2} value={extra} onChange={(e) => setExtra(e.target.value)} maxLength={400} placeholder="Tools you used, who saw it, how often, results. We will use this when we tailor your resume." />
          </div>

          {err && (
            <p role="alert" className="rounded-lg border border-danger/30 bg-danger/5 p-2.5 text-sm">
              {err}
            </p>
          )}

          {options === null ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => void suggest()} disabled={busy}>
                {busy ? <Loader2 className="animate-spin" /> : <Sparkles />} Show me how it could read on my resume
              </Button>
              <Button variant="ghost" onClick={() => save("")}>
                Just remember it
              </Button>
            </div>
          ) : (
            <div className="space-y-2.5">
              <p className="text-sm font-medium">Pick the line you like. You can change it later.</p>
              {options.map((o) => (
                <button key={o} type="button" onClick={() => setLine(o)} className={cn("flex w-full items-start gap-2.5 rounded-lg border p-3 text-left text-sm transition-colors", line === o ? "border-primary bg-primary-soft/50 ring-2 ring-primary/20" : "hover:border-primary/40")}>
                  <span className={cn("mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border", line === o ? "border-primary bg-primary text-primary-foreground" : "border-input")}>{line === o && <Check className="h-3 w-3" strokeWidth={3} />}</span>
                  {o}
                </button>
              ))}
              <div className="flex flex-wrap gap-2 pt-1">
                <Button onClick={() => save(line)} disabled={!line && options.length > 0}>
                  Save it
                </Button>
                <Button variant="ghost" onClick={() => save("")}>
                  Save without a line
                </Button>
                <Button variant="ghost" onClick={() => void suggest()} disabled={busy}>
                  Try again
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
