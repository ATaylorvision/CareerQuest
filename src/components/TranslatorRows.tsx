import { ArrowRight } from "lucide-react";
import { BULLET_TRANSLATIONS } from "@/data/translator";
import { bulletById } from "@/data/user";
import type { TargetField } from "@/data/jobs";
import { cn } from "@/lib/utils";

export function TranslatorRow({ from, phrases, meta, index = 0, highlight }: { from: string; phrases: string[]; meta?: React.ReactNode; index?: number; highlight?: boolean }) {
  return (
    <div
      className={cn(
        "group grid grid-cols-1 gap-3 rounded-xl border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-card md:grid-cols-[1fr_40px_1.05fr] md:items-center md:p-5 animate-fade-up",
        highlight && "border-primary/40 ring-2 ring-primary/10",
      )}
      style={{ animationDelay: `${index * 70}ms` }}
    >
      <p className="text-sm leading-relaxed text-foreground/85">{from}</p>
      <div className="flex justify-center" aria-hidden>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-soft text-primary transition-transform group-hover:translate-x-0.5">
          <ArrowRight className="h-4 w-4 rotate-90 md:rotate-0" />
        </span>
      </div>
      <div>
        <div className="flex flex-wrap gap-1.5">
          {phrases.map((p, j) => (
            <span key={p} className="rounded-lg border border-primary/20 bg-primary-soft px-2.5 py-1 text-[13px] font-medium text-primary animate-pop" style={{ animationDelay: `${index * 70 + j * 50}ms` }}>
              {p}
            </span>
          ))}
        </div>
        {meta && <div className="mt-2 text-xs text-muted-foreground">{meta}</div>}
      </div>
    </div>
  );
}

export function TranslatorForBullets({ ids, target, savedTotal }: { ids: string[]; target: TargetField; savedTotal?: number }) {
  return (
    <div className="space-y-2.5">
      {ids.map((id, i) => {
        const b = bulletById(id);
        const t = BULLET_TRANSLATIONS[id]?.[target];
        if (!b || !t) return null;
        return (
          <TranslatorRow
            key={id}
            index={i}
            from={b.text}
            phrases={t.phrases}
            meta={savedTotal ? <>This language appears in <b className="num text-foreground">{Math.min(t.appearsIn, savedTotal)}</b> of your {savedTotal} saved jobs.</> : undefined}
          />
        );
      })}
    </div>
  );
}

export function topBulletsFor(target: TargetField, n = 4) {
  return Object.entries(BULLET_TRANSLATIONS)
    .sort((a, b) => b[1][target].appearsIn - a[1][target].appearsIn)
    .slice(0, n)
    .map(([id]) => id);
}
