import { useState } from "react";
import { toast } from "sonner";
import { RotateCcw, ShieldCheck, Trash2 } from "lucide-react";
import { Card, PageHeader, SectionTitle } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ApiError } from "@/live/api";
import { cn } from "@/lib/utils";
import { adminApi, ErrorNote, fmtDay, Loading, Pager, SearchBox, Table, Tag, Td, TIER_TONE, useAdminData, useDebounced, type Paged } from "./shared";

interface Row {
  id: string;
  email: string | null;
  full_name: string | null;
  location: string | null;
  situation: string | null;
  target_field: string | null;
  plan_tier: string;
  subscription_status: string | null;
  onboarded_at: string | null;
  created_at: string;
  is_admin: boolean;
  intensity: string;
}

export default function AdminUsers() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const search = useDebounced(q);
  const [openId, setOpenId] = useState<string | null>(null);
  const { data, loading, error, reload } = useAdminData<Paged<Row>>("users", { q: search, page }, `${search}|${page}`);

  const onSearch = (v: string) => {
    setQ(v);
    setPage(0);
  };

  return (
    <div>
      <PageHeader eyebrow="Admin" title="Users" sub="Every real account. The sample account is not stored anywhere, so it never appears here." actions={<SearchBox value={q} onChange={onSearch} placeholder="Search name or email" />} />

      {error && <ErrorNote message={error} onRetry={reload} />}
      {loading && !data && <Loading label="Loading users" />}

      {data && (
        <Card className="p-0 sm:p-0">
          <div className="p-4 sm:p-5">
            {data.rows.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">{search ? `Nobody matches "${search}".` : "No accounts have signed up yet."}</p>
            ) : (
              <>
                <Table head={["Person", "Plan", "Looking for", "Onboarded", "Joined", ""]}>
                  {data.rows.map((u) => (
                    <tr key={u.id} className="transition-colors hover:bg-accent/50">
                      <Td>
                        <div className="font-medium">
                          {u.full_name || "No name given"}
                          {u.is_admin && <ShieldCheck className="ml-1.5 inline h-3.5 w-3.5 text-primary" aria-label="Admin" />}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">{u.email}</div>
                      </Td>
                      <Td>
                        <Tag className={TIER_TONE[u.plan_tier]}>{u.plan_tier}</Tag>
                      </Td>
                      <Td className="text-muted-foreground">{u.target_field || "—"}</Td>
                      <Td>{u.onboarded_at ? <Tag className="bg-success/15 text-success">Yes</Tag> : <Tag>Not yet</Tag>}</Td>
                      <Td className="num whitespace-nowrap text-muted-foreground">{fmtDay(u.created_at)}</Td>
                      <Td className="text-right">
                        <Button size="xs" variant="outline" onClick={() => setOpenId(u.id)}>
                          Open
                        </Button>
                      </Td>
                    </tr>
                  ))}
                </Table>
                <Pager page={data.page} total={data.total} pageSize={data.pageSize} onPage={setPage} />
              </>
            )}
          </div>
        </Card>
      )}

      {openId && <UserPanel userId={openId} onClose={() => setOpenId(null)} onChanged={reload} />}
    </div>
  );
}

/* ---------------- detail panel ---------------- */

interface Detail {
  profile: Row & {
    headline: string | null;
    prev_field: string | null;
    target_roles: string[];
    locations: string[];
    remote_pref: string;
    salary_floor: number | null;
    legit_threshold: number;
    onboarding_step: number;
    subscription_status: string | null;
    current_period_end: string | null;
    trial_ends_at: string | null;
  };
  applications: { id: string; status: string; method: string | null; created_at: string; confirmation: { verified?: boolean } | null; jobs: { title: string; company: string; location: string | null } | null }[];
  matches: { score: number; why: string | null; jobs: { title: string; company: string } | null }[];
  resumes: { id: string; file_name: string | null; is_base: boolean; created_at: string }[];
  counts: { letters: number; versions: number };
  events: { type: string; note: string | null; occurred_at: string }[];
}

