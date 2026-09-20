import { useState } from "react";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Resume, ResumeRole } from "@/data/user";
import { useStore } from "@/store/AppStore";

/** Every prompt here asks for something the person already knows. Nothing is invented for them. */
const BULLET_PROMPTS = [
  "What did you actually do most days?",
  "What did you look after: people, money, stock, schedules, customers?",
  "What got better because you were there? Put a number on it if you have one.",
  "What did you fix, set up, or clean up?",
];

let seq = 0;
const newRole = (): ResumeRole => ({
  id: `role-new-${++seq}`,
  title: "",
  company: "",
  location: "",
  start: "",
  end: "",
  bullets: [{ id: `nb-${++seq}`, text: "" }],
});

function Section({ n, title, hint, children }: { n: number; title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="card-base p-5 sm:p-6">
      <div className="mb-4">
        <h2 className="flex items-center gap-2 font-semibold">
          <span className="num flex h-6 w-6 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">{n}</span>
          {title}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
      </div>
      {children}
    </section>
  );
}

/**
 * For people who do not have a resume file to upload. They answer plain
 * questions about work they have done, and that becomes the base resume the
 * rest of CareerQuest reads. Nothing is added on their behalf.
 */
export function ResumeBuilder({ onCancel, onDone }: { onCancel: () => void; onDone: (r: Resume) => void }) {
  const { state } = useStore();
  const [r, setR] = useState<Resume>(() => ({
    name: state.profile.name,
    email: state.profile.email,
    phone: "",
    location: state.profile.location,
    summary: "",
    roles: [newRole()],
    education: [],
    certifications: [],
    skills: [],
  }));
  const [education, setEducation] = useState("");
  const [certs, setCerts] = useState("");
  const [skills, setSkills] = useState("");

  const edit = (fn: (draft: Resume) => void) =>
    setR((prev) => {
      const d = structuredClone(prev);
      fn(d);
      return d;
    });

  const filledRoles = r.roles.filter((x) => x.title.trim() && x.company.trim());
  const ready = !!r.name.trim() && filledRoles.length > 0;

  const finish = () => {
    const split = (s: string) => s.split(/\s*[|\n]\s*/).map((x) => x.trim()).filter(Boolean);
    onDone({
      ...r,
      name: r.name.trim(),
      roles: filledRoles.map((role) => ({ ...role, bullets: role.bullets.filter((b) => b.text.trim()) })),
      education: split(education),
      certifications: split(certs),
      skills: skills.split(/\s*[,\n]\s*/).map((x) => x.trim()).filter(Boolean),
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center">
        <p className="flex-1 text-sm text-muted-foreground">
          Answer what you can. You can leave anything blank and fill it in later, and you can change every word of this afterwards.
        </p>
        <Button variant="outline" size="sm" onClick={onCancel}>
          <ArrowLeft /> I do have a file
        </Button>
      </div>

      <Section n={1} title="Who you are" hint="This sits at the top of the page an employer reads.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {([
            ["name", "Full name", "Your name"],
            ["email", "Email", "you@example.com"],
            ["phone", "Phone", "(555) 555-0100"],
            ["location", "City and state", "Providence, RI"],
          ] as const).map(([k, label, ph]) => (
            <div key={k} className="space-y-1.5">
              <Label htmlFor={`b-${k}`}>{label}</Label>
              <Input id={`b-${k}`} value={r[k]} placeholder={ph} onChange={(e) => edit((d) => void (d[k] = e.target.value))} />
            </div>
          ))}
        </div>
        <div className="mt-4 space-y-1.5">
          <Label htmlFor="b-summary">In one or two sentences, what kind of work have you done?</Label>
          <Textarea
            id="b-summary"
            rows={2}
            value={r.summary}
            placeholder="Ran a busy store for eight years. Good with stock, schedules, and people."
            onChange={(e) => edit((d) => void (d.summary = e.target.value))}
          />
          <p className="text-xs text-muted-foreground">Plain words are fine. The Studio can put this in a job's language later.</p>
        </div>
      </Section>

      <Section n={2} title="Where you have worked" hint="Start with the most recent. Paid, unpaid, family business, seasonal: all of it counts.">
        <div className="space-y-5">
          {r.roles.map((role, ri) => (
            <div key={role.id} className="rounded-xl border p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1.3fr_1.2fr]">
                <div className="space-y-1.5">
                  <Label htmlFor={`${role.id}-t`}>What were you called?</Label>
                  <Input id={`${role.id}-t`} value={role.title} placeholder="Store Manager" onChange={(e) => edit((d) => void (d.roles[ri].title = e.target.value))} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`${role.id}-c`}>Where?</Label>
                  <Input id={`${role.id}-c`} value={role.company} placeholder="Harbor & Pine Home" onChange={(e) => edit((d) => void (d.roles[ri].company = e.target.value))} />
                </div>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor={`${role.id}-l`}>City and state</Label>
                  <Input id={`${role.id}-l`} value={role.location} placeholder="Warwick, RI" onChange={(e) => edit((d) => void (d.roles[ri].location = e.target.value))} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`${role.id}-s`}>Started</Label>
                  <Input id={`${role.id}-s`} value={role.start} placeholder="Jun 2018" onChange={(e) => edit((d) => void (d.roles[ri].start = e.target.value))} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`${role.id}-e`}>Ended</Label>
                  <Input id={`${role.id}-e`} value={role.end} placeholder="Present" onChange={(e) => edit((d) => void (d.roles[ri].end = e.target.value))} />
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <div className="text-sm font-medium">What did you do there?</div>
                {role.bullets.map((b, bi) => (
                  <div key={b.id} className="group flex items-start gap-2">
                    <span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                    <Textarea
                      rows={2}
                      value={b.text}
                      aria-label={`Line ${bi + 1} for ${role.title || "this job"}`}
                      placeholder={BULLET_PROMPTS[bi % BULLET_PROMPTS.length]}
                      className="min-h-0 resize-none text-sm"
                      onChange={(e) => edit((d) => void (d.roles[ri].bullets[bi].text = e.target.value))}
                    />
                    {role.bullets.length > 1 && (
                      <Button variant="ghost" size="icon-sm" className="mt-1 opacity-60 group-hover:opacity-100" aria-label="Remove this line" onClick={() => edit((d) => void d.roles[ri].bullets.splice(bi, 1))}>
                        <Trash2 />
                      </Button>
                    )}
                  </div>
                ))}
                <Button variant="outline" size="xs" onClick={() => edit((d) => void d.roles[ri].bullets.push({ id: `nb-${++seq}`, text: "" }))}>
                  <Plus /> Another line
                </Button>
              </div>

              {r.roles.length > 1 && (
                <Button variant="ghost" size="xs" className="mt-3 text-muted-foreground" onClick={() => edit((d) => void d.roles.splice(ri, 1))}>
                  <Trash2 /> Remove this job
                </Button>
              )}
            </div>
          ))}
          <Button variant="outline" onClick={() => edit((d) => void d.roles.push(newRole()))}>
            <Plus /> Add another job
          </Button>
        </div>
      </Section>

      <Section n={3} title="School, certificates, and skills" hint="Only what you actually hold. We will never add a credential for you.">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="b-edu">Education</Label>
            <Textarea id="b-edu" rows={2} value={education} placeholder={"B.A. Communications, University of Rhode Island, 2013\nOne per line"} onChange={(e) => setEducation(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="b-cert">Certifications</Label>
            <Textarea id="b-cert" rows={2} value={certs} placeholder={"Lean Six Sigma Yellow Belt, 2021\nOne per line. Leave blank if you have none."} onChange={(e) => setCerts(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="b-skills">Tools and skills, separated by commas</Label>
            <Textarea id="b-skills" rows={2} value={skills} placeholder="Inventory management, Excel, Scheduling, Vendor management" onChange={(e) => setSkills(e.target.value)} />
          </div>
        </div>
      </Section>

      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center">
        <p className="flex-1 text-sm text-muted-foreground">
          {ready ? "This becomes your base resume. Tailoring for a job never changes it." : "Add your name and at least one job to continue."}
        </p>
        <Button disabled={!ready} onClick={finish}>
          Use this as my resume
        </Button>
      </div>
    </div>
  );
}
