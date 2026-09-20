import { useCallback, useEffect, useState } from "react";

type Theme = "light" | "dark";

function current(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

const listeners = new Set<(t: Theme) => void>();

export function setTheme(t: Theme) {
  document.documentElement.classList.toggle("dark", t === "dark");
  try {
    localStorage.setItem("cq-theme", t);
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l(t));
}

export function useTheme() {
  const [theme, setLocal] = useState<Theme>(current);
  useEffect(() => {
    listeners.add(setLocal);
    return () => {
      listeners.delete(setLocal);
    };
  }, []);
  const toggle = useCallback(() => setTheme(current() === "dark" ? "light" : "dark"), []);
  return { theme, toggle, setTheme };
}
