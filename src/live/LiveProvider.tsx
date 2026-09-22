import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { seedState, useStore, type AppState } from "@/store/AppStore";
import { JOBS, restoreDemoJobs, setLiveJobs, setMoreJobs } from "@/data/jobs";
import { emptyResume, restoreDemoResume, setBaseResume, type Resume } from "@/data/user";
import { INTENSITY_META } from "@/data/plan";
import { normalizeApplications } from "@/lib/tracker";
import { DEFAULT_RESUME_TEMPLATE } from "@/data/resumeTemplates";
import { DEFAULT_LETTER_TEMPLATE } from "@/data/letterTemplates";
import { LIVE_AVAILABLE, supabase } from "./supabase";
import { loadJobs, loadMoreJobs } from "./pipeline";
import { USAGE_EVENT } from "./api";
import { setHomePoint } from "./mapJob";

interface LiveCtx {
  phase: "loading" | "ready";
  user: User | null;
  /** Staff account. Only used to show the Admin link; the server checks again on every admin call. */
  isAdmin: boolean;
  /** Re-reads matches from the database into the app. */
  reloadJobs: () => Promise<void>;
  /** Writes profile and preferences right now (used before a search). */
  flushProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<LiveCtx>({ phase: "ready", user: null, isAdmin: false, reloadJobs: async () => {}, flushProfile: async () => {}, signOut: async () => {} });
export const useLive = () => useContext(Ctx);

/** A brand new real account: nothing seeded, nothing invented. */
export function emptyLiveState(name: string, email: string): AppState {
  const s = seedState();
  s.mode = "live";
  s.authed = true;
  s.onboarded = false;
  s.profile = { name, email, location: "", headline: "" };
  s.prefs = { situation: "changer", prevField: "", targetField: "supply", roles: [], locations: [], remote: "any", maxDistanceMiles: 30, salaryFloor: 50000, mustHaves: [], dealbreakers: [], intensity: "active" };
  s.billing = { tier: "free", cycle: "monthly", trialStartedAt: null, trialEndsAt: null, renewsAt: null, cancelledAt: null, addOns: { connections: false } };
  s.usage = { tailoredResumes: 0, coverLetters: 0, copilotMessages: 0 };
  s.legitThreshold = 40;
  s.dismissedJobIds = [];
  s.applications = [];
  s.planDone = {};
  s.activity = Array.from({ length: 21 }, () => false);
  s.activityDate = new Date().toLocaleDateString("en-CA");
  s.streakBrokenDemo = false;
  s.resume = { jobId: "", decisions: {}, versions: [], activeVersionId: "", tailoredJobs: [], templateId: DEFAULT_RESUME_TEMPLATE, letterTemplateId: DEFAULT_LETTER_TEMPLATE, edits: {}, contact: {} };
  s.letters = [];
  s.connections = [];
  s.chats = [];
  s.roadmap = {};
  s.weekly = { applications: 5, networking: 2, learningHours: 2, savedAt: null };
  s.confettiShown = false;
  s.practice = {};
  s.uploadedFileName = null;
  s.streakBrokenDemo = false;
  return s;
}

interface ProfileRow {
  full_name: string | null;
  email: string | null;
  location: string | null;
  headline: string | null;
  situation: AppState["prefs"]["situation"] | null;
  prev_field: string | null;
  target_field: string | null;
  target_roles: string[];
  locations: string[];
  remote_pref: AppState["prefs"]["remote"];
  max_distance_miles: number | null;
  home_lat: number | null;
  home_geocoded_for: string | null;
  salary_ceiling: number | null;
  target_other: string | null;
  is_guest: boolean;
  home_lng: number | null;
  salary_floor: number | null;
  must_haves: string[];
  dealbreakers: string[];
  intensity: AppState["prefs"]["intensity"];
  legit_threshold: number;
  is_admin: boolean;
  notification_prefs: Record<string, boolean>;
  onboarded_at: string | null;
  plan_tier: "free" | "trial" | "pro";
  billing_cycle: "monthly" | "yearly" | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  add_ons: Record<string, boolean> | null;
}

export const BASE_VERSION = { id: "v-base", name: "Base resume", target: "General", ats: 0, createdDaysAgo: 0, sends: 0, responses: 0, note: "The resume you uploaded." };

export function LiveProvider({ children }: { children: React.ReactNode }) {
  const { state, update, hydrate, reset } = useStore();
  const [phase, setPhase] = useState<"loading" | "ready">(LIVE_AVAILABLE ? "loading" : "ready");
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const loadedFor = useRef<string | null>(null);
  const hydrated = useRef(false);
  const modeRef = useRef(state.mode);
  modeRef.current = state.mode;
  const stateRef = useRef(state);
  stateRef.current = state;

  /** What this person has really used this month, read from the counters the server keeps. It is what their plan is measured against. */
  const refreshUsage = useCallback(async () => {
    if (!supabase || modeRef.current !== "live") return;
    const month = `${new Date().toISOString().slice(0, 7)}-01`;
    const { data } = await supabase.from("usage_counters").select("tailored_resumes, cover_letters, copilot_messages").eq("month", month).maybeSingle();
    update((s) => {
      s.usage = { tailoredResumes: data?.tailored_resumes ?? 0, coverLetters: data?.cover_letters ?? 0, copilotMessages: data?.copilot_messages ?? 0 };
    });
  }, [update]);

  const reloadJobs = useCallback(async () => {
    setLiveJobs(await loadJobs());
    try {
      setMoreJobs(await loadMoreJobs(new Set(JOBS.map((j) => j.id))));
    } catch {
      /* the board is a bonus; matches still load */
    }
  }, []);

  const loadUser = useCallback(
    async (u: User) => {
      if (!supabase || loadedFor.current === u.id) return;
      loadedFor.current = u.id;
      hydrated.current = false;
      try {
      const [{ data: profile }, { data: resumes }, { data: saved }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", u.id).single<ProfileRow>(),
        supabase.from("resumes").select("parsed, file_name").eq("is_base", true).order("created_at", { ascending: false }).limit(1),
        supabase.from("user_state").select("state").eq("user_id", u.id).maybeSingle(),
      ]);

      const name = profile?.full_name || (u.user_metadata?.full_name as string) || "";
      const base = emptyLiveState(name, u.email ?? profile?.email ?? "");
      const savedState = (saved?.state ?? {}) as Partial<AppState>;
      const s: AppState = { ...base, ...savedState, mode: "live", authed: true, v: base.v };
      // Older saved state used one "closed" column. Sort those into rejected or withdrawn.
      s.applications = normalizeApplications(s.applications ?? []);

      setIsAdmin(!!profile?.is_admin);
      // Distance is per person, so the listings are measured against this.
      setHomePoint(profile?.home_lat != null && profile?.home_lng != null ? { lat: profile.home_lat, lng: profile.home_lng } : null);

      if (profile) {
        s.profile = {
          name,
          email: u.email ?? "",
          location: profile.location ?? "",
          headline: profile.headline ?? "",
          // Confirmed means we looked up exactly this text and the person said yes, so the coordinates belong to it.
          locationConfirmed: !!profile.location && profile.home_lat != null && profile.home_geocoded_for === profile.location,
        };
        s.prefs = {
          situation: profile.situation ?? "changer",
          prevField: profile.prev_field ?? "",
          targetField: profile.target_field ?? "supply",
          roles: profile.target_roles ?? [],
          locations: profile.locations ?? [],
          remote: profile.remote_pref ?? "any",
          maxDistanceMiles: profile.max_distance_miles ?? 30,
          salaryFloor: profile.salary_floor ?? 50000,
          salaryCeiling: profile.salary_ceiling ?? undefined,
          targetOther: profile.target_other ?? undefined,
          mustHaves: profile.must_haves ?? [],
          dealbreakers: profile.dealbreakers ?? [],
          intensity: profile.intensity ?? "active",
        };
        s.legitThreshold = profile.legit_threshold ?? 40;
        s.notifications = { ...base.notifications, ...(profile.notification_prefs ?? {}) };
        s.onboarded = !!profile.onboarded_at;
        s.billing = {
          tier: profile.plan_tier,
          cycle: profile.billing_cycle ?? "monthly",
          trialStartedAt: null,
          trialEndsAt: profile.trial_ends_at,
          renewsAt: profile.current_period_end,
          cancelledAt: profile.cancel_at_period_end ? (profile.current_period_end ?? new Date().toISOString()) : null,
          addOns: { connections: !!profile.add_ons?.connections },
        };
      }

      // Roll the streak calendar forward by the days that passed since the user was last here.
      const todayKey = new Date().toLocaleDateString("en-CA");
      if (!s.activityDate) s.activityDate = todayKey;
      if (s.activityDate !== todayKey) {
        const days = Math.max(0, Math.round((new Date(todayKey).getTime() - new Date(s.activityDate).getTime()) / 86_400_000));
        s.activity = [...Array.from({ length: Math.min(days, 21) }, () => false), ...s.activity].slice(0, 21);
        s.activityDate = todayKey;
      }

      const parsed = resumes?.[0]?.parsed as Resume | undefined;
      setBaseResume(parsed ?? emptyResume());
      if (parsed) {
        s.uploadedFileName = resumes?.[0]?.file_name ?? "Your resume";
        if (!s.resume.versions.some((v) => v.id === "v-base")) s.resume.versions = [{ ...BASE_VERSION }, ...s.resume.versions];
        if (!s.resume.activeVersionId) s.resume.activeVersionId = "v-base";
      }

      hydrate(s);
      setUser(u);
      void refreshUsage();
      try {
        setLiveJobs(await loadJobs());
        setMoreJobs(await loadMoreJobs(new Set(JOBS.map((j) => j.id))).catch(() => []));
      } catch (e) {
        console.error("Could not load jobs", e);
        setLiveJobs([]);
      }
      hydrated.current = true;
      } catch (e) {
        console.error("Could not load your account", e);
        loadedFor.current = null;
      } finally {
        setPhase("ready");
      }
    },
    [hydrate, refreshUsage],
  );