function UserPanel({ userId, onClose, onChanged }: { userId: string; onClose: () => void; onChanged: () => void }) {
  const { data, loading, error, reload } = useAdminData<Detail>("user", { userId }, userId);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const run = async (action: string, payload: Record<string, unknown>, ok: string) => {
    setBusy(true);
    try {
      await adminApi(action, { userId, ...payload });
      toast.success(ok);
      reload();
      onChanged();
      return true;
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "That did not work.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const p = data?.profile;

  return (
    <Sheet open onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader className="text-left">
          <SheetTitle className="font-display text-xl">{p?.full_name || p?.email || "Account"}</SheetTitle>
        </SheetHeader>

        {loading && !data && <Loading label="Loading this account" />}
        {error && <ErrorNote message={error} onRetry={reload} />}

        {data && p && (
          <div className="mt-4 space-y-6 pb-6">
            <div className="flex flex-wrap items-center gap-2">
              <Tag className={TIER_TONE[p.plan_tier]}>{p.plan_tier}</Tag>
              {p.is_admin && <Tag className="bg-primary-soft text-primary">Admin</Tag>}
              {p.onboarded_at ? <Tag className="bg-success/15 text-success">Onboarded</Tag> : <Tag>Onboarding step {p.onboarding_step}</Tag>}
              {p.subscription_status && <Tag>{p.subscription_status}</Tag>}
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <Field label="Email" value={p.email} raw />
              <Field label="Joined" value={fmtDay(p.created_at)} raw />
              <Field label="Location" value={p.location} />
              <Field label="Situation" value={p.situation} />
              <Field label="Coming from" value={p.prev_field} />
              <Field label="Going into" value={p.target_field} />
              <Field label="Remote" value={p.remote_pref} />
              <Field label="Salary floor" value={p.salary_floor ? `$${p.salary_floor.toLocaleString()}` : null} raw />
              <Field label="Search intensity" value={p.intensity} />
              <Field label="Shield threshold" value={String(p.legit_threshold)} raw />
            </div>

            {!!p.target_roles?.length && (
              <div>
                <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Target roles</div>
                <div className="flex flex-wrap gap-1.5">
                  {p.target_roles.map((r) => (
                    <Tag key={r}>{r}</Tag>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-4 gap-3 rounded-lg border p-3 text-center">
              <Mini label="Applications" n={data.applications.length} />
              <Mini label="Matches" n={data.matches.length} />
              <Mini label="Resumes" n={data.resumes.length} />
              <Mini label="Letters" n={data.counts.letters} />
            </div>

            {data.resumes.length > 0 && (
              <section>
                <SectionTitle sub="Only the file name is shown here. Staff never see the contents of someone's resume.">Resumes</SectionTitle>
                <ul className="space-y-1.5 text-sm">
                  {data.resumes.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                      <span className="truncate">{r.file_name || "Untitled"}</span>
                      <span className="num shrink-0 text-xs text-muted-foreground">{fmtDay(r.created_at)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {data.applications.length > 0 && (
              <section>
                <SectionTitle sub="Newest first.">Applications</SectionTitle>
                <ul className="space-y-1.5 text-sm">
                  {data.applications.slice(0, 12).map((a) => (
                    <li key={a.id} className="rounded-lg border px-3 py-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate font-medium">{a.jobs?.title ?? "Job no longer cached"}</div>
                          <div className="truncate text-xs text-muted-foreground">{a.jobs?.company}</div>
                        </div>
                        <div className="shrink-0 text-right">
                          <Tag className="capitalize">{a.status}</Tag>
                          <div className="num mt-1 text-[11px] text-muted-foreground">{fmtDay(a.created_at)}</div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {data.matches.length > 0 && (
              <section>
                <SectionTitle sub="Highest scoring first.">Top matches</SectionTitle>
                <ul className="space-y-1.5 text-sm">
                  {data.matches.slice(0, 8).map((m, i) => (
                    <li key={i} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{m.jobs?.title ?? "Removed"}</div>
                        <div className="truncate text-xs text-muted-foreground">{m.jobs?.company}</div>
                      </div>
                      <span className="num shrink-0 font-semibold">{m.score}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="border-t pt-5">
              <SectionTitle sub="Every change here is written to the audit log with your name on it.">Staff actions</SectionTitle>

              <div className="space-y-4">
                <div>
                  <Label className="text-xs">Plan</Label>
                  <Select value={p.plan_tier} onValueChange={(v) => void run("setTier", { tier: v }, `Plan set to ${v}.`)} disabled={busy}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free">Free</SelectItem>
                      <SelectItem value="trial">Trial</SelectItem>
                      <SelectItem value="pro">Pro</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="mt-1.5 text-xs text-muted-foreground">Changing this by hand does not touch Stripe. A future webhook can overwrite it.</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" className="gap-1.5" disabled={busy} onClick={() => void run("resetOnboarding", {}, "Onboarding reset. They will see it again next time they log in.")}>
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset onboarding
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={busy}
                    onClick={() => void run("setAdmin", { value: !p.is_admin }, p.is_admin ? "Admin access removed." : "Admin access granted.")}
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {p.is_admin ? "Remove admin access" : "Make admin"}
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1.5 border-danger/40 text-danger hover:bg-danger/10 hover:text-danger" disabled={busy} onClick={() => setConfirmDelete(true)}>
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete account
                  </Button>
                </div>
              </div>
            </section>
          </div>
        )}
      </SheetContent>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {p?.email} permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the account, its resumes and confirmation files, its applications, matches, letters, and chats. It cannot be undone, and the person is not notified. Type DELETE to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="DELETE" aria-label="Type DELETE to confirm" />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmText("")}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={confirmText !== "DELETE" || busy}
              className="bg-danger text-white hover:bg-danger/90"
              onClick={async (e) => {
                e.preventDefault();
                const ok = await run("deleteUser", { confirm: confirmText }, "Account deleted.");
                setConfirmText("");
                setConfirmDelete(false);
                if (ok) onClose();
              }}
            >
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}

/** `raw` keeps a value exactly as stored. Emails and numbers must never be title cased. */
function Field({ label, value, raw }: { label: string; value: string | null | undefined; raw?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("truncate", !raw && "capitalize")}>{value || "—"}</div>
    </div>
  );
}

function Mini({ label, n }: { label: string; n: number }) {
  return (
    <div>
      <div className="num text-lg font-semibold">{n}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}
