import { useEffect } from "react";

export function useDocTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} · CareerQuest` : "CareerQuest";
  }, [title]);
}
