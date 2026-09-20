import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Bell, Download, FlaskConical, Moon, Palette, RotateCcw, Save, SlidersHorizontal, Sun, Trash2, User } from "lucide-react";
import { Card, Chip, PageHeader, Segmented, SectionTitle } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useStore } from "@/store/AppStore";
import { INTENSITY_META, type Intensity } from "@/data/plan";
import { useTheme } from "@/hooks/useTheme";
import { downloadText } from "@/lib/resumeBuild";
import { api } from "@/live/api";
import { supabase } from "@/live/supabase";
import { useLive } from "@/live/LiveProvider";
import { useDocTitle } from "@/hooks/useDocTitle";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "prefs", label: "Job preferences", icon: SlidersHorizontal },
  { id: "notify", label: "Notifications", icon: Bell },
  { id: "look", label: "Appearance", icon: Palette },
  { id: "data", label: "Your data", icon: Download },
  { id: "demo", label: "Demo controls", icon: FlaskConical },
];

const NOTIFS: { k: string; label: string; desc: string }[] = [
  { k: "dailyPlan", label: "Today's Plan", desc: "One email or push at 7 a.m. with your actions for the day." },
  { k: "newMatches", label: "New strong matches", desc: "Only matches above 85 that cleared our legitimacy checks." },
  { k: "ghostAlerts", label: "Listing quality alerts", desc: "If a job you saved turns Stale or Ghost risk." },
  { k: "applicationUpdates", label: "Application updates", desc: "When an employer views, moves, or responds." },
  { k: "weeklyCheckIn", label: "Weekly Check In reminder", desc: "Sunday afternoon." },
  { k: "tips", label: "Coaching tips from Wren", desc: "Occasional, never more than twice a week." },
  { k: "marketing", label: "Product news", desc: "New features. Off by default." },
];

