import { Link } from "react-router-dom";
import { Hammer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStore } from "@/store/AppStore";

/**
 * Real accounts must never see sample content. Screens that are not yet connected to
 * real data show this page instead, and the demo account keeps its full version.
 */
export function LiveGate({ feature, blurb, children }: { feature: string; blurb: string; children: React.ReactNode }) {
  const { state } = useStore();
  if (state.mode !== "live") return <>{children}</>;
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center py-16 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Hammer className="h-6 w-6 text-muted-foreground" />
      </div>
      <h1 className="font-display text-3xl font-semibold">{feature} is being connected to your real data</h1>
      <p className="mt-3 text-muted-foreground">{blurb}</p>
      <p className="mt-2 text-sm text-muted-foreground">We would rather hold it back than show you sample content that looks like yours.</p>
      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <Button asChild>
          <Link to="/app/matches">Back to your matches</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/app/copilot">Ask Wren instead</Link>
        </Button>
      </div>
    </div>
  );
}
