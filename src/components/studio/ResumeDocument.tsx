import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { EditableText } from "./EditableText";
import type { BuiltResume } from "@/lib/resumeBuild";
import { wordDiff } from "@/lib/diff";
import { cn } from "@/lib/utils";

/** What Wren would change on one line, shown when the person points at it. */
export interface LineSuggestion {
  id: string;
  before: string;
  after: string;
  why: string;
}

interface Hover {
  suggestions?: Record<string, LineSuggestion>;
  onUse?: (id: string) => void;
  onSkip?: (id: string) => void;
  /** Asks for a rewrite of one line. Resolves to false when there was nothing worth changing. */
  onImprove?: (field: string) => Promise<boolean>;
}

function SuggestionCard({ s, field, onUse, onSkip }: { s: LineSuggestion; field: string; onUse: () => void; onSkip: () => void }) {
  const { right } = useMemo(() => wordDiff(s.before, s.after), [s.before, s.after]);
  const plain = field === "skills";
  return (
    <div role="region" aria-label="Wren's suggestion for this line" className="rounded-xl border border-primary/30 bg-white p-3 font-sans text-[13px] leading-relaxed text-neutral-900 shadow-lift">
      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
        <Sparkles className="h-3.5 w-3.5" aria-hidden /> Wren suggests
      </div>
      <p className="rounded-lg bg-success-soft/70 p-2">
        {plain
          ? s.after
          : right.map((t, i) => (
              <span key={i} className={cn(t.kind === "add" && "rounded bg-success/15 px-0.5 font-medium text-success")}>
                {t.text}{" "}
              </span>
            ))}
      </p>
      <p className="mt-1.5 text-xs text-neutral-600">{s.why}</p>
      <div className="mt-2 flex gap-1.5">
        <button type="button" onClick={onUse} className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90">
          <Check className="h-3.5 w-3.5" /> Use it
        </button>
        <button type="button" onClick={onSkip} className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-neutral-50">
          <X className="h-3.5 w-3.5" /> Skip
        </button>
      </div>
    </div>
  );
}

/**
 * Wraps a line so that pointing at it shows Wren's suggestion for it, or offers
 * to write one. Typing on the line hides the card so it never sits over your words.
 */
function Suggestable({ field, hover, children }: { field: string; hover: Hover; children: React.ReactNode }) {
  const s = hover.suggestions?.[field];
  const [open, setOpen] = useState(false);
  const [typing, setTyping] = useState(false);
  const [busy, setBusy] = useState(false);
  const timer = useRef<number>();

  const show = () => {
    window.clearTimeout(timer.current);
    setOpen(true);
  };
  const hide = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(false), 200);
  };
  const isText = (e: React.SyntheticEvent) => (e.target as HTMLElement).getAttribute?.("role") === "textbox";

  const improve = async () => {
    if (!hover.onImprove || busy) return;
    setBusy(true);
    const found = await hover.onImprove(field).catch(() => false);
    setBusy(false);
    if (!found) toast("This line is already strong", { description: "Wren did not find a change worth making." });
  };

  if (!hover.suggestions && !hover.onImprove) return <>{children}</>;

  return (
    <div
      className="relative"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocusCapture={(e) => {
        if (isText(e)) {
          setTyping(true);
          setOpen(false);
        }
      }}
      onBlurCapture={(e) => isText(e) && setTyping(false)}
      onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
    >
      {children}
      {s && (
        <button
          type="button"
          aria-label="See Wren's suggestion for this line"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="absolute -right-3 top-0 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm ring-2 ring-white transition-transform hover:scale-110"
        >
          <Sparkles className="h-3 w-3" aria-hidden />
        </button>
      )}
      {open && !typing && s && (
        <div className="absolute left-0 right-0 top-full z-30 pt-1.5" onMouseEnter={show} onMouseLeave={hide}>
          <SuggestionCard s={s} field={field} onUse={() => hover.onUse?.(s.id)} onSkip={() => hover.onSkip?.(s.id)} />
        </div>
      )}
      {open && !typing && !s && hover.onImprove && (
        <button
          type="button"
          onClick={() => void improve()}
          disabled={busy}
          aria-label="Improve this line with Wren"
          title={busy ? "Wren is thinking" : "Improve this line with Wren"}
          className="absolute -right-3 top-0 z-20 flex h-5 w-5 items-center justify-center rounded-full border border-primary/40 bg-white text-primary shadow-sm transition-transform hover:scale-110 disabled:opacity-70"
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : <Sparkles className="h-3 w-3" aria-hidden />}
        </button>
      )}
    </div>
  );
}

/**
 * The resume exactly as it would be sent, and the place where it is edited.
 *
 * There is no separate edit mode: every line on the page is the field. Lines
 * the tailor changed and you accepted are tinted, lines you retyped yourself
 * carry a left rule, so it stays obvious where each word came from.
 *
 * Every line carries a field id. The score panel uses them to jump to the line
 * a fix is about, and `onLive` reports text as it is typed so the score can
 * follow along without waiting for the person to click away.
 */
