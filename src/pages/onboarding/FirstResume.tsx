import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Logo } from "@/components/common";
import { useLive } from "@/live/LiveProvider";
import { useStore } from "@/store/AppStore";
import { useDocTitle } from "@/hooks/useDocTitle";
import Studio from "@/pages/app/Studio";

/**
 * The first resume, tailored to the job the person picked. It is the real Studio, in a plain frame, so a guest
 * can work on it before they have an account. Downloading it is where they make one.
 */
export default function FirstResume() {
  useDocTitle("Your first resume");
  const nav = useNavigate();
  const { phase, user } = useLive();
  const { state } = useStore();

  // Nobody here without a session: send them back to setup, which starts one.
  useEffect(() => {
    if (phase === "ready" && !user) nav("/onboarding", { replace: true });
  }, [phase, user, nav]);

  if (!user || !state.authed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas" role="status">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Loading" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b bg-background/90">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <Logo compact to="/" />
          <Link to="/onboarding" className="text-sm text-muted-foreground hover:text-foreground">
            Back to my matches
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Studio />
      </main>
    </div>
  );
}
