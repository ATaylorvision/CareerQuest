import { useState } from "react";
import { CheckCircle2, CircleDashed, Linkedin, RefreshCw, XCircle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Card, PageHeader, SectionTitle } from "@/components/common";
import { Button } from "@/components/ui/button";
import { adminApi, ErrorNote, fmtWhen, Loading, Table, Td, useAdminData } from "./shared";
import { cn } from "@/lib/utils";

interface Health {
  services: Record<string, boolean>;
  checks: { name: string; ok: boolean; status: number; ms: number; skipped?: boolean; note?: string }[];
  lastJobPulledAt: string | null;
  region: string;
  commit: string | null;
}

const SERVICE_LABEL: Record<string, { label: string; what: string }> = {
  supabase: { label: "Supabase", what: "Accounts, the database, and file storage." },
  anthropic: { label: "Anthropic", what: "Resume parsing, matching, the Career Translator, and Wren." },
  adzuna: { label: "Adzuna", what: "Real job listings." },
  jsearch: { label: "JSearch", what: "A second source of listings, once the RapidAPI key is subscribed." },
  stripe: { label: "Stripe", what: "Billing. Not switched on yet." },
  resend: { label: "Resend", what: "Transactional email." },
  apify: { label: "Apify", what: "LinkedIn job listings, when the LinkedIn switch is on." },
};

interface LinkedIn {
  enabled: boolean;
  configured: boolean;
  limits: { perUserPerDay: number; globalPerDay: number; maxItems: number; maxChargeUsd: number };
  runsToday: number;
  spendToday: number;
  runsMonth: number;
  spendMonth: number;
  recent: { runId: string; status: string; items: number | null; cost: number | null; at: string; who: string }[];
}

const usd = (n: number) => `$${n.toFixed(n < 1 ? 3 : 2)}`;

/** The one switch for LinkedIn search, with what it has cost, so spend is never a surprise. */
function LinkedInCard() {
  const { data, loading, error, reload } = useAdminData<LinkedIn>("linkedin", {}, "linkedin");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const flip = async (on: boolean) => {
    setBusy(true);
    setErr("");
    try {
      await adminApi("setLinkedin", { value: on });
      reload();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <SectionTitle sub="Adds LinkedIn listings to a search. Off until you switch it on, and it can never spend past the limits below.">
        <span className="inline-flex items-center gap-2">
          <Linkedin className="h-4 w-4" aria-hidden /> LinkedIn search
        </span>
      </SectionTitle>
      {error && <ErrorNote message={error} onRetry={reload} />}
      {loading && !data && <Loading label="Loading" />}
      {data && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <div>
              <div className="font-medium">{data.enabled ? "On" : "Off"}</div>
              <div className="text-sm text-muted-foreground">{data.configured ? "Apify is connected." : "There is no Apify token on the server yet, so this cannot be switched on."}</div>
            </div>
            <Switch checked={data.enabled} disabled={busy || !data.configured} onCheckedChange={(v) => void flip(v)} aria-label="LinkedIn search" />
          </div>
          {err && <p className="text-sm text-danger">{err}</p>}
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Searches today</dt>
              <dd className="num mt-0.5">
                {data.runsToday} of {data.limits.globalPerDay}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Spend today</dt>
              <dd className="num mt-0.5">{usd(data.spendToday)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Searches this month</dt>
              <dd className="num mt-0.5">{data.runsMonth}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Spend this month</dt>
              <dd className="num mt-0.5">{usd(data.spendMonth)}</dd>
            </div>
          </dl>
          <p className="text-xs text-muted-foreground">
            Each person can start {data.limits.perUserPerDay} a day, everyone together {data.limits.globalPerDay} a day. A search asks for at most {data.limits.maxItems} listings and is stopped by Apify if it would cost more than ${data.limits.maxChargeUsd.toFixed(2)}. Apify's own monthly limit on the account is the last backstop.
          </p>
          {data.recent.length > 0 && (
            <Table head={["When", "Who", "Result", "Listings", "Cost"]}>
              {data.recent.map((r) => (
                <tr key={r.runId}>
                  <Td className="num text-muted-foreground">{fmtWhen(r.at)}</Td>
                  <Td>{r.who || "—"}</Td>
                  <Td>{r.status === "done" ? "Finished" : "Running"}</Td>
                  <Td className="num">{r.items ?? "—"}</Td>
                  <Td className="num">{r.cost != null ? usd(Number(r.cost)) : "—"}</Td>
                </tr>
              ))}
            </Table>
          )}
        </div>
      )}
    </Card>
  );
}

/** People who started setup and never signed up. They are removed after a week, or sooner from here. */
function GuestsCard() {
  const { data, loading, reload } = useAdminData<{ guests: number; stale: number; removed?: number }>("guests", {}, "guests");
  const [busy, setBusy] = useState(false);
  return (
    <Card>
      <SectionTitle sub="Visitors who started setup and did not sign up. Each has a temporary account holding their resume and answers.">Guest accounts</SectionTitle>
      {loading && !data ? (
        <Loading label="Loading" />
      ) : (
        data && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">
              <span className="num font-semibold">{data.guests}</span> guests right now, <span className="num font-semibold">{data.stale}</span> older than a week.
            </p>
            <Button
              size="sm"
              variant="outline"
              disabled={busy || data.stale === 0}
              onClick={async () => {
                setBusy(true);
                try {
                  await adminApi("cleanGuests");
                  reload();
                } finally {
                  setBusy(false);
                }
              }}
            >
              Remove the old ones
            </Button>
          </div>
        )
      )}
    </Card>
  );
}

