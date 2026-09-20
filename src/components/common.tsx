import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Company } from "@/data/companies";
import { COPILOT_NAME } from "@/data/copilot";

/* ---------------- count up ---------------- */

export function useCountUp(target: number, duration = 900, start = true) {
  const [val, setVal] = useState(start ? 0 : target);
  const from = useRef(0);
  useEffect(() => {
    if (!start) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setVal(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const f = from.current;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const e = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(f + (target - f) * e));
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, start]);
  return val;
}

/* ---------------- score ring ---------------- */

export function scoreTone(n: number) {
  return n >= 85 ? "success" : n >= 70 ? "primary" : n >= 55 ? "warning" : "danger";
}

const RING_COLOR: Record<string, string> = {
  success: "hsl(var(--success))",
  primary: "hsl(var(--primary))",
  warning: "hsl(var(--warning))",
  danger: "hsl(var(--danger))",
};

export function ScoreRing({ value, size = 56, stroke = 5, label, sub, tone, className, display }: { value: number; size?: number; stroke?: number; label?: string; sub?: string; tone?: string; className?: string; display?: string }) {
  const shown = useCountUp(value);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const t = tone ?? scoreTone(value);
  return (
    <div className={cn("relative inline-flex shrink-0 items-center justify-center", className)} style={{ width: size, height: size }} role="img" aria-label={`${label ?? "Score"} ${value} out of 100`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={RING_COLOR[t]}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (shown / 100) * c}
          style={{ transition: "stroke-dashoffset 80ms linear" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="num font-semibold" style={{ fontSize: display ? size * 0.26 : size * 0.3 }}>
          {display ?? shown}
        </span>
        {sub && <span className="mt-0.5 text-[10px] text-muted-foreground">{sub}</span>}
      </div>
    </div>
  );
}

export function ScoreBar({ value, max = 100, tone, className, height = 8, label }: { value: number; max?: number; tone?: string; className?: string; height?: number; label?: string }) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setW((value / max) * 100));
    return () => cancelAnimationFrame(id);
  }, [value, max]);
  const t = tone ?? scoreTone((value / max) * 100);
  return (
    <div className={cn("w-full overflow-hidden rounded-full bg-muted", className)} style={{ height }} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} aria-label={label}>
      <div className="h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${w}%`, background: RING_COLOR[t] }} />
    </div>
  );
}

/* ---------------- avatars ---------------- */

export function CompanyLogo({ company, size = 40, className }: { company: Company; size?: number; className?: string }) {
  const agency = company.isAgency;
  return (
    <div
      className={cn("flex shrink-0 items-center justify-center rounded-lg border font-semibold", className)}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.34,
        background: agency ? "hsl(var(--muted))" : `hsl(${company.hue} 55% 94%)`,
        color: agency ? "hsl(var(--muted-foreground))" : `hsl(${company.hue} 50% 28%)`,
        borderColor: agency ? undefined : `hsl(${company.hue} 40% 86%)`,
      }}
      aria-hidden
    >
      <span className="dark:brightness-[2.4] dark:saturate-50">{company.initials}</span>
    </div>
  );
}

export function PersonAvatar({ name, hue = 214, size = 40 }: { name: string; hue?: number; size?: number }) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-semibold"
      style={{ width: size, height: size, fontSize: size * 0.36, background: `hsl(${hue} 50% 92%)`, color: `hsl(${hue} 45% 28%)` }}
      aria-hidden
    >
      {initials}
    </div>
  );
}

export function WrenAvatar({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <div className={cn("flex shrink-0 items-center justify-center rounded-full bg-primary-soft", className)} style={{ width: size, height: size }} aria-label={`${COPILOT_NAME}, your copilot`} role="img">
      <svg viewBox="0 0 32 32" width={size * 0.72} height={size * 0.72} aria-hidden>
        <path d="M6 19c0-6 5-10.5 11-10.5 3.2 0 5.6 1.3 7 3.3l3.5-.8-2 3.2c.3 1 .5 2 .5 3 0 5.5-4.5 8.8-10 8.8-3.4 0-6-1-7.6-2.8L5 25l2.2-3.4C6.4 20.9 6 20 6 19z" fill="hsl(var(--primary))" />
        <path d="M11 20.5c2.5 2 6.5 2.2 9.5 0" stroke="hsl(var(--primary-soft))" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        <circle cx="20.5" cy="14" r="1.6" fill="hsl(var(--primary-soft))" />
      </svg>
    </div>
  );
}

/* ---------------- logo ---------------- */

export function Logo({ to = "/", className, compact }: { to?: string; className?: string; compact?: boolean }) {
  return (
    <Link to={to} className={cn("group inline-flex items-center gap-2 rounded-md", className)} aria-label="CareerQuest home">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm transition-transform group-hover:-rotate-6">
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
          <path d="M5 13l4.5 4.5L19 7" stroke="currentColor" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      {!compact && <span className="font-display text-lg font-semibold tracking-tight">CareerQuest</span>}
    </Link>
  );
}

