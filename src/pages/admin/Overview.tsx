import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import { Briefcase, FileText, MessagesSquare, Send, Sparkles, Target, UserCheck, Users } from "lucide-react";
import { Card, PageHeader, ScoreBar, SectionTitle, Segmented } from "@/components/common";
import { useTheme } from "@/hooks/useTheme";
import { useAdminData, ErrorNote, Loading, Stat, Tag, TIER_TONE } from "./shared";

interface Overview {
  totals: { users: number; usersNew: number; onboarded: number; pro: number; jobs: number; matches: number; apps: number; appsWeek: number; verified: number; resumes: number; chats: number };
  signups: { date: string; n: number }[];
  applications: { date: string; n: number }[];
  tiers: Record<string, number>;
  statuses: Record<string, number>;
  days: number;
}

const STATUS_ORDER = ["saved", "applied", "screening", "interview", "offer", "rejected", "withdrawn", "closed"];
const STATUS_LABEL: Record<string, string> = {
  saved: "Saved",
  applied: "Applied",
  screening: "Screening",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
  closed: "Closed (older)",
};

export default function AdminOverview() {
  const [days, setDays] = useState<"7" | "30" | "90">("30");
  const { data, loading, error, reload } = useAdminData<Overview>("overview", { days: Number(days) }, days);
  const { theme } = useTheme();

  const axis = theme === "dark" ? "hsl(218 13% 68%)" : "hsl(220 9% 40%)";
  const grid = theme === "dark" ? "hsl(222 16% 19%)" : "hsl(220 16% 90%)";

  const chart = useMemo(() => {
    if (!data) return [];
    return data.signups.map((s, i) => ({
      date: new Date(s.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      "New accounts": s.n,
      Applications: data.applications[i]?.n ?? 0,
    }));
  }, [data]);

  const t = data?.totals;
  const statusTotal = Object.values(data?.statuses ?? {}).reduce((a, b) => a + b, 0);

  return (
    <div>
      <PageHeader
        eyebrow="Admin"
        title="Overview"
        sub="Everything happening across CareerQuest right now. These are real accounts, not the sample account."
        actions={<Segmented<"7" | "30" | "90"> value={days} onChange={setDays} options={[{ value: "7", label: "7 days" }, { value: "30", label: "30 days" }, { value: "90", label: "90 days" }]} />}
      />

      {error && <ErrorNote message={error} onRetry={reload} />}
      {loading && !data && <Loading label="Loading the dashboard" />}

      {t && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <Stat label="Accounts" value={t.users.toLocaleString()} sub={`${t.usersNew} joined in the last 7 days`} />
            <Stat label="Finished onboarding" value={t.onboarded.toLocaleString()} sub={t.users ? `${Math.round((t.onboarded / t.users) * 100)}% of accounts` : "No accounts yet"} tone="primary" />
            <Stat label="Applications" value={t.apps.toLocaleString()} sub={`${t.appsWeek} in the last 7 days`} />
            <Stat label="Verified receipts" value={t.verified.toLocaleString()} sub={t.apps ? `${Math.round((t.verified / t.apps) * 100)}% of applications` : "No applications yet"} tone="success" />
          </div>

          <Card className="mt-6">
            <SectionTitle icon={Sparkles} sub={`New accounts and applications, day by day, over the last ${data?.days} days.`}>
              Activity
            </SectionTitle>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chart} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gSignups" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="gApps" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={grid} vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: axis, fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={24} />
                  <YAxis tick={{ fill: axis, fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} width={44} />
                  <RTooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 10, fontSize: 12 }}
                    labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
                  />
                  <Area type="monotone" dataKey="New accounts" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#gSignups)" />
                  <Area type="monotone" dataKey="Applications" stroke="hsl(var(--success))" strokeWidth={2} fill="url(#gApps)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <SectionTitle icon={Target} sub="Where every application currently sits.">
                Application pipeline
              </SectionTitle>
              {statusTotal === 0 ? (
                <p className="text-sm text-muted-foreground">No applications have been recorded yet.</p>
              ) : (
                <ul className="space-y-3">
                  {STATUS_ORDER.filter((s) => data?.statuses[s]).map((s) => {
                    const n = data!.statuses[s];
                    return (
                      <li key={s}>
                        <div className="mb-1 flex items-baseline justify-between text-sm">
                          <span className="font-medium">{STATUS_LABEL[s] ?? s}</span>
                          <span className="num text-muted-foreground">
                            {n} · {Math.round((n / statusTotal) * 100)}%
                          </span>
                        </div>
                        <ScoreBar value={n} max={statusTotal} height={6} tone={s === "offer" ? "success" : s === "closed" || s === "withdrawn" || s === "rejected" ? "muted" : "primary"} label={`${STATUS_LABEL[s] ?? s}: ${n}`} />
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>

            <Card>
              <SectionTitle icon={UserCheck} sub="Plans across every account.">
                Plans
              </SectionTitle>
              <div className="flex flex-wrap gap-2">
                {["free", "trial", "pro"].map((tier) => (
                  <Tag key={tier} className={TIER_TONE[tier]}>
                    <span className="capitalize">{tier}</span>
                    <span className="num ml-1.5 font-semibold">{data?.tiers[tier] ?? 0}</span>
                  </Tag>
                ))}
              </div>
              <div className="mt-5 grid grid-cols-2 gap-4 border-t pt-5 text-sm">
                <Line icon={Briefcase} label="Jobs cached" value={t.jobs} />
                <Line icon={Sparkles} label="Match scores" value={t.matches} />
                <Line icon={FileText} label="Resumes uploaded" value={t.resumes} />
                <Line icon={MessagesSquare} label="Copilot messages" value={t.chats} />
                <Line icon={Send} label="Paid or trialling" value={t.pro} />
                <Line icon={Users} label="Accounts" value={t.users} />
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function Line({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <div className="num font-semibold">{value.toLocaleString()}</div>
        <div className="truncate text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}