export function ResumeDocument({
  r,
  highlight = true,
  onEdit,
  onContactEdit,
  onLive,
  hover = {},
}: {
  r: BuiltResume;
  /** Suggestions that appear when a line is pointed at. Leave out for a plain editable page. */
  hover?: Hover;
  highlight?: boolean;
  onEdit: (fieldId: string, value: string) => void;
  onContactEdit: (field: "name" | "email" | "phone" | "location", value: string) => void;
  /** `text` is null once the line is committed and the draft should be dropped. */
  onLive?: (fieldId: string, text: string | null) => void;
}) {
  // Your own words win over a suggestion, so a line you retyped is marked as
  // yours and nothing else. Tinting it as tailored too would be a lie.
  const marks = (id: string) =>
    r.editedIds.has(id)
      ? "border-l-2 border-primary/50 -ml-2 pl-1.5"
      : cn(highlight && r.changedIds.has(id) && "bg-success-soft");

  const live = (id: string) => (text: string | null) => onLive?.(id, text);

  const H = ({ children }: { children: React.ReactNode }) => (
    <h3 className="mb-1.5 mt-5 border-b border-neutral-400 pb-0.5 text-xs font-semibold tracking-[0.15em]">{children}</h3>
  );

  return (
    <div className="mx-auto max-w-[720px] rounded-lg border bg-white p-6 font-serif text-[13px] leading-relaxed text-neutral-900 shadow-card sm:p-10">
      <EditableText
        as="h2"
        fieldId="contact.name"
        onLive={live("contact.name")}
        value={r.name}
        label="Your name"
        placeholder="Your name"
        onCommit={(v) => onContactEdit("name", v)}
        className="block text-2xl font-semibold tracking-wide"
      />
      <div className="mt-1 text-neutral-600">
        <EditableText fieldId="contact.location" onLive={live("contact.location")} value={r.location} label="Your city and state" placeholder="City, State" onCommit={(v) => onContactEdit("location", v)} />
        <span className="px-1.5 text-neutral-400" aria-hidden>
          |
        </span>
        <EditableText fieldId="contact.phone" onLive={live("contact.phone")} value={r.phone} label="Your phone number" placeholder="Phone" onCommit={(v) => onContactEdit("phone", v)} />
        <span className="px-1.5 text-neutral-400" aria-hidden>
          |
        </span>
        <EditableText fieldId="contact.email" onLive={live("contact.email")} value={r.email} label="Your email address" placeholder="Email" onCommit={(v) => onContactEdit("email", v)} />
      </div>

      <H>SUMMARY</H>
      <Suggestable field="summary" hover={hover}>
      <EditableText
        as="p"
        multiline
        fieldId="summary"
        onLive={live("summary")}
        value={r.summary}
        label="Summary"
        placeholder="A sentence or two on the work you have done"
        onCommit={(v) => onEdit("summary", v)}
        className={cn("block", marks("summary"))}
      />
      </Suggestable>

      <H>EXPERIENCE</H>
      {r.roles.map((role) => (
        <div key={role.id} className="mb-3">
          <div className="flex flex-wrap justify-between gap-x-4">
            <span>
              <EditableText fieldId={`${role.id}.title`} onLive={live(`${role.id}.title`)} value={role.title} label={`Job title at ${role.company}`} onCommit={(v) => onEdit(`${role.id}.title`, v)} className="font-bold" />
              {", "}
              <EditableText fieldId={`${role.id}.company`} onLive={live(`${role.id}.company`)} value={role.company} label={`Employer for ${role.title}`} onCommit={(v) => onEdit(`${role.id}.company`, v)} />
              {", "}
              <EditableText fieldId={`${role.id}.location`} onLive={live(`${role.id}.location`)} value={role.location} label={`Where you did ${role.title}`} onCommit={(v) => onEdit(`${role.id}.location`, v)} />
            </span>
            <span className="text-neutral-600">
              <EditableText fieldId={`${role.id}.start`} onLive={live(`${role.id}.start`)} value={role.start} label={`Start date for ${role.title}`} onCommit={(v) => onEdit(`${role.id}.start`, v)} />
              {" to "}
              <EditableText fieldId={`${role.id}.end`} onLive={live(`${role.id}.end`)} value={role.end} label={`End date for ${role.title}`} onCommit={(v) => onEdit(`${role.id}.end`, v)} />
            </span>
          </div>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {role.bullets.map((b) => (
              <li key={b.id}>
                <Suggestable field={b.id} hover={hover}>
                  <EditableText multiline fieldId={b.id} onLive={live(b.id)} value={b.text} label={`Line under ${role.title}`} onCommit={(v) => onEdit(b.id, v)} className={cn("block", marks(b.id))} />
                </Suggestable>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <H>EDUCATION</H>
      <EditableText
        as="p"
        fieldId="education"
        onLive={live("education")}
        value={r.education.join(" | ")}
        label="Education"
        placeholder="School or program, separated by |"
        onCommit={(v) => onEdit("education", v)}
        className={cn("block", marks("education"))}
      />
      {!r.certsOwnSection && r.certifications.length > 0 && (
        <EditableText as="p" fieldId="certifications" onLive={live("certifications")} value={r.certifications.join(" | ")} label="Certifications" onCommit={(v) => onEdit("certifications", v)} className={cn("block", marks("certifications"))} />
      )}
      {r.certsOwnSection && (
        <>
          <H>CERTIFICATIONS</H>
          <EditableText as="p" fieldId="certifications" onLive={live("certifications")} value={r.certifications.join(" | ")} label="Certifications" onCommit={(v) => onEdit("certifications", v)} className={cn("block", marks("certifications"))} />
        </>
      )}

      <H>SKILLS</H>
      <Suggestable field="skills" hover={hover}>
      <EditableText
        as="p"
        multiline
        fieldId="skills"
        onLive={live("skills")}
        value={r.skills.join(", ")}
        label="Skills"
        placeholder="Tools and skills, separated by commas"
        onCommit={(v) => onEdit("skills", v)}
        className={cn("block", marks("skills"))}
      />
      </Suggestable>
    </div>
  );
}