  // Numbers on screen follow what the server has counted, a moment after anything that uses the plan.
  useEffect(() => {
    let t: number | undefined;
    const on = () => {
      window.clearTimeout(t);
      t = window.setTimeout(() => void refreshUsage(), 600);
    };
    window.addEventListener(USAGE_EVENT, on);
    return () => {
      window.removeEventListener(USAGE_EVENT, on);
      window.clearTimeout(t);
    };
  }, [refreshUsage]);

  // Watchdog: never leave someone staring at a spinner.
  useEffect(() => {
    if (phase !== "loading") return;
    const t = setTimeout(() => setPhase("ready"), 15_000);
    return () => clearTimeout(t);
  }, [phase]);

  const onSignedOut = useCallback(() => {
    loadedFor.current = null;
    hydrated.current = false;
    setUser(null);
    setIsAdmin(false);
    setHomePoint(null);
    if (modeRef.current === "live") {
      restoreDemoJobs();
      restoreDemoResume();
      reset();
    }
    setPhase("ready");
  }, [reset]);

  useEffect(() => {
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((event, session: Session | null) => {
      // Calling the database from inside this callback can deadlock the auth library, so defer.
      if (event === "INITIAL_SESSION") {
        if (session?.user) setTimeout(() => void loadUser(session.user), 0);
        else setPhase("ready");
      } else if (event === "SIGNED_IN" && session?.user) {
        // Fires again on token refresh and tab focus. loadUser ignores a user it already loaded.
        setTimeout(() => void loadUser(session.user), 0);
      } else if (event === "USER_UPDATED" && session?.user) {
        // A guest just became a member, or someone changed their email. Same account, so nothing reloads.
        setUser(session.user);
        update((s) => void (s.profile.email = session.user.email ?? s.profile.email));
      } else if (event === "SIGNED_OUT") {
        onSignedOut();
      }
    });
    return () => data.subscription.unsubscribe();
  }, [loadUser, onSignedOut, update]);

