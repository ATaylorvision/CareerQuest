import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** True when the app is connected to a real database. Without it, only the demo account works. */
/** The sample account, its sample testimonials and its numbers. Off in a real launch. */
export const ALLOW_DEMO = import.meta.env.VITE_ALLOW_DEMO === "1";

export const LIVE_AVAILABLE = !!(url && key);

export const supabase: SupabaseClient | null = LIVE_AVAILABLE
  ? createClient(url!, key!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // PKCE puts the code in the query string, which works with the hash based router.
        flowType: "pkce",
      },
    })
  : null;

export function requireSupabase(): SupabaseClient {
  if (!supabase) throw new Error("The database is not connected.");
  return supabase;
}
