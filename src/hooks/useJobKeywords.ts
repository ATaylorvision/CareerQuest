import { useEffect, useMemo, useState } from "react";
import type { Job } from "@/data/jobs";
import { extractKeywordsBasic, type PostingKeywords } from "@/lib/keywords";
import { api } from "@/live/api";

export type KeywordSource = "ai" | "basic" | "pasted";

/** What can be read from the listing for free, with no model involved. */
export function basicKeywordsFor(job: Job, pasted?: string): PostingKeywords {
  if (pasted && pasted.trim().length > 80) return extractKeywordsBasic({ body: `${job.title}\n${pasted}` });
  if (job.live) return extractKeywordsBasic({ body: `${job.title}\n${job.descriptionText ?? ""}` });
  return extractKeywordsBasic({
    required: [job.title, ...job.requirements],
    preferred: job.niceToHave,
    body: [...job.responsibilities, job.summary].join("\n"),
  });
}

/**
 * True when the listing only gave a short excerpt. Most boards share about 500
 * characters, so what can be read from them is thin, and the panel says so
 * rather than pretending it saw the whole posting.
 */
export const isExcerpt = (job: Job): boolean => !!job.live && (job.descriptionText ?? "").length < 1200;

// Shared across the page, so opening the same job twice never asks twice.
const known = new Map<string, PostingKeywords>();
const inflight = new Map<string, Promise<PostingKeywords | null>>();

async function fetchKeywords(jobId: string): Promise<PostingKeywords | null> {
  const running = inflight.get(jobId);
  if (running) return running;
  const p = (async () => {
    try {
      const out = await api<{ must: string[]; nice: string[]; source: string }>("studio", { action: "keywords", jobId });
      const k = { must: out.must, nice: out.nice };
      // A "basic" answer means the listing was too thin to spend a model on, so it is not final.
      if (out.source !== "basic") known.set(jobId, k);
      return k;
    } catch {
      return null;
    } finally {
      inflight.delete(jobId);
    }
  })();
  inflight.set(jobId, p);
  return p;
}

/**
 * The terms a posting asks for. Shows the free read straight away, then swaps
 * in the model's read when it arrives. A full posting the person pasted in
 * wins over both, because it is the most complete text there is.
 */
export function useJobKeywords(job: Job | undefined, opts: { live: boolean; pasted?: string }) {
  const id = job?.id;
  const stored = job?.keywords ?? null;
  const [remote, setRemote] = useState<PostingKeywords | null>(() => (id ? (known.get(id) ?? null) : null));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setRemote(id ? (known.get(id) ?? null) : null);
    if (!id || !opts.live || opts.pasted || stored || known.has(id)) {
      setLoading(false);
      return;
    }
    let current = true;
    setLoading(true);
    void fetchKeywords(id).then((k) => {
      if (!current) return;
      setRemote(k);
      setLoading(false);
    });
    return () => {
      current = false;
    };
  }, [id, opts.live, opts.pasted, stored]);

  const basic = useMemo(() => (job ? basicKeywordsFor(job, opts.pasted) : null), [job, opts.pasted]);
  const keywords = opts.pasted ? basic : (remote ?? stored ?? basic);
  const source: KeywordSource = opts.pasted ? "pasted" : remote || stored ? "ai" : "basic";
  return { keywords, source, loading, excerpt: job ? isExcerpt(job) && !opts.pasted : false };
}
