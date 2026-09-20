import { useEffect, useRef, useState } from "react";
import { ArrowUp, Plus } from "lucide-react";
import { useStore } from "@/store/AppStore";
import { COPILOT_NAME, QUICK_PROMPTS, copilotReply, type Conversation } from "@/data/copilot";
import { RichText, TypingDots, WrenAvatar } from "@/components/common";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fmtDateTime } from "@/lib/date";
import { apiStream } from "@/live/api";
import { toast } from "sonner";

const LIVE_PROMPTS = [
  "What are my strongest matches and why?",
  "What are my biggest gaps right now?",
  "How do I explain my career change?",
  "How should I talk about my layoff?",
  "What should I do first today?",
];

export function newConversation(): Conversation {
  return { id: `c-${Date.now().toString(36)}`, title: "New conversation", topic: "General", updatedAt: new Date().toISOString(), messages: [] };
}

function titleFrom(text: string) {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > 48 ? `${t.slice(0, 46).trim()}...` : t;
}

export function Chat({ conversationId, compact, onNew }: { conversationId: string; compact?: boolean; onNew?: () => void }) {
  const { state, update } = useStore();
  const convo = state.chats.find((c) => c.id === conversationId) ?? state.chats[0];
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [streaming, setStreaming] = useState<string | null>(null);
  const live = state.mode === "live";
  const scroller = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [convo?.messages.length, thinking, streaming]);

  if (!convo) return null;

  const send = (text: string) => {
    const t = text.trim();
    if (!t || thinking || streaming !== null) return;
    const id = convo.id;
    update((s) => {
      const c = s.chats.find((x) => x.id === id)!;
      c.messages.push({ id: `u${Date.now()}`, role: "user", text: t, at: new Date().toISOString() });
      if (c.messages.length === 1) c.title = titleFrom(t);
      c.updatedAt = new Date().toISOString();
      s.usage.copilotMessages += 1;
      // most recent first
      s.chats = [c, ...s.chats.filter((x) => x.id !== id)];
    });
    setInput("");
    setThinking(true);

    if (live) {
      const history = [...convo.messages, { role: "user" as const, text: t }].slice(-20).map((m) => ({ role: m.role, content: m.text }));
      let acc = "";
      apiStream("chat", { messages: history }, (piece) => {
        if (acc === "") setThinking(false);
        acc += piece;
        setStreaming(acc);
      })
        .then((full) => {
          update((s) => {
            const c = s.chats.find((x) => x.id === id)!;
            c.messages.push({ id: `a${Date.now()}`, role: "assistant", text: full.trim(), at: new Date().toISOString() });
            c.updatedAt = new Date().toISOString();
            s.activity[0] = true;
          });
        })
        .catch((e: Error) => toast.error("Wren could not answer just now", { description: e.message }))
        .finally(() => {
          setThinking(false);
          setStreaming(null);
        });
      return;
    }

    const reply = copilotReply(t);
    const delay = 900 + Math.min(1200, t.length * 12);
    setTimeout(() => {
      setThinking(false);
      const words = reply.split(/(\s+)/);
      let i = 0;
      setStreaming("");
      const iv = setInterval(() => {
        i += 3;
        if (i >= words.length) {
          clearInterval(iv);
          setStreaming(null);
          update((s) => {
            const c = s.chats.find((x) => x.id === id)!;
            c.messages.push({ id: `a${Date.now()}`, role: "assistant", text: reply, at: new Date().toISOString() });
            c.updatedAt = new Date().toISOString();
          });
        } else {
          setStreaming(words.slice(0, i).join(""));
        }
      }, 28);
    }, delay);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={scroller} className="scrollbar-thin flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6">
        {convo.messages.length === 0 && (
          <div className="mx-auto max-w-md pt-6 text-center">
            <WrenAvatar size={52} className="mx-auto" />
            <h3 className="mt-3 font-display text-xl font-semibold">Hi {state.profile.name.split(" ")[0] || "there"}. I am {COPILOT_NAME}.</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">
              I know your resume, your tracker, and your matches. Ask me about a role, a gap, an offer, or an interview. I will be straight with you.
            </p>
          </div>
        )}
        {convo.messages.map((m) => (
          <Bubble key={m.id} role={m.role} text={m.text} at={m.at} compact={compact} />
        ))}
        {thinking && (
          <div className="flex items-start gap-3">
            <WrenAvatar size={30} />
            <div className="rounded-2xl rounded-tl-sm border bg-card px-4 py-3">
              <TypingDots />
            </div>
          </div>
        )}
        {streaming !== null && <Bubble role="assistant" text={streaming || " "} compact={compact} />}
      </div>

      <div className="border-t bg-background/80 px-3 pb-3 pt-2.5 backdrop-blur sm:px-5">
        {convo.messages.length < 2 && (
          <div className="scrollbar-thin mb-2 flex gap-2 overflow-x-auto pb-1">
            {(live ? LIVE_PROMPTS : QUICK_PROMPTS).map((p) => (
              <button key={p} onClick={() => send(p)} className="shrink-0 rounded-full border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground">
                {p}
              </button>
            ))}
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex items-end gap-2 rounded-xl border bg-card p-1.5 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/15"
        >
          {onNew && (
            <Button type="button" variant="ghost" size="icon-sm" onClick={onNew} aria-label="Start a new conversation" className="shrink-0">
              <Plus />
            </Button>
          )}
          <label htmlFor={`chat-${compact ? "c" : "f"}`} className="sr-only">
            Message {COPILOT_NAME}
          </label>
          <textarea
            id={`chat-${compact ? "c" : "f"}`}
            ref={taRef}
            value={input}
            rows={1}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = `${Math.min(140, e.target.scrollHeight)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder={`Ask ${COPILOT_NAME} anything about your search`}
            className="max-h-36 min-h-[36px] flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:outline-none"
          />
          <Button type="submit" size="icon-sm" disabled={!input.trim() || thinking || streaming !== null} aria-label="Send message" className="shrink-0 rounded-lg">
            <ArrowUp />
          </Button>
        </form>
        <p className="mt-1.5 px-1 text-[11px] text-muted-foreground">
          {live ? `${COPILOT_NAME} uses your real resume, matches, and applications. It can be wrong, so check facts before you act on them.` : `${COPILOT_NAME} uses only what is in your resume and tracker. Prototype: replies are pre written samples.`}
        </p>
      </div>
    </div>
  );
}

function Bubble({ role, text, at, compact }: { role: "user" | "assistant"; text: string; at?: string; compact?: boolean }) {
  if (role === "user") {
    return (
      <div className="flex justify-end animate-fade-up">
        <div className={cn("rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground", compact ? "max-w-[85%]" : "max-w-[75%]")}>
          <p className="whitespace-pre-line">{text}</p>
          {at && <div className="mt-1 text-right text-[10px] opacity-70">{fmtDateTime(at)}</div>}
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-3">
      <WrenAvatar size={30} />
      <div className={cn("rounded-2xl rounded-tl-sm border bg-card px-4 py-3 text-sm shadow-sm", compact ? "max-w-[88%]" : "max-w-[80%]")}>
        <RichText text={text} />
        {at && <div className="mt-2 text-[10px] text-muted-foreground">{COPILOT_NAME} · {fmtDateTime(at)}</div>}
      </div>
    </div>
  );
}
