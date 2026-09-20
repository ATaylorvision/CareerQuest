import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { Card, PageHeader } from "@/components/common";
import { LegitBadgeView } from "@/components/status";
import type { LegitBadge } from "@/lib/legit";
import { ErrorNote, fmtDay, Loading, Pager, SearchBox, Table, Tag, Td, useAdminData, useDebounced, type Paged } from "./shared";

interface Row {
  id: string;
  source: string;
  title: string;
  company: string;
  location: string | null;
  remote_type: string | null;
  salary_min: number | null;
  salary_max: number | null;
  apply_url: string | null;
  employer_posted: boolean | null;
  posted_at: string | null;
  first_seen_at: string;
  repost_count: number;
  ats_provider: string | null;
  company_site_status: string;
  legit: { score?: number; badge?: LegitBadge } | null;
}

function pay(min: number | null, max: number | null) {
  if (!min && !max) return "Not listed";
  const k = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(n));
  if (min && max) return `$${k(min)}–${k(max)}`;
  return `$${k((min ?? max)!)}`;
}

export default function AdminJobs() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const search = useDebounced(q);
  const { data, loading, error, reload } = useAdminData<Paged<Row>>("jobs", { q: search, page }, `${search}|${page}`);

  return (
    <div>
      <PageHeader
        eyebrow="Admin"
        title="Job cache"
        sub="Every real listing CareerQuest has pulled in, newest first, with the Ghost Job Shield verdict it was given."
        actions={
          <SearchBox
            value={q}
            onChange={(v) => {
              setQ(v);
              setPage(0);
            }}
            placeholder="Search title or company"
          />
        }
      />

      {error && <ErrorNote message={error} onRetry={reload} />}
      {loading && !data && <Loading label="Loading the job cache" />}

      {data && (
        <Card>
          {data.rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{search ? `No cached listing matches "${search}".` : "No listings have been pulled in yet. They arrive the first time someone runs a search."}</p>
          ) : (
            <>
              <Table head={["Job", "Source", "Shield", "Pay", "Posted", "First seen", ""]}>
                {data.rows.map((j) => (
                  <tr key={j.id} className="transition-colors hover:bg-accent/50">
                    <Td>
                      <div className="max-w-[260px] truncate font-medium">{j.title}</div>
                      <div className="max-w-[260px] truncate text-xs text-muted-foreground">
                        {j.company}
                        {j.location ? ` · ${j.location}` : ""}
                      </div>
                    </Td>
                    <Td>
                      <Tag>{j.source}</Tag>
                      {j.ats_provider && <Tag className="ml-1 bg-success/15 text-success">{j.ats_provider}</Tag>}
                      {j.employer_posted === false && <Tag className="ml-1 bg-warning/15 text-warning">agency</Tag>}
                    </Td>
                    <Td>
                      {j.legit?.badge ? (
                        <LegitBadgeView badge={j.legit.badge} score={j.legit.score} size="xs" withTip={false} />
                      ) : (
                        <span className="text-xs text-muted-foreground">Not scored</span>
                      )}
                      {j.repost_count > 0 && <div className="num mt-1 text-[11px] text-muted-foreground">{j.repost_count} reposts seen</div>}
                    </Td>
                    <Td className="num whitespace-nowrap text-muted-foreground">{pay(j.salary_min, j.salary_max)}</Td>
                    <Td className="num whitespace-nowrap text-muted-foreground">{fmtDay(j.posted_at)}</Td>
                    <Td className="num whitespace-nowrap text-muted-foreground">{fmtDay(j.first_seen_at)}</Td>
                    <Td className="text-right">
                      {j.apply_url && (
                        <a
                          href={j.apply_url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                          aria-label={`Open the posting for ${j.title} at ${j.company} in a new tab`}
                        >
                          Open
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </Td>
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