export default function Settings() {
  useDocTitle("Settings");
  const { state, update, reset } = useStore();
  const live = state.mode === "live";
  const { signOut } = useLive();
  const [deleting, setDeleting] = useState(false);

  // Real export: everything stored for this account, straight from the database.
  const exportLive = async () => {
    if (!supabase) return;
    const uid = (await supabase.auth.getUser()).data.user?.id;
    if (!uid) return;
    const [profile, resumes, matches, st] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).single(),
      supabase.from("resumes").select("*"),
      supabase.from("job_matches").select("score, breakdown, why, gaps, translator, jobs(title, company, location, apply_url, posted_at, legit)"),
      supabase.from("user_state").select("state").eq("user_id", uid).maybeSingle(),
    ]);
    const out = { exportedAt: new Date().toISOString(), profile: profile.data, resumes: resumes.data, matches: matches.data, workingState: st.data?.state };
    downloadText(`careerquest_export_${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(out, null, 2));
    toast.success("Export downloaded", { description: "It includes your profile, resumes, matches, tracker, receipts, and chats." });
  };
  const { theme, setTheme } = useTheme();
  const nav = useNavigate();
  const [profile, setProfile] = useState(state.profile);
  const [newRole, setNewRole] = useState("");
  const [del, setDel] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const p = state.prefs;

  const scrollTo = (id: string) => document.getElementById(`set-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div>
      <PageHeader title="Settings" sub="Your profile, what you are looking for, how we reach you, and your data." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[200px_1fr]">
        <nav aria-label="Settings sections" className="hidden lg:block">
          <ul className="sticky top-20 space-y-0.5">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <button onClick={() => scrollTo(s.id)} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                  <s.icon className="h-4 w-4" /> {s.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 space-y-6">
          <Card id="set-profile" className="scroll-mt-20">
            <SectionTitle icon={User}>Profile</SectionTitle>
            <form
              className="grid grid-cols-1 gap-4 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                update((s) => void (s.profile = profile));
                toast.success("Profile saved");
              }}
            >
              {(["name", "email", "location"] as const).map((k) => (
                <div key={k} className="space-y-1.5">
                  <Label htmlFor={`pf-${k}`} className="capitalize">{k === "location" ? "Home base" : k}</Label>
                  <Input
                    id={`pf-${k}`}
                    value={profile[k]}
                    readOnly={live && k === "email"}
                    placeholder={k === "location" ? "City, State" : undefined}
                    onChange={(e) => setProfile({ ...profile, [k]: e.target.value })}
                  />
                  {k === "location" && <p className="text-xs text-muted-foreground">We search out from here. Onsite and hybrid roles further than your commute range are left out.</p>}
                </div>
              ))}
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="pf-h">Headline</Label>
                <Input id="pf-h" value={profile.headline} onChange={(e) => setProfile({ ...profile, headline: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit">
                  <Save /> Save profile
                </Button>
              </div>
            </form>
          </Card>

          <Card id="set-prefs" className="scroll-mt-20">
            <SectionTitle icon={SlidersHorizontal} sub="Changes apply right away to your matches and daily plan.">Job preferences</SectionTitle>
            <div className="space-y-6">
              <div>
                <div className="mb-2 text-sm font-medium">Target roles</div>
                <div className="flex flex-wrap gap-2">
                  {p.roles.map((r) => (
                    <Chip key={r} active onClick={() => update((s) => void (s.prefs.roles = s.prefs.roles.filter((x) => x !== r)))}>
                      {r} <span aria-hidden>×</span>
                      <span className="sr-only">Remove</span>
                    </Chip>
                  ))}
                </div>
                <form
                  className="mt-2 flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (newRole.trim()) update((s) => void s.prefs.roles.push(newRole.trim()));
                    setNewRole("");
                  }}
                >
                  <Input className="h-9" value={newRole} onChange={(e) => setNewRole(e.target.value)} placeholder="Add a role" aria-label="Add a target role" />
                  <Button size="sm" variant="outline" type="submit">
                    Add
                  </Button>
                </form>
              </div>
              <div>
                <div className="mb-2 text-sm font-medium">Locations</div>
                <div className="flex flex-wrap gap-2">
                  {p.locations.map((l) => (
                    <Chip key={l} active onClick={() => update((s) => void (s.prefs.locations = s.prefs.locations.filter((x) => x !== l)))}>
                      {l} <span aria-hidden>×</span>
                    </Chip>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <div className="mb-2 text-sm font-medium">Remote preference</div>
                  <Segmented<"any" | "remote" | "hybrid" | "onsite">
                    value={p.remote}
                    onChange={(v) => update((s) => void (s.prefs.remote = v))}
                    options={[
                      { value: "any", label: "Open" },
                      { value: "remote", label: "Remote" },
                      { value: "hybrid", label: "Hybrid" },
                      { value: "onsite", label: "Onsite" },
                    ]}
                  />
                </div>
                <div>
                  <div className="mb-2 text-sm font-medium">Search intensity</div>
                  <Segmented<Intensity>
                    value={p.intensity}
                    onChange={(v) => {
                      update((s) => void (s.prefs.intensity = v));
                      toast.success(`${INTENSITY_META[v].label} pace`, { description: `${INTENSITY_META[v].actions} actions a day in Today's Plan.` });
                    }}
                    options={(Object.keys(INTENSITY_META) as Intensity[]).map((k) => ({ value: k, label: INTENSITY_META[k].label }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <div className="mb-2 flex justify-between text-sm">
                    <span className="font-medium" id="sf-l">Salary floor</span>
                    <span className="num font-semibold">${p.salaryFloor.toLocaleString()}</span>
                  </div>
                  <Slider aria-labelledby="sf-l" value={[p.salaryFloor]} min={30000} max={150000} step={5000} onValueChange={([v]) => update((s) => void (s.prefs.salaryFloor = v))} />
                </div>
                <div>
                  <div className="mb-2 flex justify-between text-sm">
                    <span className="font-medium" id="cr-l">How far you would commute</span>
                    <span className="num font-semibold">{p.maxDistanceMiles >= 100 ? "Any distance" : `${p.maxDistanceMiles} miles`}</span>
                  </div>
                  <Slider aria-labelledby="cr-l" value={[p.maxDistanceMiles]} min={5} max={100} step={5} onValueChange={([v]) => update((s) => void (s.prefs.maxDistanceMiles = v))} />
                  <p className="mt-2 text-xs text-muted-foreground">
                    {p.maxDistanceMiles >= 100 ? "Distance will not rule anything out." : `Measured from ${profile.location || "your home base"}. Remote roles are never filtered by distance.`}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <div className="mb-2 text-sm font-medium">Must haves</div>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {p.mustHaves.map((m) => <li key={m}>{m}</li>)}
                  </ul>
                </div>
                <div>
                  <div className="mb-2 text-sm font-medium">Dealbreakers</div>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {p.dealbreakers.map((m) => <li key={m}>{m}</li>)}
                  </ul>
                </div>
              </div>
            </div>
          </Card>

          <Card id="set-notify" className="scroll-mt-20">
            <SectionTitle icon={Bell} sub="We keep it quiet. You are already stressed enough.">Notifications</SectionTitle>
            <ul className="divide-y">
              {NOTIFS.map((n) => (
                <li key={n.k} className="flex items-center justify-between gap-4 py-3">
                  <div>
                    <Label htmlFor={`n-${n.k}`} className="font-medium">{n.label}</Label>
                    <p className="text-sm text-muted-foreground">{n.desc}</p>
                  </div>
                  <Switch
                    id={`n-${n.k}`}
                    checked={!!state.notifications[n.k]}
                    onCheckedChange={(v) => {
                      update((s) => void (s.notifications[n.k] = v));
                      toast(`${n.label} ${v ? "on" : "off"}`);
                    }}
                  />
                </li>
              ))}
            </ul>
          </Card>

          <Card id="set-look" className="scroll-mt-20">
            <SectionTitle icon={Palette}>Appearance</SectionTitle>
            <div className="grid max-w-md grid-cols-2 gap-3">
              {(["light", "dark"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  aria-pressed={theme === t}
                  className={cn("rounded-xl border p-3 text-left transition-all hover:border-primary/40", theme === t && "border-primary ring-2 ring-primary/15")}
                >
                  <div className={cn("mb-2 h-16 rounded-lg border", t === "light" ? "bg-[#f8fafc]" : "bg-[#0f141c]")}>
                    <div className={cn("m-2 h-3 w-1/2 rounded", t === "light" ? "bg-[#1d4ed8]" : "bg-[#5b8def]")} />
                    <div className={cn("mx-2 h-2 w-3/4 rounded", t === "light" ? "bg-[#e2e8f0]" : "bg-[#232b38]")} />
                  </div>
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    {t === "light" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />} {t === "light" ? "Light" : "Dark"}
                  </span>
                </button>
              ))}
            </div>
          </Card>

          <Card id="set-data" className="scroll-mt-20">
            <SectionTitle icon={Download} sub="Everything you have made in CareerQuest belongs to you.">Your data</SectionTitle>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center">
                <div className="flex-1">
                  <div className="font-medium">Export everything</div>
                  <p className="text-sm text-muted-foreground">Your profile, preferences, applications with full receipts, resume versions, letters, and Copilot history, as a JSON file.</p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (live) {
                      void exportLive();
                      return;
                    }
                    const { authed, onboarded, ...data } = state;
                    downloadText(`careerquest_export_${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2));
                    toast.success("Export downloaded");
                  }}
                >
                  <Download /> Export data
                </Button>
              </div>
              <div className="flex flex-col gap-3 rounded-lg border border-danger-border p-4 sm:flex-row sm:items-center">
                <div className="flex-1">
                  <div className="font-medium text-danger">Delete account</div>
                  <p className="text-sm text-muted-foreground">Permanently removes your account and everything in it. If you are on Pro, billing stops immediately.</p>
                </div>
                <Button variant="outline" className="border-danger-border text-danger hover:bg-danger-soft hover:text-danger" onClick={() => setDel(true)}>
                  <Trash2 /> Delete account
                </Button>
              </div>
            </div>
          </Card>

          <Card id="set-demo" className="scroll-mt-20 border-dashed">
            <SectionTitle icon={FlaskConical} sub={live ? "Redo your setup any time. Your data stays." : "Prototype only. These let you see states that would otherwise take days to reach."}>{live ? "Setup" : "Demo controls"}</SectionTitle>
            <ul className="divide-y">
              {!live && (
              <li className="flex items-center justify-between gap-4 py-3">
                <div>
                  <Label htmlFor="d-streak" className="font-medium">Preview a missed streak</Label>
                  <p className="text-sm text-muted-foreground">See how Today's Plan responds after a couple of days away.</p>
                </div>
                <Switch id="d-streak" checked={state.streakBrokenDemo} onCheckedChange={(v) => update((s) => void (s.streakBrokenDemo = v))} />
              </li>
              )}
              <li className="flex items-center justify-between gap-4 py-3">
                <div>
                  <div className="font-medium">Replay onboarding</div>
                  <p className="text-sm text-muted-foreground">Walk through setup again. Your data stays.</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    update((s) => void (s.onboarded = false));
                    nav("/onboarding");
                  }}
                >
                  Replay
                </Button>
              </li>
              {!live && (
              <li className="flex items-center justify-between gap-4 py-3">
                <div>
                  <div className="font-medium">Reset demo data</div>
                  <p className="text-sm text-muted-foreground">Restore the sample account to how it started, including the one time confetti.</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    reset({ keepAuth: true });
                    try {
                      Object.keys(sessionStorage).filter((k) => k.startsWith("cq-ui-")).forEach((k) => sessionStorage.removeItem(k));
                    } catch {
                      /* ignore */
                    }
                    toast.success("Demo data reset");
                  }}
                >
                  <RotateCcw /> Reset
                </Button>
              </li>
              )}
            </ul>
          </Card>
        </div>
      </div>

      <AlertDialog open={del} onOpenChange={setDel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account for good?</AlertDialogTitle>
            <AlertDialogDescription>This removes your resumes, receipts, tracker, and Copilot history. It cannot be undone. Consider exporting your data first. Type DELETE to confirm.</AlertDialogDescription>
          </AlertDialogHeader>
          <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} aria-label="Type DELETE to confirm" placeholder="DELETE" />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmText("")}>Keep my account</AlertDialogCancel>
            <AlertDialogAction
              disabled={confirmText !== "DELETE" || deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async (e) => {
                if (!live) {
                  reset();
                  toast("Your account has been deleted", { description: "Prototype: the sample data was cleared from this browser session." });
                  nav("/");
                  return;
                }
                e.preventDefault();
                setDeleting(true);
                try {
                  await api("account/delete", { confirm: "DELETE" });
                  await signOut();
                  setDel(false);
                  toast("Your account has been deleted", { description: "Your resume, matches, and everything else are gone." });
                  nav("/");
                } catch (err) {
                  toast.error("We could not delete the account", { description: (err as Error).message });
                } finally {
                  setDeleting(false);
                }
              }}
            >
              Delete account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
