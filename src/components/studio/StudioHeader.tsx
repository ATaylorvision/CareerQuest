import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, ChevronDown, ClipboardPaste, FileText, Mail, MoreHorizontal, PenLine, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Pill } from "@/components/status";
import { scoreTone } from "@/components/common";
import type { Job } from "@/data/jobs";
import type { ResumeVersion } from "@/data/resumeStudio";
import { cn } from "@/lib/utils";

type Doc = "resume" | "letter";

/** One section of the resume a person can jump straight to. */
export interface DocSection {
  id: string;
  label: string;
}

const SCORE_TONE_CLASS: Record<string, string> = {
  success: "text-success",
  primary: "text-primary",
  warning: "text-warning",
  danger: "text-danger",
};

/**
 * The library switcher: every job you have tailored for, in one place, styled
 * like a real document picker rather than a plain field. Replaces the old
 * "Working on" select and the buried Saved versions list with one thing.
 */
function LibrarySwitcher({
  job,
  jobOptions,
  versions,
  activeVersionId,
  onSelect,
  onMakeDefault,
  onDelete,
}: {
  job: Job;
  jobOptions: Job[];
  versions: ResumeVersion[];
  activeVersionId: string;
  onSelect: (id: string) => void;
  onMakeDefault: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const versionFor = (id: string) => versions.find((v) => v.id === `v-${id}`);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-10 max-w-[280px] justify-between gap-2 border-2 bg-background px-3 font-semibold">
          <span className="min-w-0 truncate">
            {job.title} <span className="font-normal text-muted-foreground">· {job.company.name}</span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[340px] p-2">
        <div className="mb-1.5 px-1.5 pt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your tailored resumes</div>
        <ul className="max-h-[360px] space-y-1 overflow-y-auto scrollbar-thin">
          {jobOptions.map((j) => {
            const v = versionFor(j.id);
            const isCurrent = j.id === job.id;
            const isDefault = v && activeVersionId === v.id;
            return (
              <li key={j.id} className={cn("group flex items-center gap-2 rounded-lg px-2 py-2 transition-colors", isCurrent ? "bg-primary-soft" : "hover:bg-accent")}>
                <button type="button" onClick={() => { onSelect(j.id); setOpen(false); }} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                  {isCurrent ? <Check className="h-4 w-4 shrink-0 text-primary" /> : <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{j.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">{j.company.name}</span>
                  </span>
                  {v && (
                    <span className={cn("num shrink-0 text-xs font-semibold", SCORE_TONE_CLASS[scoreTone(v.ats)])} title={`ATS score ${v.ats}`}>
                      {v.ats}
                    </span>
                  )}
                  {isDefault && (
                    <Pill size="xs" tone="primary" icon={Star}>
                      Default
                    </Pill>
                  )}
                </button>
                {v && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100" aria-label={`More for ${j.title}`}>
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {!isDefault && <DropdownMenuItem onSelect={() => onMakeDefault(v.id)}>Make default</DropdownMenuItem>}
                      {v.id !== "v-base" && (
                        <DropdownMenuItem className="text-danger" onSelect={() => onDelete(v.id)}>
                          <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

/** Jumps to a part of the resume. Purely a scroll aid: nothing here changes what doc is shown. */
function SectionTabs({ sections }: { sections: DocSection[] }) {
  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  return (
    <div className="-mx-1 flex min-w-0 flex-1 gap-1 overflow-x-auto px-1 scrollbar-thin" aria-label="Jump to a section">
      {sections.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => jump(s.id)}
          className="shrink-0 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

export function StudioHeader({
  job,
  jobOptions,
  versions,
  activeVersionId,
  onSelectJob,
  onMakeDefault,
  onDeleteVersion,
  doc,
  onToggleDoc,
  sections,
  onAddJob,
  guest,
}: {
  job: Job;
  jobOptions: Job[];
  versions: ResumeVersion[];
  activeVersionId: string;
  onSelectJob: (id: string) => void;
  onMakeDefault: (id: string) => void;
  onDeleteVersion: (id: string) => void;
  doc: Doc;
  onToggleDoc: () => void;
  sections: DocSection[];
  onAddJob: () => void;
  guest: boolean;
}) {
  return (
    <div className="mb-4 flex flex-col gap-2 rounded-xl border bg-card p-2 lg:flex-row lg:items-center">
      <div className="min-w-0">
        <LibrarySwitcher job={job} jobOptions={jobOptions} versions={versions} activeVersionId={activeVersionId} onSelect={onSelectJob} onMakeDefault={onMakeDefault} onDelete={onDeleteVersion} />
      </div>
      {doc === "resume" && sections.length > 0 && <SectionTabs sections={sections} />}

      <div className="flex flex-wrap items-center gap-1.5 lg:ml-auto lg:shrink-0 lg:flex-nowrap">
        {!guest && (
          <Button asChild variant="ghost" size="sm">
            <Link to={`/app/jobs/${job.id}`}>
              View posting <ArrowRight />
            </Link>
          </Button>
        )}
        {!guest && (
          <Button variant="ghost" size="sm" onClick={onAddJob}>
            <ClipboardPaste /> Add a job
          </Button>
        )}
        {!guest && (
          <Button variant={doc === "letter" ? "soft" : "outline"} size="sm" onClick={onToggleDoc}>
            {doc === "letter" ? <PenLine /> : <Mail />} {doc === "letter" ? "Back to resume" : "AI Cover Letter"}
          </Button>
        )}
      </div>
    </div>
  );
}
