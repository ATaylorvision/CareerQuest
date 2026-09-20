import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

let cached: SupabaseClient | null = null;

/** Server-side Supabase client with full access. Never expose this to the browser. */
export function admin(): SupabaseClient {
  if (!cached) {
    const url = process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new HttpError(500, "The server is not configured yet.");
    cached = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return cached;
}

export interface AuthedUser {
  id: string;
  email: string | null;
  /** True once the person has proved they own the address. */
  emailConfirmed: boolean;
}

export async function requireUser(req: VercelRequest): Promise<AuthedUser> {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) throw new HttpError(401, "Please log in again.");
  const { data, error } = await admin().auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, "Your session expired. Please log in again.");
  return { id: data.user.id, email: data.user.email ?? null, emailConfirmed: !!data.user.email_confirmed_at };
}

type Handler = (req: VercelRequest, res: VercelResponse, user: AuthedUser) => Promise<unknown>;

/** Wraps an endpoint: POST only, must be signed in, errors become clean JSON. */
export function route(handler: Handler, opts: { stream?: boolean } = {}) {
  return async function (req: VercelRequest, res: VercelResponse) {
    try {
      if (req.method !== "POST") throw new HttpError(405, "Use POST.");
      const user = await requireUser(req);
      const out = await handler(req, res, user);
      if (!opts.stream && !res.writableEnded) res.status(200).json(out ?? { ok: true });
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 500;
      const message = e instanceof HttpError ? e.message : "Something went wrong on our side. Please try again.";
      if (!(e instanceof HttpError)) console.error("[api error]", e);
      if (res.headersSent) {
        res.end();
      } else {
        res.status(status).json({ error: message });
      }
    }
  };
}

export function body<T = Record<string, unknown>>(req: VercelRequest): T {
  const b = req.body;
  if (b && typeof b === "object") return b as T;
  if (typeof b === "string" && b) {
    try {
      return JSON.parse(b) as T;
    } catch {
      throw new HttpError(400, "That request was not valid.");
    }
  }
  return {} as T;
}
