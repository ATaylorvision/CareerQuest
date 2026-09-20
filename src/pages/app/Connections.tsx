import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Briefcase, Check, Copy, Lock, MessageSquareReply, Phone, RefreshCw, Send, Users, Wand2 } from "lucide-react";
import { Card, Chip, PageHeader, PersonAvatar, ScoreBar, SectionTitle } from "@/components/common";
import { Pill, SampleTag } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useStore } from "@/store/AppStore";
import { OUTREACH_META, REASON_META, type Connection, type OutreachStatus, type ReasonType } from "@/data/connections";
import { jobById } from "@/data/jobs";
import { isPro } from "@/lib/selectors";
import { useDocTitle } from "@/hooks/useDocTitle";
import { cn } from "@/lib/utils";

function shorter(msg: string) {
  const sentences = msg.split(/(?<=\.)\s+/);
  return [sentences[0], sentences[sentences.length - 2] ?? "", sentences[sentences.length - 1]].filter(Boolean).join(" ");
}

function warmer(msg: string, name: string) {
  return msg.replace(/^Hi [A-Z][a-z]+,/, `Hi ${name.split(" ")[0]}, I hope your week is going well.`);
}

export default function Connections() {
  useDocTitle("Insider Connections");
  const { state, update } = useStore();
  const pro = isPro(state);
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState<ReasonType | "all">("all");
  const selectedId = params.get("person") ?? state.connections[0]?.id ?? "";
  const person = state.connections.find((c) => c.id === selectedId) ?? state.connections[0];
  const [draft, setDraft] = useState(person?.draft ?? "");
  const [rewriting, setRewriting] = useState(false);

  useEffect(() => setDraft(person?.draft ?? ""), [person?.id, person?.draft]);

  const list = useMemo(
    () => [...state.connections].filter((c) => filter === "all" || c.reasonType === filter).sort((a, b) => b.strength - a.strength),
    [state.connections, filter],
  );

  // Every hook above has run, so this early return is safe. A real account
  // starts with no contacts, and the rest of this page assumes one exists.
  if (!person) {
    return (
      <div>
        <PageHeader title="Insider Connections" sub="A referral beats a cold application. This works from contacts you bring, matched to the companies you are targeting." />
        <Card className="text-center">
          <Users className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">No contacts yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            No public service lets anyone see your network, so this only ever works from contacts you add yourself. Importing them is still being built.
          </p>
          <Button asChild variant="outline" size="sm" className="mt-4">
            <Link to="/app/matches">Back to your matches</Link>
          </Button>
        </Card>
      </div>
    );
  }

  const setStatus = (c: Connection, status: OutreachStatus) => {
    update((s) => {
      const p = s.connections.find((x) => x.id === c.id)!;
      p.status = status;
      p.lastTouch = 0;
      p.draft = draft;
      if (status === "sent") p.followUpIn = 5;
      if (c.id === "p1" && status === "sent") {
        s.planDone.p4 = true;
        s.activity[0] = true;
      }
    });
    toast.success(`${c.name}: ${OUTREACH_META[status].label}`, { description: status === "sent" ? "We will remind you to follow up in 5 days if you have not heard back." : undefined });
  };

  const rewrite = (kind: "shorter" | "warmer") => {
    setRewriting(true);
    setTimeout(() => {
      setDraft((d) => (kind === "shorter" ? shorter(d) : warmer(d, person.name)));
      setRewriting(false);
    }, 700);
  };

  const counts = (Object.keys(OUTREACH_META) as OutreachStatus[]).map((s) => ({ s, n: state.connections.filter((c) => c.status === s).length }));

  if (!pro) {
    return (
      <div>
        <PageHeader title="Insider Connections" sub="People at your target companies who share something real with you." />
        <Card className="relative overflow-hidden">
          <div className="pointer-events-none select-none space-y-3 blur-sm" aria-hidden>
            {state.connections.slice(0, 4).map((c) => (
              <div key={c.id} className="flex items-center gap-3 rounded-lg border p-3">
                <PersonAvatar name={c.name} hue={c.hue} />
                <div>
                  <div className="font-medium">{c.name}</div>
                  <div className="text-sm text-muted-foreground">{c.reason}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-card/70 p-6 text-center">
            <Lock className="mb-2 h-6 w-6 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Insider Connections is part of Pro</h2>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">We found {state.connections.length} people at your target companies, including 3 who worked at Harbor & Pine Home.</p>
            <Button asChild className="mt-4">
              <Link to="/app/billing">See Pro, $24 a month</Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Insider Connections"
        sub="People at your target companies who share something real with you. Weighted toward shared former employers and people who made the same pivot, not just alumni."
        actions={state.mode === "live" ? undefined : <SampleTag>People shown are fictional</SampleTag>}
      />

      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {counts.map(({ s, n }) => (
          <div key={s} className="rounded-xl border bg-card p-3">
            <div className="num text-2xl font-semibold">{n}</div>
            <Pill size="xs" tone={OUTREACH_META[s].tone}>{OUTREACH_META[s].label}</Pill>
          </div>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Chip active={filter === "all"} onClick={() => setFilter("all")}>
          Everyone
        </Chip>
        {(Object.keys(REASON_META) as ReasonType[]).map((r) => (
          <Chip key={r} active={filter === r} onClick={() => setFilter(r)}>
            {REASON_META[r].label}
          </Chip>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr]">
        <ul className="space-y-2.5" aria-label="People">
          {list.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => setParams({ person: c.id })}
                aria-current={c.id === person.id}
                className={cn("card-base w-full p-4 text-left transition-all hover:border-primary/40", c.id === person.id && "border-primary ring-2 ring-primary/15")}
              >
                <div className="flex items-start gap-3">
                  <PersonAvatar name={c.name} hue={c.hue} size={42} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{c.name}</span>
                      <Pill size="xs" tone={OUTREACH_META[c.status].tone}>{OUTREACH_META[c.status].label}</Pill>
                    </div>
                    <div className="truncate text-sm text-muted-foreground">
                      {c.title}, {c.company}
                    </div>
                    <div className="mt-2 text-xs">
                      <span className={cn("font-semibold", c.reasonType === "former-employer" ? "text-success" : c.reasonType === "shared-pivot" ? "text-primary" : "text-muted-foreground")}>{REASON_META[c.reasonType].label}: </span>
                      <span className="text-foreground/80">{c.reason}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <ScoreBar value={c.strength} height={5} tone={c.strength >= 80 ? "success" : c.strength >= 60 ? "primary" : "warning"} label={`Connection strength ${c.strength}`} />
                      <span className="num w-7 text-right text-xs text-muted-foreground">{c.strength}</span>
                    </div>
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>

        <div className="min-w-0 space-y-6">
          <Card key={person.id} className="animate-fade-up">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <PersonAvatar name={person.name} hue={person.hue} size={56} />
              <div className="flex-1">
                <h2 className="font-display text-2xl font-semibold">{person.name}</h2>
                <div className="text-muted-foreground">
                  {person.title}, {person.company}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Pill tone={person.reasonType === "former-employer" ? "success" : person.reasonType === "shared-pivot" ? "primary" : "muted"}>{REASON_META[person.reasonType].label}</Pill>
                  <Pill tone="muted">{REASON_META[person.reasonType].weight}</Pill>
                </div>
              </div>
            </div>
            <div className="mt-5 rounded-lg bg-muted/50 p-4 text-sm">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Why you are connected</div>
              {person.detail}
            </div>
            {person.openJobs.length > 0 && (
              <div className="mt-4">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Open roles at {person.company}</div>
                <div className="flex flex-wrap gap-2">
                  {person.openJobs.map((id) => {
                    const j = jobById(id)!;
                    return (
                      <Link key={id} to={`/app/jobs/${id}`} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors hover:border-primary/40 hover:bg-accent">
                        <Briefcase className="h-3.5 w-3.5 text-muted-foreground" /> {j.title} <span className="num text-xs text-primary">{j.match}%</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </Card>

          <Card>
            <SectionTitle icon={Wand2} sub="Drafted in your voice from your resume and your shared history. Edit anything. Nothing sends from CareerQuest, you copy it into whatever channel you use.">Suggested message</SectionTitle>
            <Label htmlFor="draft" className="sr-only">
              Message to {person.name}
            </Label>
            <Textarea id="draft" rows={7} value={draft} onChange={(e) => setDraft(e.target.value)} className={cn("text-[15px] leading-relaxed transition-opacity", rewriting && "opacity-40")} />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>
                <span className="num">{draft.split(/\s+/).filter(Boolean).length}</span> words. Under 90 gets more replies.
              </span>
              <div className="flex gap-1.5">
                <Button size="xs" variant="ghost" onClick={() => rewrite("shorter")} disabled={rewriting}>
                  <RefreshCw /> Shorter
                </Button>
                <Button size="xs" variant="ghost" onClick={() => rewrite("warmer")} disabled={rewriting}>
                  <RefreshCw /> Warmer
                </Button>
                <Button size="xs" variant="ghost" onClick={() => setDraft(state.connections.find((c) => c.id === person.id)!.draft)}>
                  Reset
                </Button>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard?.writeText(draft).catch(() => undefined);
                  if (person.status === "none") setStatus(person, "drafted");
                  toast.success("Message copied", { description: "Paste it wherever you usually reach people. Then mark it sent." });
                }}
              >
                <Copy /> Copy message
              </Button>
              {person.status !== "sent" && person.status !== "replied" && person.status !== "meeting" && (
                <Button onClick={() => setStatus(person, "sent")}>
                  <Send /> Mark as sent
                </Button>
              )}
              {person.status === "sent" && (
                <Button variant="outline" onClick={() => setStatus(person, "replied")}>
                  <MessageSquareReply /> They replied
                </Button>
              )}
              {(person.status === "sent" || person.status === "replied") && (
                <Button variant="outline" onClick={() => setStatus(person, "meeting")}>
                  <Phone /> Call scheduled
                </Button>
              )}
              {person.status === "meeting" && (
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-success">
                  <Check className="h-4 w-4" /> Call scheduled. Ask Wren to help you prepare.
                </span>
              )}
            </div>
          </Card>

          <Card className="overflow-hidden p-0 sm:p-0">
            <div className="border-b p-5">
              <SectionTitle icon={Users} sub="Everyone you have reached out to, and what is next.">Outreach tracker</SectionTitle>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-5 py-2.5 font-medium">Person</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Status</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Last touch</th>
                    <th scope="col" className="px-5 py-2.5 font-medium">Next step</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {state.connections
                    .filter((c) => c.status !== "none")
                    .map((c) => (
                      <tr key={c.id} className="cursor-pointer transition-colors hover:bg-accent/40" onClick={() => setParams({ person: c.id })}>
                        <td className="px-5 py-3">
                          <div className="font-medium">{c.name}</div>
                          <div className="text-xs text-muted-foreground">{c.company}</div>
                        </td>
                        <td className="px-3 py-3">
                          <Pill size="xs" tone={OUTREACH_META[c.status].tone}>{OUTREACH_META[c.status].label}</Pill>
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">{c.lastTouch === undefined ? "Not yet" : c.lastTouch === 0 ? "Today" : `${c.lastTouch} days ago`}</td>
                        <td className="px-5 py-3 text-muted-foreground">
                          {c.status === "drafted" && "Send the draft"}
                          {c.status === "sent" && `Follow up in ${c.followUpIn ?? 5} days if no reply`}
                          {c.status === "replied" && "Suggest a 15 minute call"}
                          {c.status === "meeting" && "Prepare two questions"}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
