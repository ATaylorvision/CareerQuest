import { AlertTriangle, BadgeCheck, CheckCircle2, CircleDot, Clock, Hand, Lock, ShieldAlert, ShieldCheck, ShieldQuestion, Send, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { LEGIT_META, type LegitBadge } from "@/data/jobs";
import { METHOD_META, type Method } from "@/data/applications";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export type Tone = "success" | "info" | "warning" | "danger" | "muted" | "primary";

export const TONE_CLASS: Record<Tone, string> = {
  success: "bg-success-soft text-success border-success-border",
  info: "bg-info-soft text-info border-info-border",
  warning: "bg-warning-soft text-warning border-warning-border",
  danger: "bg-danger-soft text-danger border-danger-border",
  muted: "bg-muted text-muted-foreground border-border",
  primary: "bg-primary-soft text-primary border-primary/20",
};

export const TONE_TEXT: Record<Tone, string> = {
  success: "text-success",
  info: "text-info",
  warning: "text-warning",
  danger: "text-danger",
  muted: "text-muted-foreground",
  primary: "text-primary",
};

export const TONE_BG: Record<Tone, string> = {
  success: "bg-success",
  info: "bg-info",
  warning: "bg-warning",
  danger: "bg-danger",
  muted: "bg-muted-foreground",
  primary: "bg-primary",
};

export function Pill({ tone = "muted", icon: Icon, children, className, size = "sm" }: { tone?: Tone; icon?: React.ComponentType<{ className?: string }>; children: React.ReactNode; className?: string; size?: "xs" | "sm" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-medium whitespace-nowrap",
        size === "xs" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-0.5 text-xs",
        TONE_CLASS[tone],
        className,
      )}
    >
      {Icon && <Icon className={size === "xs" ? "h-3 w-3" : "h-3.5 w-3.5"} aria-hidden />}
      {children}
    </span>
  );
}

const LEGIT_ICON: Record<LegitBadge, React.ComponentType<{ className?: string }>> = {
  verified: ShieldCheck,
  active: ShieldQuestion,
  stale: Clock,
  ghost: ShieldAlert,
};

export function LegitBadgeView({ badge, score, size = "sm", withTip = true }: { badge: LegitBadge; score?: number; size?: "xs" | "sm"; withTip?: boolean }) {
  const meta = LEGIT_META[badge];
  const pill = (
    <Pill tone={meta.tone} icon={LEGIT_ICON[badge]} size={size}>
      {meta.label}
      {score !== undefined && <span className="num opacity-80">· {score}</span>}
    </Pill>
  );
  if (!withTip) return pill;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="rounded-full" aria-label={`${meta.label}. Legitimacy score ${score ?? ""}. ${meta.help}`}>
          {pill}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-[260px] text-xs leading-relaxed">
        <b>{meta.label}.</b> {meta.help}
      </TooltipContent>
    </Tooltip>
  );
}

const METHOD_ICON: Record<Method, React.ComponentType<{ className?: string }>> = {
  submitted: Send,
  prefilled: Hand,
  manual: AlertTriangle,
};

export function MethodBadge({ method, size = "sm", withTip = true }: { method: Method; size?: "xs" | "sm"; withTip?: boolean }) {
  const meta = METHOD_META[method];
  if (!withTip) {
    return (
      <Pill tone={meta.tone} icon={METHOD_ICON[method]} size={size}>
        {meta.label}
      </Pill>
    );
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="rounded-full">
          <Pill tone={meta.tone} icon={METHOD_ICON[method]} size={size}>
            {meta.label}
          </Pill>
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-[260px] text-xs leading-relaxed">{meta.help}</TooltipContent>
    </Tooltip>
  );
}

export function VerifiedMark({ verified, size = "sm" }: { verified: boolean; size?: "xs" | "sm" }) {
  return verified ? (
    <Pill tone="success" icon={BadgeCheck} size={size}>
      Verified
    </Pill>
  ) : (
    <Pill tone="warning" icon={CircleDot} size={size}>
      Not verified yet
    </Pill>
  );
}

export function TruthModeBadge({ className }: { className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label="Truth Mode is on and cannot be turned off. CareerQuest will never add a skill, number, employer, or date that is not already in your resume."
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border border-success-border bg-success-soft px-3 py-1 text-xs font-semibold text-success cursor-help",
            className,
          )}
        >
          <Lock className="h-3.5 w-3.5" aria-hidden />
          Truth Mode: On
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-[280px] text-xs leading-relaxed">
        CareerQuest will never add a skill, number, employer, or date that is not already in your resume.
      </TooltipContent>
    </Tooltip>
  );
}

export function SampleTag({ children = "Sample data", className }: { children?: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md border border-dashed px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground", className)}>
      <Info className="h-3 w-3" aria-hidden />
      {children}
    </span>
  );
}

export function CheckIcon({ className }: { className?: string }) {
  return <CheckCircle2 className={className} aria-hidden />;
}
