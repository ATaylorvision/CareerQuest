import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronLeft, MessagesSquare, Plus, Search } from "lucide-react";
import { WrenAvatar } from "@/components/common";
import { Chat, newConversation } from "@/components/copilot/Chat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStore } from "@/store/AppStore";
import { COPILOT_NAME } from "@/data/copilot";
import { relFromIso } from "@/lib/date";
import { useDocTitle } from "@/hooks/useDocTitle";
import { cn } from "@/lib/utils";

export default function Copilot() {
  useDocTitle(`Copilot, ${COPILOT_NAME}`);
  const { state, update } = useStore();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState("");
  const [mobileList, setMobileList] = useState(!params.get("c"));
  const activeId = params.get("c") ?? state.chats[0]?.id;
  const active = state.chats.find((c) => c.id === activeId) ?? state.chats[0];
  const list = state.chats.filter((c) => !q || `${c.title} ${c.messages.map((m) => m.text).join(" ")}`.toLowerCase().includes(q.toLowerCase()));

  const startNew = () => {
    const c = newConversation();
    update((s) => void s.chats.unshift(c));
    setParams({ c: c.id });
    setMobileList(false);
  };

  return (
    <div className="-mb-20 lg:-mb-8">
      <div className="card-base flex h-[calc(100vh-11rem)] min-h-[520px] overflow-hidden p-0 lg:h-[calc(100vh-8.5rem)]">
        {/* Conversation list */}
        <aside className={cn("flex w-full flex-col border-r md:w-80 md:shrink-0", mobileList ? "flex" : "hidden md:flex")} aria-label="Conversations">
          <div className="border-b p-4">
            <div className="mb-3 flex items-center gap-3">
              <WrenAvatar size={40} />
              <div className="min-w-0 flex-1">
                <h1 className="font-display text-lg font-semibold leading-tight">{COPILOT_NAME}</h1>
                <p className="text-xs text-muted-foreground">Your career coach. Knows your resume and tracker.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search conversations" className="h-9 pl-8" aria-label="Search conversations" />
              </div>
              <Button size="icon-sm" className="h-9 w-9" onClick={startNew} aria-label="New conversation">
                <Plus />
              </Button>
            </div>
          </div>
          <ul className="flex-1 overflow-y-auto p-2 scrollbar-thin">
            {list.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => {
                    setParams({ c: c.id });
                    setMobileList(false);
                  }}
                  aria-current={c.id === active?.id}
                  className={cn("w-full rounded-lg px-3 py-2.5 text-left transition-colors", c.id === active?.id ? "bg-primary-soft" : "hover:bg-accent")}
                >
                  <div className={cn("truncate text-sm font-medium", c.id === active?.id && "text-primary")}>{c.title}</div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="rounded bg-muted px-1.5 py-0.5">{c.topic}</span>
                    <span>{relFromIso(c.updatedAt)}</span>
                  </div>
                </button>
              </li>
            ))}
            {list.length === 0 && <li className="p-4 text-center text-sm text-muted-foreground">No conversations match.</li>}
          </ul>
        </aside>

        {/* Chat */}
        <section className={cn("min-w-0 flex-1 flex-col", mobileList ? "hidden md:flex" : "flex")} aria-label="Conversation">
          <header className="flex items-center gap-3 border-b px-4 py-3">
            <Button variant="ghost" size="icon-sm" className="md:hidden" onClick={() => setMobileList(true)} aria-label="Back to conversations">
              <ChevronLeft />
            </Button>
            <MessagesSquare className="hidden h-4 w-4 text-muted-foreground md:block" />
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-sm font-semibold">{active?.title}</h2>
              <p className="text-xs text-muted-foreground">{active?.messages.length ?? 0} messages</p>
            </div>
          </header>
          <div className="min-h-0 flex-1">{active && <Chat key={active.id} conversationId={active.id} onNew={startNew} />}</div>
        </section>
      </div>
    </div>
  );
}