  /* ---------------- save profile and preferences ---------------- */

  const profilePayload = useCallback((s: AppState) => {
    const p = {
      full_name: s.profile.name,
      location: s.profile.location,
      headline: s.profile.headline,
      situation: s.prefs.situation,
      prev_field: s.prefs.prevField,
      target_field: s.prefs.targetField,
      target_roles: s.prefs.roles,
      locations: s.prefs.locations,
      remote_pref: s.prefs.remote,
      max_distance_miles: s.prefs.maxDistanceMiles,
      salary_floor: s.prefs.salaryFloor,
      salary_ceiling: s.prefs.salaryCeiling ?? null,
      target_other: s.prefs.targetOther ?? null,
      must_haves: s.prefs.mustHaves,
      dealbreakers: s.prefs.dealbreakers,
      intensity: INTENSITY_META[s.prefs.intensity] ? s.prefs.intensity : "active",
      legit_threshold: s.legitThreshold,
      notification_prefs: s.notifications,
      updated_at: new Date().toISOString(),
    } as Record<string, unknown>;
    return p;
  }, []);

  const flushProfile = useCallback(async () => {
    const s = stateRef.current;
    if (!supabase || s.mode !== "live" || !loadedFor.current) return;
    const payload = profilePayload(s);
    if (s.onboarded) payload.onboarded_at = new Date().toISOString();
    await supabase.from("profiles").update(payload).eq("id", loadedFor.current);
  }, [profilePayload]);

