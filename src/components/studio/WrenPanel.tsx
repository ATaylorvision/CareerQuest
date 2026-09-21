import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2, PenLine, Send, Undo2, X } from "lucide-react";
import { Segmented } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, ApiError } from "@/live/api";
import { wordDiff } from "@/lib/diff";
import { cn } from "@/lib/utils";

/** The resume as it is on the page right now, which is what Wren works from. */
export interface PageSnapshot {
  summary: string;
  skills: string[];
  roles: { id: string; title: string; company: string; bullets: { id: string; text: string }[] }[];
}

interface Proposal {
  id: string;
  kind: "replace" | "add";
  field: string;
  roleId: string;
  before: string;
  after: string;
  why: string;
}

type Status = "pending" | "applied" | "skipped";

interface Message {
  id: number;
  from: "you" | "wren";
  text: string;
  proposals?: (Proposal & { status: Status })[];
}

interface Props {
  jobId: string;
  snapshot: PageSnapshot;
  /** Puts new text on a field of the page. Returns a function that puts it back. */
  onReplace: (field: string, text: string) => () => void;
  /** Adds a line under a role. Returns a function that takes it out again. */
  onAdd: (roleId: string, text: string) => () => void;
}

const STARTERS = ["Make my summary fit this job", "Strengthen my weakest lines", "Put the most relevant skills first"];

function Diff({ before, after }: { before: string; after: string }) {
  const { left, right } = useMemo(() => wordDiff(before, after), [before, after]);
  const view = (tokens: { text: string; kind: string }[], side: "left" | "right") => (
    <p className="text-[13px] leading-relaxed">
      {tokens.map((t, i) => (
        <span
          key={i}
          className={cn(
            t.kind === "del" && side === "left" && "rounded bg-danger/15 px-0.5 text-danger line-through decoration-danger/50",
            t.kind === "add" && side === "right" && "rounded bg-success/15 px-0.5 font-medium text-success",
          )}
        >
          {t.text}{" "}
        </span>
      ))}
    </p>
  );
  return (
    <div className="space-y-1.5">
      <div className="rounded-lg bg-muted/50 p-2.5">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Now</div>
        {view(left, "left")}
      </div>
      <div className="rounded-lg bg-success-soft/60 p-2.5">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Wren suggests</div>
        {view(right, "right")}
      </div>
    </div>
  );
}

function fieldLabel(p: Proposal, snap: PageSnapshot) {
  if (p.kind === "add") {
    const r = snap.roles.find((x) => x.id === p.roleId);
    return `New line under ${r ? r.title : "your experience"}`;
  }
  if (p.field === "summary") return "Summary";
  if (p.field === "skills") return "Skills";
  const r = snap.roles.find((x) => x.bullets.some((b) => b.id === p.field));
  return r ? `A line under ${r.title}` : "A line";
}

/* ---------------- ask Wren ---------------- */

