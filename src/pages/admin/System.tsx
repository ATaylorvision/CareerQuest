import { CheckCircle2, CircleDashed, RefreshCw, XCircle } from "lucide-react";
import { Card, PageHeader, SectionTitle } from "@/components/common";
import { Button } from "@/components/ui/button";
import { ErrorNote, fmtWhen, Loading, Table, Td, useAdminData } from "./shared";
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
};

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
