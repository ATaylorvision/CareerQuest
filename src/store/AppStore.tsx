import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ResumeFormat } from "@/lib/resumeFormat";
import { buildSeedApplications, type Application } from "@/data/applications";
import { SEED_CONNECTIONS, type Connection } from "@/data/connections";
import { SEED_CONVERSATIONS, type Conversation } from "@/data/copilot";
import { SEED_ACTIVITY, SEED_PLAN_DONE, type Intensity } from "@/data/plan";
import { SEED_VERSIONS, type ResumeVersion } from "@/data/resumeStudio";
import { DEFAULT_RESUME_TEMPLATE } from "@/data/resumeTemplates";
import { DEFAULT_LETTER_TEMPLATE } from "@/data/letterTemplates";
import { DEMO_USER } from "@/data/user";
import { daysAgo, daysFromNow } from "@/lib/date";

export type Tier = "free" | "trial" | "pro";
export type Situation = "changer" | "laidoff" | "employed" | "returning";
export type Decision = "accepted" | "rejected";

export interface SavedLetter {
  id: string;
  jobId: string;
  tone: string;
  text: string;
  createdAt: string;
}

export type AppMode = "none" | "demo" | "live";

/** Extras bought on top of a plan. A Pro subscription does not include these. */
export interface AddOns {
  connections: boolean;
}

export interface AppState {
  v: number;
  /** none: signed out. demo: local sample account. live: a real account backed by the database. */
  mode: AppMode;
  authed: boolean;
  onboarded: boolean;
  profile: { name: string; email: string; location: string; headline: string };
  prefs: {
    situation: Situation;
    prevField: string;
    targetField: string;
    roles: string[];
    locations: string[];
    remote: "any" | "remote" | "hybrid" | "onsite";
    /** How far the person will travel from profile.location for an onsite or hybrid job. */
    maxDistanceMiles: number;
    salaryFloor: number;
    mustHaves: string[];
    dealbreakers: string[];
    intensity: Intensity;
  };
  billing: { tier: Tier; cycle: "monthly" | "yearly"; trialStartedAt: string | null; trialEndsAt: string | null; renewsAt: string | null; cancelledAt: string | null; addOns: AddOns };
  usage: { tailoredResumes: number; coverLetters: number; copilotMessages: number };
  legitThreshold: number;
  dismissedJobIds: string[];
  applications: Application[];
  planDone: Record<string, boolean>;
  activity: boolean[];
  /** The calendar day that activity[0] refers to (YYYY-MM-DD). Used to roll the streak forward. */
  activityDate: string;
  streakBrokenDemo: boolean;
  resume: {
    jobId: string;
    decisions: Record<string, Decision>;
    versions: ResumeVersion[];
    activeVersionId: string;
    tailoredJobs: string[];
    templateId: string;
    letterTemplateId: string;
    /** Wording typed straight onto the document, per job then per field. Kept per version on purpose. */
    edits?: Record<string, Record<string, string>>;
    /** Lines the person added under a role, per job then per role. Their own words, so they are never marked as suggested. */
    added?: Record<string, Record<string, { id: string; text: string }[]>>;
    /** A full posting pasted in where the listing only gave an excerpt. Saved with the rest of the working state, so private to the account and capped in size. */
    postingText?: Record<string, string>;
    /** Font, size, spacing and margins for the printed page. One choice for the account, so every version looks alike. */
    format?: ResumeFormat;
    /** Name and contact details belong to the account, so every version shares them. */
    contact?: { name?: string; email?: string; phone?: string; location?: string };
  };
  letters: SavedLetter[];
  connections: Connection[];
  chats: Conversation[];
  roadmap: Record<string, "started" | "done">;
  weekly: { applications: number; networking: number; learningHours: number; savedAt: string | null };
  confettiShown: boolean;
  notifications: Record<string, boolean>;
  practice: Record<string, number>;
  uploadedFileName: string | null;
  /** Profile questions already answered here, so a real answer is not asked for twice. */
  answered?: Record<string, boolean>;
}

