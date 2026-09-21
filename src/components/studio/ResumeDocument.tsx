import { EditableText } from "./EditableText";
import type { BuiltResume } from "@/lib/resumeBuild";
import { cn } from "@/lib/utils";

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
}: {
  r: BuiltResume;
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
                <EditableText multiline fieldId={b.id} onLive={live(b.id)} value={b.text} label={`Line under ${role.title}`} onCommit={(v) => onEdit(b.id, v)} className={cn("block", marks(b.id))} />
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
    </div>
  );
}