/* ---------------- page header ---------------- */

export function PageHeader({ title, sub, actions, eyebrow }: { title: React.ReactNode; sub?: React.ReactNode; actions?: React.ReactNode; eyebrow?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-primary">{eyebrow}</div>}
        <h1 className="font-display text-2xl font-semibold leading-tight sm:text-3xl text-balance">{title}</h1>
        {sub && <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground sm:text-[15px]">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("card-base p-5 sm:p-6", className)} {...rest}>
      {children}
    </div>
  );
}

export function SectionTitle({ children, sub, right, icon: Icon }: { children: React.ReactNode; sub?: React.ReactNode; right?: React.ReactNode; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h2 className="flex items-center gap-2 text-base font-semibold">
          {Icon && <Icon className="h-4 w-4 text-primary" />}
          {children}
        </h2>
        {sub && <p className="mt-0.5 text-sm text-muted-foreground">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

/* ---------------- AI working ---------------- */

export function AiWorking({ steps, onDone, stepMs = 700, title = "Working on it", hold }: { steps: string[]; onDone?: () => void; stepMs?: number; title?: string; hold?: boolean }) {
  const [i, setI] = useState(0);
  const done = useRef(false);
  useEffect(() => {
    // With hold, wait on the last step until the real work finishes and the caller removes this.
    if (hold && i >= steps.length - 1) return;
    if (i >= steps.length) {
      if (!done.current) {
        done.current = true;
        const t = setTimeout(() => onDone?.(), 250);
        return () => clearTimeout(t);
      }
      return;
    }
    const t = setTimeout(() => setI((n) => n + 1), stepMs);
    return () => clearTimeout(t);
  }, [i, steps.length, stepMs, onDone]);
  return (
    <div className="space-y-3" role="status" aria-live="polite">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Sparkles className="h-4 w-4 text-primary" />
        {title}
      </div>
      <ul className="space-y-2">
        {steps.map((s, idx) => (
          <li key={s} className={cn("flex items-center gap-2.5 text-sm transition-opacity", idx > i ? "opacity-40" : "opacity-100")}>
            {idx < i ? (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-success text-white animate-pop">
                <Check className="h-3 w-3" strokeWidth={3} />
              </span>
            ) : idx === i ? (
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            ) : (
              <span className="h-5 w-5 rounded-full border-2 border-muted" />
            )}
            <span className={idx < i ? "text-muted-foreground" : ""}>{s}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SkeletonLines({ lines = 4, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("space-y-2.5", className)} aria-hidden>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="skeleton h-3.5" style={{ width: `${[92, 100, 84, 96, 70, 88][i % 6]}%` }} />
      ))}
    </div>
  );
}

export function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1" aria-label="Typing">
      {[0, 1, 2].map((i) => (
        <span key={i} className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-pulse-dot" style={{ animationDelay: `${i * 0.18}s` }} />
      ))}
    </span>
  );
}

/* ---------------- tiny markdown ---------------- */

function inline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => (p.startsWith("**") && p.endsWith("**") ? <strong key={i} className="font-semibold">{p.slice(2, -2)}</strong> : <React.Fragment key={i}>{p}</React.Fragment>));
}

export function RichText({ text, className }: { text: string; className?: string }) {
  const blocks = text.split(/\n\n+/);
  return (
    <div className={cn("space-y-3 leading-relaxed", className)}>
      {blocks.map((b, i) => {
        const lines = b.split("\n");
        if (lines.every((l) => /^- /.test(l))) {
          return (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {lines.map((l, j) => (
                <li key={j}>{inline(l.slice(2))}</li>
              ))}
            </ul>
          );
        }
        if (lines.every((l) => /^\d+\. /.test(l))) {
          return (
            <ol key={i} className="list-decimal space-y-1 pl-5">
              {lines.map((l, j) => (
                <li key={j}>{inline(l.replace(/^\d+\. /, ""))}</li>
              ))}
            </ol>
          );
        }
        if (lines.length > 1 && /^- /.test(lines[1])) {
          return (
            <div key={i}>
              <p>{inline(lines[0])}</p>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {lines.slice(1).map((l, j) => (
                  <li key={j}>{inline(l.replace(/^- /, ""))}</li>
                ))}
              </ul>
            </div>
          );
        }
        return (
          <p key={i} className="whitespace-pre-line">
            {inline(b)}
          </p>
        );
      })}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, body, action }: { icon: React.ComponentType<{ className?: string }>; title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-12 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-muted">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options, className, size = "sm" }: { value: T; onChange: (v: T) => void; options: { value: NoInfer<T>; label: React.ReactNode }[]; className?: string; size?: "sm" | "md" }) {
  return (
    <div role="radiogroup" className={cn("inline-flex rounded-lg border bg-muted/60 p-0.5", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md font-medium transition-all",
            size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm",
            value === o.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Chip({ active, onClick, children, className }: { active?: boolean; onClick?: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
        active ? "border-primary bg-primary-soft text-primary" : "bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}