const KEY = "cq-state-v6";

export function seedState(): AppState {
  return {
    v: 6,
    mode: "none",
    authed: false,
    onboarded: false,
    profile: { name: DEMO_USER.name, email: DEMO_USER.email, location: DEMO_USER.location, headline: DEMO_USER.headline },
    prefs: {
      situation: "laidoff",
      prevField: "retail",
      targetField: "supply",
      roles: ["Operations Manager", "Supply Chain Analyst", "Program Operations Manager", "Inventory Control Manager"],
      locations: ["Providence, RI", "Boston, MA", "Hartford, CT", "Remote (US)"],
      remote: "any",
      maxDistanceMiles: 45,
      salaryFloor: 65000,
      mustHaves: ["Health insurance from day one", "Under 45 minute commute or remote"],
      dealbreakers: ["Commission only pay", "Overnight shifts"],
      intensity: "urgent",
    },
    billing: { tier: "trial", cycle: "monthly", trialStartedAt: daysAgo(2), trialEndsAt: daysFromNow(5), renewsAt: daysFromNow(5), cancelledAt: null, addOns: { connections: false } },
    usage: { tailoredResumes: 5, coverLetters: 3, copilotMessages: 41 },
    legitThreshold: 40,
    dismissedJobIds: [],
    applications: buildSeedApplications(),
    planDone: { ...SEED_PLAN_DONE },
    activity: [...SEED_ACTIVITY],
    activityDate: "",
    streakBrokenDemo: false,
    resume: { jobId: "j01", decisions: {}, versions: SEED_VERSIONS.map((v) => ({ ...v })), activeVersionId: "v-supply", tailoredJobs: [], templateId: DEFAULT_RESUME_TEMPLATE, letterTemplateId: DEFAULT_LETTER_TEMPLATE, edits: {}, contact: {} },
    letters: [],
    connections: SEED_CONNECTIONS.map((c) => ({ ...c })),
    chats: SEED_CONVERSATIONS.map((c) => ({ ...c, messages: [...c.messages] })),
    roadmap: { "wms-1": "started", "bi-1": "done" },
    weekly: { applications: 6, networking: 3, learningHours: 3, savedAt: null },
    confettiShown: false,
    notifications: {
      dailyPlan: true,
      newMatches: true,
      ghostAlerts: true,
      applicationUpdates: true,
      weeklyCheckIn: true,
      tips: false,
      marketing: false,
    },
    practice: {},
    uploadedFileName: null,
  };
}

function load(): AppState {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      if (parsed.v === 6 && parsed.mode !== "live") return parsed;
    }
  } catch {
    /* storage can be unavailable in private windows */
  }
  return seedState();
}

interface Ctx {
  state: AppState;
  update: (fn: (draft: AppState) => void) => void;
  reset: (opts?: { keepAuth?: boolean }) => void;
  hydrate: (next: AppState) => void;
}

const StoreContext = createContext<Ctx | null>(null);

export function AppStoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(load);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
    }
    if (state.mode === "live") return;
    try {
      sessionStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state]);

  const update = useCallback((fn: (draft: AppState) => void) => {
    setState((prev) => {
      const draft = structuredClone(prev);
      fn(draft);
      return draft;
    });
  }, []);

  const reset = useCallback((opts?: { keepAuth?: boolean }) => {
    setState((prev) => {
      const s = seedState();
      if (opts?.keepAuth) {
        s.mode = prev.mode;
        s.authed = prev.authed;
        s.onboarded = prev.onboarded;
      }
      return s;
    });
  }, []);

  const hydrate = useCallback((next: AppState) => setState(next), []);

  const value = useMemo(() => ({ state, update, reset, hydrate }), [state, update, reset, hydrate]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside AppStoreProvider");
  return ctx;
}
