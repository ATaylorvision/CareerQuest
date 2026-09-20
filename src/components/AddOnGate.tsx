import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Check, Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDocTitle } from "@/hooks/useDocTitle";
import { Card } from "@/components/common";
import { useStore, type AddOns } from "@/store/AppStore";

/** Placeholder price. Change it here and the whole paywall follows. */
export const ADD_ON_PRICE = { connections: { monthly: 12, name: "Insider Connections" } };

interface Props {
  addOn: keyof AddOns;
  title: string;
  blurb: string;
  points: string[];
  children: React.ReactNode;
}

/**
 * A paywall for something bought on top of a plan. Pro does not include it,
 * so a Pro subscriber sees this too. `billing.addOns` is written by the server
 * from Stripe only, so nothing in the browser can unlock it.
 */
export function AddOnGate({ addOn, title, blurb, points, children }: Props) {
  useDocTitle(title);
  const { state } = useStore();
  if (state.billing.addOns?.[addOn]) return <>{children}</>;

  const price = ADD_ON_PRICE[addOn];
  const live = state.mode === "live";

  return (
    <div className="mx-auto max-w-2xl py-10">
      <Card className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft">
          <Lock className="h-6 w-6 text-primary" />
        </div>
        <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-primary">Add on</div>
        <h1 className="font-display text-3xl font-semibold text-balance">{title}</h1>
        <p className="mx-auto mt-3 max-w-md text-muted-foreground">{blurb}</p>

        <ul className="mx-auto mt-6 max-w-sm space-y-2.5 text-left">
          {points.map((p) => (
            <li key={p} className="flex items-start gap-2.5 text-sm">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
              <span>{p}</span>
            </li>
          ))}
        </ul>

        <div className="mt-7 rounded-xl border bg-muted/40 p-5">
          <div className="flex items-baseline justify-center gap-1.5">
            <span className="num font-display text-4xl font-semibold">${price.monthly}</span>
            <span className="text-sm text-muted-foreground">a month</span>
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground">Bought separately. It is not part of Pro, and Pro is not required.</p>

          <Button
            size="lg"
            className="mt-4 w-full sm:w-auto"
            onClick={() =>
              toast("Payments are not switched on yet", {
                description: "Nothing was charged. This add on goes on sale when billing is live, and you will be able to cancel it in one click.",
              })
            }
          >
            <Sparkles /> Add {price.name}
          </Button>
          {/* Saying this out loud beats a button that looks like it will charge and does not. */}
          <p className="mt-3 text-xs text-muted-foreground">Billing is not live yet, so this button will not charge you.</p>
        </div>

        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Button asChild variant="outline">
            <Link to="/app/matches">Back to your matches</Link>
          </Button>
          {live && (
            <Button asChild variant="ghost">
              <Link to="/app/billing">See plans</Link>
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