function AskWren({ jobId, snapshot, onReplace, onAdd }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const undo = useRef(new Map<string, () => void>());
  const idRef = useRef(1);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length, busy]);

  const send = async (text: string) => {
    const message = text.trim();
    if (message.length < 3 || busy) return;
    setError(null);
    setInput("");
    const history = messages.slice(-6).map((m) => ({ from: m.from, text: m.text }));
    setMessages((m) => [...m, { id: idRef.current++, from: "you", text: message }]);
    setBusy(true);
    try {
      const out = await api<{ reply: string; proposals: Proposal[] }>("studio", { action: "agent", jobId, message, history, resume: snapshot });
      setMessages((m) => [...m, { id: idRef.current++, from: "wren", text: out.reply, proposals: out.proposals.map((p) => ({ ...p, status: "pending" as Status })) }]);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const setStatus = (mid: number, pid: string, status: Status) =>
    setMessages((all) => all.map((m) => (m.id === mid ? { ...m, proposals: m.proposals?.map((p) => (p.id === pid ? { ...p, status } : p)) } : m)));

  const apply = (mid: number, p: Proposal) => {
    const back = p.kind === "add" ? onAdd(p.roleId, p.after) : onReplace(p.field, p.after);
    undo.current.set(`${mid}:${p.id}`, back);
    setStatus(mid, p.id, "applied");
  };
  const revert = (mid: number, p: Proposal) => {
    undo.current.get(`${mid}:${p.id}`)?.();
    undo.current.delete(`${mid}:${p.id}`);
    setStatus(mid, p.id, "pending");
  };

  return (
    <div>
      {messages.length === 0 && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Tell Wren what to change. Every edit comes as a card you accept or skip, and nothing is added that you have not said or that is not already on your resume.</p>
          <div className="flex flex-wrap gap-1.5">
            {STARTERS.map((s) => (
              <button key={s} type="button" onClick={() => void send(s)} className="rounded-full border bg-background px-2.5 py-1 text-xs hover:border-primary/50 hover:bg-accent/40">
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <ul className="space-y-3" aria-live="polite">
        {messages.map((m) => (
          <li key={m.id} className={cn(m.from === "you" && "flex justify-end")}>
            <div className={cn("max-w-full", m.from === "you" ? "rounded-xl bg-primary px-3 py-2 text-sm text-primary-foreground" : "w-full")}>
              {m.from === "you" ? (
                m.text
              ) : (
                <div className="space-y-2.5">
                  <p className="text-sm">{m.text}</p>
                  {m.proposals?.map((p) => (
                    <div key={p.id} className={cn("rounded-xl border bg-card p-3", p.status === "applied" && "border-success-border", p.status === "skipped" && "opacity-60")}>
                      <div className="mb-2 text-xs font-semibold text-foreground/80">{fieldLabel(p, snapshot)}</div>
                      {p.kind === "add" ? (
                        <div className="rounded-lg bg-success-soft/60 p-2.5 text-[13px] leading-relaxed">{p.after}</div>
                      ) : p.field === "skills" ? (
                        <div className="space-y-1.5 text-[13px] leading-relaxed">
                          <div className="rounded-lg bg-muted/50 p-2.5">{p.before}</div>
                          <div className="rounded-lg bg-success-soft/60 p-2.5">{p.after}</div>
                        </div>
                      ) : (
                        <Diff before={p.before} after={p.after} />
                      )}
                      <p className="mt-2 text-xs text-muted-foreground">{p.why}</p>
                      <div className="mt-2.5 flex gap-1.5">
                        {p.status === "pending" && (
                          <>
                            <Button size="xs" onClick={() => apply(m.id, p)}>
                              <Check /> Use it
                            </Button>
                            <Button size="xs" variant="outline" onClick={() => setStatus(m.id, p.id, "skipped")}>
                              <X /> Skip
                            </Button>
                          </>
                        )}
                        {p.status === "applied" && (
                          <>
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                              <Check className="h-3.5 w-3.5" /> On your resume
                            </span>
                            {undo.current.has(`${m.id}:${p.id}`) && (
                              <Button size="xs" variant="ghost" onClick={() => revert(m.id, p)}>
                                <Undo2 /> Undo
                              </Button>
                            )}
                          </>
                        )}
                        {p.status === "skipped" && (
                          <Button size="xs" variant="ghost" onClick={() => setStatus(m.id, p.id, "pending")}>
                            <Undo2 /> Reconsider
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </li>
        ))}
        {busy && (
          <li className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Wren is reading your resume
          </li>
        )}
        <div ref={endRef} />
      </ul>

      {error && <p role="alert" className="mt-2 rounded-lg border border-danger/30 bg-danger/5 p-2.5 text-sm">{error}</p>}

      <form
        className="mt-3 flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(input);
            }
          }}
          placeholder="For example: I also trained 6 new hires. Add that."
          aria-label="Tell Wren what to change"
          rows={2}
          maxLength={1200}
          className="min-h-0 resize-none text-sm"
        />
        <Button type="submit" size="icon" disabled={busy || input.trim().length < 3} aria-label="Send to Wren">
          <Send />
        </Button>
      </form>
    </div>
  );
}

/* ---------------- write this line ---------------- */

function WriteLine({ jobId, snapshot, onReplace, onAdd }: Props) {
  const [target, setTarget] = useState<string>(snapshot.roles[0]?.id ?? "summary");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<string[]>([]);
  const [used, setUsed] = useState<number | null>(null);
  const back = useRef<(() => void) | null>(null);

  const write = async () => {
    setBusy(true);
    setError(null);
    setOptions([]);
    setUsed(null);
    try {
      const out = await api<{ options: string[] }>("studio", { action: "writeLine", jobId, target: target === "summary" ? "summary" : "bullet", notes, resume: snapshot });
      setOptions(out.options);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const use = (i: number, text: string) => {
    back.current?.();
    back.current = target === "summary" ? onReplace("summary", text) : onAdd(target, text);
    setUsed(i);
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Describe something you did in your own rough words. Wren turns it into resume writing, using only what you say.</p>
      <div>
        <label htmlFor="wl-target" className="mb-1 block text-xs font-semibold text-muted-foreground">
          Where does it go?
        </label>
        <Select value={target} onValueChange={setTarget}>
          <SelectTrigger id="wl-target" className="h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {snapshot.roles.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                A new line under {r.title}, {r.company}
              </SelectItem>
            ))}
            <SelectItem value="summary">Rewrite my summary</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <label htmlFor="wl-notes" className="mb-1 block text-xs font-semibold text-muted-foreground">
          What did you do?
        </label>
        <Textarea id="wl-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={1000} placeholder="For example: trained new hires on the receiving dock, about 6 people, and cut the mistakes" className="text-sm" />
      </div>
      <Button className="w-full" disabled={busy || notes.trim().split(/\s+/).length < 3} onClick={() => void write()}>
        {busy ? <Loader2 className="animate-spin" /> : <PenLine />} Write it
      </Button>
      {error && <p role="alert" className="rounded-lg border border-danger/30 bg-danger/5 p-2.5 text-sm">{error}</p>}
      {options.length > 0 && (
        <ul className="space-y-2">
          {options.map((o, i) => (
            <li key={i} className={cn("rounded-xl border bg-card p-3", used === i && "border-success-border")}>
              <p className="text-[13px] leading-relaxed">{o}</p>
              <div className="mt-2">
                {used === i ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                    <Check className="h-3.5 w-3.5" /> On your resume. Click the line there to adjust it.
                  </span>
                ) : (
                  <Button size="xs" variant="outline" onClick={() => use(i, o)}>
                    {target === "summary" ? "Use as my summary" : "Add to my resume"}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function WrenPanel(props: Props) {
  const [tab, setTab] = useState<"ask" | "line">("ask");
  return (
    <div>
      <Segmented<"ask" | "line"> value={tab} onChange={setTab} options={[{ value: "ask", label: "Ask Wren" }, { value: "line", label: "Write a line" }]} className="mb-3" />
      {/* Both stay mounted, so switching tabs never loses the conversation. */}
      <div hidden={tab !== "ask"}>
        <AskWren {...props} />
      </div>
      <div hidden={tab !== "line"}>
        <WriteLine {...props} />
      </div>
    </div>
  );
}
