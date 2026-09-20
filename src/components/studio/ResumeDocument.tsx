import { EditableText } from "./EditableText";
import type { BuiltResume } from "@/lib/resumeBuild";
import { cn } from "@/lib/utils";

/**
 * The resume exactly as it would be sent, and the place where it is edited.
 *
 * There is no separate edit mode: every line on the page is the field. Lines
 * the tailor changed and you accepted are tinted, lines you retyped yourself
 * carry a left rule, so it stays obvious where each word came from.
 */
export function ResumeDocument({
  r,
  highlight = true,
  onEdit,
  onContactEdit,
}: {
  r: BuiltResume;
  highlight?: boolean;
  onEdit: (fieldId: string, value: string) => void;
  onContactEdit: (field: "name" | "email" | "phone" | "location", value: string) => void;
}) {
  // Your own words win over a suggestion, so a line you retyped is marked as
  // yours and nothing else. Tinting it as tailored too would be a lie.
  const marks = (id: string) =>
    r.editedIds.has(id)
      ? "border-l-2 border-primary/50 -ml-2 pl-1.5"
      : cn(highlight && r.changedIds.has(id) && "bg-success-soft");

  const H = ({ children }: { children: React.ReactNode }) => (
    <h3 className="mb-1.5 mt-5 border-b border-neutral-400 pb-0.5 text-xs font-semibold tracking-[0.15em]">{children}</h3>
  );

  return (
    <div className="mx-auto max-w-[720px] rounded-lg border bg-white p-6 font-serif text-[13px] leading-relaxed text-neutral-900 shadow-card sm:p-10">
      <EditableText as="h2" value={r.name} label="Your name" placeholder="Your name" onCommit={(v) => onContactEdit("name", v)} className="block text-2xl font-semibold tracking-wide" />
      <div className="mt-1 text-neutral-600">
        <EditableText value={r.location} label="Your city and state" placeholder="City, State" onCommit={(v) => onContactEdit("location", v)} />
        <span className="px-1.5 text-neutral-400" aria-hidden>
          |
        </span>
        <EditableText value={r.phone} label="Your phone number" placeholder="Phone" onCommit={(v) => onContactEdit("phone", v)} />
        <span className="px-1.5 text-neutral-400" aria-hidden>
          |
        </span>
        <EditableText value={r.email} label="Your email address" placeholder="Email" onCommit={(v) => onContactEdit("email", v)} />
      </div>

      <H>SUMMARY</H>
      <EditableText as="p" multiline value={r.summary} label="Summary" placeholder="A sentence or two on the work you have done" onCommit={(v) => onEdit("summary", v)} className={cn("block", marks("summary"))} />

      <H>EXPERIENCE</H>
      {r.roles.map((role) => (
        <div key={role.id} className="mb-3">
          <div className="flex flex-wrap justify-between gap-x-4">
            <span>
              <EditableText value={role.title} label={`Job title at ${role.company}`} onCommit={(v) => onEdit(`${role.id}.title`, v)} className="font-bold" />
              {", "}
              <EditableText value={role.company} label={`Employer for ${role.title}`} onCommit={(v) => onEdit(`${role.id}.company`, v)} />
              {", "}
              <EditableText value={role.location} label={`Where you did ${role.title}`} onCommit={(v) => onEdit(`${role.id}.location`, v)} />
            </span>
            <span className="text-neutral-600">
              <EditableText value={role.start} label={`Start date for ${role.title}`} onCommit={(v) => onEdit(`${role.id}.start`, v)} />
              {" to "}
              <EditableText value={role.end} label={`End date for ${role.title}`} onCommit={(v) => onEdit(`${role.id}.end`, v)} />
            </span>
          </div>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {role.bullets.map((b) => (
              <li key={b.id}>
                <EditableText multiline value={b.text} label={`Line under ${role.title}`} onCommit={(v) => onEdit(b.id, v)} className={cn("block", marks(b.id))} />
              </li>
            ))}
          </ul>
        </div>
      ))}

      <H>EDUCATION</H>
      <EditableText as="p" value={r.education.join(" | ")} label="Education" placeholder="School or program, separated by |" onCommit={(v) => onEdit("education", v)} className={cn("block", marks("education"))} />
      {!r.certsOwnSection && r.certifications.length > 0 && (
        <EditableText as="p" value={r.certifications.join(" | ")} label="Certifications" onCommit={(v) => onEdit("certifications", v)} className={cn("block", marks("certifications"))} />
      )}
      {r.certsOwnSection && (
        <>
          <H>CERTIFICATIONS</H>
          <EditableText as="p" value={r.certifications.join(" | ")} label="Certifications" onCommit={(v) => onEdit("certifications", v)} className={cn("block", marks("certifications"))} />
        </>
      )}

      <H>SKILLS</H>
      <EditableText as="p" multiline value={r.skills.join(", ")} label="Skills" placeholder="Tools and skills, separated by commas" onCommit={(v) => onEdit("skills", v)} className={cn("block", marks("skills"))} />
    </div>
  );
}
