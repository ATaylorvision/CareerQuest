import { useSyncExternalStore } from "react";
import { jobsVersion, subscribeJobs } from "@/data/jobs";

/** Re-renders the caller whenever the job list changes (live accounts load jobs after sign in). */
export function useJobsVersion() {
  return useSyncExternalStore(subscribeJobs, jobsVersion);
}