export default function AdminSystem() {
  const { data, loading, error, reload } = useAdminData<Health>("health", {}, "health");

  return (
    <div>
      <PageHeader
        eyebrow="Admin"
        title="System"
        sub="Which services are configured, and whether each one answered just now. No key is ever shown here or sent to the browser."
        actions={
          <Button variant="outline" size="sm" className="gap-1.5" onClick={reload} disabled={loading}>
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            Re-check
          </Button>
        }
      />

      {error && <ErrorNote message={error} onRetry={reload} />}
      {loading && !data && <Loading label="Pinging every service" />}

      {data && (
        <div className="space-y-6">
          <Card>
            <SectionTitle sub="A live request was made to each one a moment ago.">Live checks</SectionTitle>
            <Table head={["Service", "Result", "Response", "Time"]}>
              {data.checks.map((c) => (
                <tr key={c.name}>
                  <Td className="font-medium">
                    {c.name}
                    {c.note && <div className="mt-0.5 max-w-[320px] whitespace-normal text-xs font-normal text-muted-foreground">{c.note}</div>}
                  </Td>
                  <Td>
                    {c.skipped ? (
                      <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                        <CircleDashed className="h-4 w-4" />
                        Not configured
                      </span>
                    ) : c.ok ? (
                      <span className="inline-flex items-center gap-1.5 text-sm text-success">
                        <CheckCircle2 className="h-4 w-4" />
                        Answered
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-sm text-danger">
                        <XCircle className="h-4 w-4" />
                        Failed
                      </span>
                    )}
                  </Td>
                  <Td className="num text-muted-foreground">{c.skipped ? "—" : c.status || "no reply"}</Td>
                  <Td className="num text-muted-foreground">{c.skipped ? "—" : `${c.ms} ms`}</Td>
                </tr>
              ))}
            </Table>
          </Card>

          <LinkedInCard />

          <GuestsCard />

          <Card>
            <SectionTitle sub="Set as environment variables on the server. A missing key turns its feature off rather than breaking the app.">Configuration</SectionTitle>
            <ul className="divide-y">
              {Object.entries(SERVICE_LABEL).map(([key, meta]) => (
                <li key={key} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <div className="font-medium">{meta.label}</div>
                    <div className="text-sm text-muted-foreground">{meta.what}</div>
                  </div>
                  <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-medium", data.services[key] ? "bg-success/15 text-success" : "bg-muted text-muted-foreground")}>
                    {data.services[key] ? "Configured" : "Not set"}
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <SectionTitle>Deployment</SectionTitle>
            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Region</dt>
                <dd className="mt-0.5">{data.region}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Commit</dt>
                <dd className="num mt-0.5">{data.commit ?? "Not deployed from git"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Newest cached job</dt>
                <dd className="num mt-0.5">{data.lastJobPulledAt ? fmtWhen(data.lastJobPulledAt) : "No jobs pulled yet"}</dd>
              </div>
            </dl>
          </Card>
        </div>
      )}
    </div>
  );
}
