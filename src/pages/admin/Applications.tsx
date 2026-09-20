import { useState } from "react";
import { Card, PageHeader } from "@/components/common";
import { MethodBadge, VerifiedMark } from "@/components/status";
import type { Method } from "@/data/applications";
import { ErrorNote, fmtWhen, Loading, Pager, Table, Tag, Td, useAdminData, type Paged } from "./shared";

interface Row {
  id: string;
  user_id: string;
  status: string;
  method: Method | null;
  destination_label: string | null;
  created_at: string;
  submitted_at: string | null;
  confirmation: { verified?: boolean } | null;
  jobs: { title: string; company: string; location: string | null } | null;
  user: { email: string; name: string } | null;
}

const STATUS_TONE: Record<string, string> = {
  saved: "bg-muted text-muted-foreground",
  applied: "bg-primary-soft text-primary",
  screening: "bg-warning/15 text-warning",
  interview: "bg-warning/15 text-warning",
  offer: "bg-success/15 text-success",
  closed: "bg-muted text-muted-foreground",
};

export default function AdminApplications() {
  const [page, setPage] = useState(0);
  const { data, loading, error, reload } = useAdminData<Paged<Row>>("applications", { page }, String(page));

  return (
    <div>
      <PageHeader eyebrow="Admin" title="Applications" sub="Every application recorded across all accounts, newest first, with whether the confirmation was actually verified." />

      {error && <ErrorNote message={error} onRetry={reload} />}
      {loading && !data && <Loading label="Loading applications" />}

      {data && (
        <Card>
          {data.rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nobody has recorded an application yet.</p>
          ) : (
            <>
              <Table head={["Job", "Person", "Status", "How", "Confirmed", "Recorded"]}>
                {data.rows.map((a) => (
                  <tr key={a.id} className="transition-colors hover:bg-accent/50">
                    <Td>
                      <div className="max-w-[240px] truncate font-medium">{a.jobs?.title ?? "Listing no longer cached"}</div>
                      <div className="max-w-[240px] truncate text-xs text-muted-foreground">{a.jobs?.company}</div>
                    </Td>
                    <Td>
                      <div className="max-w-[200px] truncate">{a.user?.name || "No name"}</div>
                      <div className="max-w-[200px] truncate text-xs text-muted-foreground">{a.user?.email ?? "Account deleted"}</div>
                    </Td>
                    <Td>
                      <Tag className={STATUS_TONE[a.status]}>
                        <span className="capitalize">{a.status}</span>
                      </Tag>
                    </Td>
                    <Td>{a.method ? <MethodBadge method={a.method} size="xs" withTip={false} /> : <span className="text-xs text-muted-foreground">—</span>}</Td>
                    <Td>
                      <VerifiedMark verified={!!a.confirmation?.verified} size="xs" />
                    </Td>
                    <Td className="num whitespace-nowrap text-muted-foreground">{fmtWhen(a.created_at)}</Td>
                  </tr>
                ))}
              </Table>
              <Pager page={data.page} total={data.total} pageSize={data.pageSize} onPage={setPage} />
            </>
          )}
        </Card>
      )}
    </div>
  );
}
