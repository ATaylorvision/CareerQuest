import { requireSupabase } from "./supabase";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function token(): Promise<string> {
  const { data } = await requireSupabase().auth.getSession();
  if (!data.session) throw new ApiError("Please log in again.", 401);
  return data.session.access_token;
}

/** Tells the app that something counted against the person's plan has just happened, so the numbers on screen are read fresh. */
export const USAGE_EVENT = "cq:usage";
const announceUsage = (path: string) => {
  if (typeof window !== "undefined" && /^(studio|chat)/.test(path)) window.dispatchEvent(new Event(USAGE_EVENT));
};

/** Calls one of our server functions as the signed in user. */
export async function api<T = unknown>(path: string, payload: unknown = {}): Promise<T> {
  const res = await fetch(`/api/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${await token()}` },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not json */
  }
  if (!res.ok) {
    const msg = (json as { error?: string } | null)?.error ?? (res.status === 504 ? "That took too long. Please try again." : "Something went wrong. Please try again.");
    throw new ApiError(msg, res.status);
  }
  announceUsage(path);
  return json as T;
}

/** Streams a plain text reply, calling onText with each new piece. */
export async function apiStream(path: string, payload: unknown, onText: (chunk: string) => void, signal?: AbortSignal): Promise<string> {
  const res = await fetch(`/api/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${await token()}` },
    body: JSON.stringify(payload),
    signal,
  });
  if (!res.ok || !res.body) {
    let msg = "Something went wrong. Please try again.";
    try {
      msg = (await res.json()).error ?? msg;
    } catch {
      /* ignore */
    }
    throw new ApiError(msg, res.status);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let full = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const t = dec.decode(value, { stream: true });
    full += t;
    onText(t);
  }
  announceUsage(path);
  return full;
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(new Error("We could not read that file."));
    r.readAsDataURL(file);
  });
}
