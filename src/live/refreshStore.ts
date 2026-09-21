import { useSyncExternalStore } from "react";
import { runPipeline, type Progress } from "./pipeline";
import { setLiveJobs } from "@/data/jobs";

interface RefreshState {
  running: boolean;
  progress: Progress | null;
  error: string;
  lastRunAt: number | null;
  lastFound: number | null;
  /** Why a search found nothing, when we know. */
  lastNote: string;
}

let state: RefreshState = { running: false, progress: null, error: "", lastRunAt: null, lastFound: null, lastNote: "" };
const listeners = new Set<() => void>();
const set = (patch: Partial<RefreshState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};

export function useRefreshState() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    () => state,
  );
}

/** Looks for new real listings and scores them. Lives outside any page so it survives navigation. */
export async function startRefresh(beforeSearch?: () => Promise<void>) {
  if (state.running) return;
  set({ running: true, error: "", progress: { stage: "search", message: "Starting" } });
  try {
    await beforeSearch?.();
    const res = await runPipeline({
      onProgress: (p) => set({ progress: p }),
      onJobs: (jobs) => setLiveJobs(jobs),
    });
    set({ running: false, lastRunAt: Date.now(), lastFound: res.total, lastNote: res.note ?? "" });
  } catch (e) {
    set({ running: false, error: (e as Error).message });
  }
}
