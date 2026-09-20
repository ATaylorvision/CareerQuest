import { useState } from "react";
import { Check, HelpCircle, SkipForward } from "lucide-react";
import { Card, Segmented, SectionTitle } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { useStore, type AppState } from "@/store/AppStore";

type Kind = "text" | "money" | "miles" | "remote";

interface Question {
  id: string;
  kind: Kind;
  ask: string;
  why: string;
  placeholder?: string;
  /** True when we still do not know the answer. */
  missing: (s: AppState) => boolean;
  save: (s: AppState, value: string) => void;
}

/**
 * The things we do not know about someone that would change which jobs they
 * see. Asked one at a time, on the page they already look at, rather than in
 * a setup flow they finished weeks ago.
 */
const QUESTIONS: Question[] = [
  {
    id: "home",
    kind: "text",
    ask: "Where do you actually live?",
    why: "Every onsite and hybrid search starts from here. Without it we cannot tell a job across town from one across the country.",
    placeholder: "City, State",
    missing: (s) => !s.profile.location.trim(),
    save: (s, v) => void (s.profile.location = v),
  },
  {
    id: "distance",
    kind: "miles",
    ask: "How far would you actually commute?",
    why: "Anything further than this is left out of your matches instead of wasting your evening.",
    missing: (s) => !!s.profile.location.trim() && !s.answered?.distance,
    save: (s, v) => void (s.prefs.maxDistanceMiles = Number(v)),
  },
  {
    id: "roles",
    kind: "text",
    ask: "What job title are you aiming for?",
    why: "We search on the exact words employers put in their postings, so one real title beats a general description.",
    placeholder: "Operations Manager",
    missing: (s) => s.prefs.roles.length === 0,
    save: (s, v) => void s.prefs.roles.push(v),
  },
  {
    id: "remote",
    kind: "remote",
    ask: "Onsite, hybrid, or remote?",
    why: "This decides whether we search your area, the whole country, or both.",
    missing: (s) => !s.answered?.remote,
    save: (s, v) => void (s.prefs.remote = v as AppState["prefs"]["remote"]),
  },
  {
    id: "salary",
    kind: "money",
    ask: "What is the lowest salary you would say yes to?",
    why: "We will still show you roles below it, marked, rather than pretending they do not exist.",
    placeholder: "55000",
    missing: (s) => !s.answered?.salary,
    save: (s, v) => void (s.prefs.salaryFloor = Math.max(15000, Number(v.replace(/[^0-9]/g, "")) || s.prefs.salaryFloor)),
  },
  {
    id: "dealbreaker",
    kind: "text",
    ask: "Name one thing that would make you turn a job down.",
    why: "Postings that carry it get pushed down your list.",
    placeholder: "Overnight shifts",
    missing: (s) => s.prefs.dealbreakers.length === 0,
    save: (s, v) => void s.prefs.dealbreakers.push(v),
  },
];

export function ProfileQuestions() {
  const { state, update } = useStore();
  const [skipped, setSkipped] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [miles, setMiles] = useState(state.prefs.maxDistanceMiles);

  const q = QUESTIONS.find((x) => !skipped.includes(x.id) && x.missing(state));
  if (!q) return null;

  const answer = (value: string) => {
    update((s) => {
      q.save(s, value);
      if (!s.answered) s.answered = {};
      s.answered[q.id] = true;
    });
    setText("");
  };

  return (
    <Card>
      <SectionTitle icon={HelpCircle} sub="One question. It changes which jobs reach you.">
        Sharpen your matches
      </SectionTitle>
      <p className="text-sm font-medium">{q.ask}</p>
      <p className="mt-1 text-xs text-muted-foreground">{q.why}</p>

      <div className="mt-3 space-y-3">
        {(q.kind === "text" || q.kind === "money") && (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (text.trim()) answer(text.trim());
            }}
          >
            <Input
              className="h-9"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={q.placeholder}
              inputMode={q.kind === "money" ? "numeric" : undefined}
              aria-label={q.ask}
            />
            <Button size="sm" type="submit" disabled={!text.trim()}>
              <Check /> Save
            </Button>
          </form>
        )}

        {q.kind === "miles" && (
          <div>
            <div className="mb-2 flex justify-between text-sm">
              <span className="text-muted-foreground">Up to</span>
              <span className="num font-semibold">{miles >= 100 ? "Any distance" : `${miles} miles`}</span>
            </div>
            <Slider value={[miles]} min={5} max={100} step={5} onValueChange={([v]) => setMiles(v)} aria-label="How far you would commute" />
            <Button size="sm" className="mt-3" onClick={() => answer(String(miles))}>
              <Check /> That is right
            </Button>
          </div>
        )}

        {q.kind === "remote" && (
          <Segmented<"any" | "remote" | "hybrid" | "onsite">
            value={state.prefs.remote}
            onChange={(v) => answer(v)}
            options={[
              { value: "onsite", label: "Onsite" },
              { value: "hybrid", label: "Hybrid" },
              { value: "remote", label: "Remote" },
              { value: "any", label: "Open" },
            ]}
          />
        )}

        <Button size="xs" variant="ghost" className="text-muted-foreground" onClick={() => setSkipped((a) => [...a, q.id])}>
          <SkipForward /> Not now
        </Button>
      </div>
    </Card>
  );
}
