import { useState } from "react";
import { Card, PageHeader } from "@/components/common";
import { ErrorNote, fmtWhen, Loading, Pager, Table, Tag, Td, useAdminData, type Paged } from "./shared";

interface Row {
  id: string;
  actor_email: string | null;
  action: string;
  target_label: string | null;
  detail: Record<string, unknown> | null;
  created_at: string;
}

const ACTION_LABEL: Record<string, { label: string; tone: string }> = {
  "plan.change": { label: "Changed a plan", tone: "bg-primary-soft text-primary" },
  "admin.grant": { label: "Granted admin access", tone: "bg-warning/15 text-warning" },
  "admin.revoke": { label: "Removed admin access", tone: "bg-warning/15 text-warning" },
  "onboarding.reset": { label: "Reset onboarding", tone: "bg-muted text-muted-foreground" },
  "account.delete": { label: "Deleted an account", tone: "bg-danger/15 text-danger" },
};

function describe(r: Row) {
  if (r.action === "plan.change" && r.detail) return `${String(r.detail.from)} to ${String(r.detail.to)}`;
  return "";
}

export default function AdminAuditLog() {
  const [page, setPage] = useState(0);
  const { data, loading, error, reload } = useAdminData<Paged<Row>>("log", { page }, String(page));

  return (
    <div>
      <PageHeader eyebrow="Admin" title="Audit log" sub="Every staff action that changed or removed someone's data, with who did it and when. Nothing here can be edited or deleted." />

      {error && <ErrorNote message={error} onRetry={reload} />}
      {loading && !data && <Loading label="Loading the log" />}

      {data && (
        <Card>
          {data.rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No staff actions have been taken yet.</p>
          ) : (
            <>
              <Table head={["When", "Who", "Action", "On", "Detail"]}>
                {data.rows.map((r) => {
                  const meta = ACTION_LABEL[r.action] ?? { label: r.action, tone: "bg-muted text-muted-foreground" };
                  return (
                    <tr key={r.id}>
                      <Td className="num whitespace-nowrap text-muted-foreground">{fmtWhen(r.created_at)}</Td>
                      <Td className="max-w-[200px] truncate">{r.actor_email ?? "Account since deleted"}</Td>
                      <Td>
                        <Tag className={meta.tone}>{meta.label}</Tag>
                      </Td>
                      <Td className="max-w-[200px] truncate text-muted-foreground">{r.target_label ?? "—"}</Td>
                      <Td className="text-muted-foreground">{describe(r) || "—"}</Td>
                    </tr>
                  );
                })}
              </Table>
              <Pager page={data.page} total={data.total} pageSize={data.pageSize} onPage={setPage} />
            </>
          )}
        </Card>
      )}
    </div>
  );
}