  const profileKey = JSON.stringify([state.profile, state.prefs, state.legitThreshold, state.notifications]);
  useEffect(() => {
    if (state.mode !== "live" || !hydrated.current) return;
    const t = setTimeout(() => void flushProfile(), 900);
    return () => clearTimeout(t);
  }, [profileKey, state.mode, flushProfile]);

  // Mark onboarding complete exactly once.
  useEffect(() => {
    if (state.mode !== "live" || !hydrated.current || !state.onboarded || !supabase || !loadedFor.current) return;
    void supabase.from("profiles").update({ onboarded_at: new Date().toISOString() }).eq("id", loadedFor.current).is("onboarded_at", null);
  }, [state.onboarded, state.mode]);

  /* ---------------- save working state ---------------- */

  useEffect(() => {
    if (state.mode !== "live" || !hydrated.current || !supabase || !loadedFor.current) return;
    const id = loadedFor.current;
    const t = setTimeout(() => {
      // Profile, preferences, and billing live in the profiles table, so they are left out here.
      const { profile: _p, prefs: _pr, legitThreshold: _t, notifications: _n, billing: _b, ...rest } = stateRef.current;
      void supabase!
        .from("user_state")
        .upsert({ user_id: id, state: rest, updated_at: new Date().toISOString() })
        .then(({ error }) => {
          if (error) console.error("Could not save your working state:", error.message);
        });
    }, 900);
    return () => clearTimeout(t);
  }, [state]);

  // If the tab is hidden or closed, save right away instead of waiting for the delay.
  useEffect(() => {
    const flush = () => {
      if (document.visibilityState !== "hidden") return;
      const cur = stateRef.current;
      if (cur.mode !== "live" || !hydrated.current || !supabase || !loadedFor.current) return;
      const { profile: _p, prefs: _pr, legitThreshold: _t, notifications: _n, billing: _b, ...rest } = cur;
      void supabase.from("user_state").upsert({ user_id: loadedFor.current, state: rest, updated_at: new Date().toISOString() });
      void flushProfile();
    };
    document.addEventListener("visibilitychange", flush);
    return () => document.removeEventListener("visibilitychange", flush);
  }, [flushProfile]);

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
    else update((s) => void (s.authed = false));
  }, [update]);

  const value = useMemo(() => ({ phase, user, isAdmin, reloadJobs, flushProfile, signOut }), [phase, user, isAdmin, reloadJobs, flushProfile, signOut]);

  if (phase === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas" role="status" aria-label="Loading your account">
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Getting your account ready</p>
        </div>
      </div>
    );
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
