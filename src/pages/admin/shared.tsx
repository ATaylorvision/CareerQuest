import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Search, TriangleAlert } from "lucide-react";
import { api, ApiError } from "@/live/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/common";
import { cn } from "@/lib/utils";

/** Every admin screen talks to the one /api/admin endpoint. */
export function adminApi<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  return api<T>("admin", { action, ...payload });
}

export interface Paged<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
}

interface Load<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * Loads one admin action and re-runs it whenever `key` changes.
 * Late replies from an older request are thrown away, so a fast typist
 * never sees the results of a search they already moved on from.
 */
export function useAdminData<T>(action: string, payload: Record<string, unknown>, key: string): Load<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const seq = useRef(0);
  const payloadRef = useRef(payload);
  payloadRef.current = payload;

  useEffect(() => {
    const mine = ++seq.current;
    setLoading(true);
    adminApi<T>(action, payloadRef.current)
      .then((d) => {
        if (seq.current !== mine) return;
        setData(d);
        setError(null);
      })
      .catch((e) => {
        if (seq.current !== mine) return;
        setError(e instanceof ApiError ? e.message : "Something went wrong.");
      })
      .finally(() => {
        if (seq.current === mine) setLoading(false);
      });
  }, [action, key, nonce]);

  return { data, loading, error, reload: useCallback(() => setNonce((n) => n + 1), []) };
}

/** A search box that waits until typing stops before it asks the server. */
export function useDebounced(value: string, ms = 350) {
  const [out, setOut] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setOut(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return out;
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative w-full sm:max-w-xs">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="pl-9" aria-label={placeholder} />
    </div>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: string; tone?: "primary" | "success" | "warning" }) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("num mt-1.5 text-2xl font-semibold", tone === "success" && "text-success", tone === "warning" && "text-warning", tone === "primary" && "text-primary")}>{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </Card>
  );
}

export function Loading({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card className="flex flex-col items-start gap-3 border-danger/30 bg-danger/5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-2.5 text-sm">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
        <span>{message}</span>
      </div>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry}>
          Try again
        </Button>
      )}
    </Card>
  );
}

/** A plain scrollable table. Admin data is dense, so it stays a table on every screen size. */
export function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b text-left">
            {head.map((h) => (
              <th key={h} scope="col" className="whitespace-nowrap px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">{children}</tbody>
      </table>
    </div>
  );
}

export function Td({ children, className, ...rest }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn("px-3 py-3 align-middle", className)} {...rest}>
      {children}
    </td>
  );
}

export function Pager({ page, total, pageSize, onPage }: { page: number; total: number; pageSize: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);
  return (
    <div className="mt-4 flex items-center justify-between gap-3 text-sm text-muted-foreground">
      <span className="num">
        {from}–{to} of {total}
      </span>
      <div className="flex items-center gap-2">
        <Button size="icon-sm" variant="outline" disabled={page <= 0} onClick={() => onPage(page - 1)} aria-label="Previous page">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="num text-xs">
          {page + 1} / {pages}
        </span>
        <Button size="icon-sm" variant="outline" disabled={page + 1 >= pages} onClick={() => onPage(page + 1)} aria-label="Next page">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export const TIER_TONE: Record<string, string> = {
  free: "bg-muted text-muted-foreground",
  trial: "bg-warning/15 text-warning",
  pro: "bg-success/15 text-success",
};

export function Tag({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", className ?? "bg-muted text-muted-foreground")}>{children}</span>;
}

export function fmtWhen(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export function fmtDay(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
