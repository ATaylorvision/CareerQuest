import { useCallback, useRef, useState } from "react";

export type SuggestionStatus = "pending" | "applied" | "skipped";

/** One edit Wren has proposed, wherever it came from. The chat and the document both read the same list. */
export interface Suggestion {
  id: string;
  kind: "replace" | "add";
  /** "summary", "skills" or a line id. Empty for an added line. */
  field: string;
  /** The role an added line goes under. */
  roleId: string;
  before: string;
  after: string;
  why: string;
  status: SuggestionStatus;
}

export interface SuggestionStore {
  items: Record<string, Suggestion>;
  register: (list: Omit<Suggestion, "status">[]) => void;
  use: (id: string) => void;
  skip: (id: string) => void;
  /** Puts back what was there, and offers the suggestion again. */
  undo: (id: string) => void;
  canUndo: (id: string) => boolean;
}

/**
 * `apply` puts a suggestion on the resume and returns the way to take it off again.
 * Keeping that here means accepting from the chat and from the page behave the same.
 */
export function useSuggestions(apply: (s: Suggestion) => () => void): SuggestionStore {
  const [items, setItems] = useState<Record<string, Suggestion>>({});
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const undoers = useRef(new Map<string, () => void>());

  const setStatus = useCallback((id: string, status: SuggestionStatus) => setItems((m) => (m[id] ? { ...m, [id]: { ...m[id], status } } : m)), []);

  const register = useCallback((list: Omit<Suggestion, "status">[]) => {
    setItems((m) => {
      const next = { ...m };
      for (const s of list) {
        // A newer suggestion for the same line replaces one still waiting on it.
        if (s.kind === "replace") for (const o of Object.values(next)) if (o.field === s.field && o.kind === "replace" && o.status === "pending") delete next[o.id];
        next[s.id] = { ...s, status: "pending" };
      }
      return next;
    });
  }, []);

  const use = useCallback(
    (id: string) => {
      const s = itemsRef.current[id];
      if (!s || s.status === "applied") return;
      undoers.current.set(id, apply(s));
      setStatus(id, "applied");
    },
    [apply, setStatus],
  );
  const skip = useCallback((id: string) => setStatus(id, "skipped"), [setStatus]);
  const undo = useCallback(
    (id: string) => {
      undoers.current.get(id)?.();
      undoers.current.delete(id);
      setStatus(id, "pending");
    },
    [setStatus],
  );
  const canUndo = useCallback((id: string) => undoers.current.has(id), []);

  return { items, register, use, skip, undo, canUndo };
}
