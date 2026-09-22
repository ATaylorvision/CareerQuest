import { useState } from "react";
import { toast } from "sonner";
import { api, ApiError } from "@/live/api";

export interface LookedUpJob {
  found: boolean;
  title?: string;
  company?: string;
  location?: string;
  description?: string;
  salaryMin?: number;
  salaryMax?: number;
  companyWebsite?: string;
}

/** Reads a pasted posting link, server side, and hands back whatever it could find on the page. */
export function useUrlLookup() {
  const [busy, setBusy] = useState(false);
  const lookup = async (url: string): Promise<LookedUpJob | null> => {
    setBusy(true);
    try {
      const out = await api<LookedUpJob>("studio", { action: "lookupUrl", url });
      if (!out.found) toast("We could not read that page", { description: "You can still fill in the details by hand." });
      return out;
    } catch (e) {
      toast.error("We could not look up that link", { description: e instanceof ApiError ? e.message : "Please try again, or fill in the details by hand." });
      return null;
    } finally {
      setBusy(false);
    }
  };
  return { lookup, busy };
}
