import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Menu, Moon, Sun, X } from "lucide-react";
import { Logo } from "@/components/common";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/useTheme";
import { useStore } from "@/store/AppStore";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function PlainPolicyDialog({ open, onOpenChange, kind }: { open: boolean; onOpenChange: (o: boolean) => void; kind: "privacy" | "terms" }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{kind === "privacy" ? "Privacy, in plain English" : "Terms, in plain English"}</DialogTitle>
          <DialogDescription>The short version. Prototype content.</DialogDescription>
        </DialogHeader>
        {kind === "privacy" ? (
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed">
            <li>Your resume and applications are yours. We use them to match you and fill out applications you approve.</li>
            <li>We never sell your data, and we never share your resume with an employer you did not apply to.</li>
            <li>You can export everything or delete your account from Settings at any time. Deletion is permanent within 30 days.</li>
            <li>We keep the minimum needed to show your receipts. That is the point of receipts.</li>
          </ul>
        ) : (
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed">
            <li>The free plan is free forever. No card needed.</li>
            <li>Pro is $24 a month or $180 a year, after a 7 day free trial. We tell you the exact charge date before it happens.</li>
            <li>Cancel in one click from Account and billing. No phone call, no email.</li>
            <li>Refunds: request one within 14 days of any charge and we refund it in full.</li>
            <li>We only submit applications you approve, and we label every one honestly.</li>
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function MarketingLayout({ children }: { children: React.ReactNode }) {
  const { theme, toggle } = useTheme();
  const { state } = useStore();
  const [open, setOpen] = useState(false);
  const [policy, setPolicy] = useState<null | "privacy" | "terms">(null);
  const loc = useLocation();

  useEffect(() => {
    setOpen(false);
    if (loc.hash && loc.hash.length > 1 && !loc.hash.startsWith("#/")) return;
    window.scrollTo({ top: 0 });
  }, [loc.pathname]);

  const links = [
    { to: "/#features", label: "How it works" },
    { to: "/#who", label: "Who it is for" },
    { to: "/pricing", label: "Pricing" },
  ];

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-background">
      <a href="#content" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground">
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
        <div className="container flex h-16 items-center gap-6">
          <Logo />
          <nav aria-label="Site" className="hidden items-center gap-1 md:flex">
            {links.map((l) =>
              l.to.startsWith("/#") ? (
                <Link
                  key={l.to}
                  to="/"
                  onClick={() => setTimeout(() => scrollTo(l.to.slice(2)), 60)}
                  className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  {l.label}
                </Link>
              ) : (
                <NavLink
                  key={l.to}
                  to={l.to}
                  className={({ isActive }) => cn("rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-foreground", isActive ? "text-foreground font-medium" : "text-muted-foreground")}
                >
                  {l.label}
                </NavLink>
              ),
            )}
          </nav>
          <div className="flex-1" />
          <Button variant="ghost" size="icon-sm" onClick={toggle} aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
            {theme === "dark" ? <Sun /> : <Moon />}
          </Button>
          <div className="hidden items-center gap-2 sm:flex">
            {state.authed ? (
              <Button asChild>
                <Link to="/app">Open the app</Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" asChild>
                  <Link to="/login">Log in</Link>
                </Button>
                <Button asChild>
                  <Link to="/signup">Start free</Link>
                </Button>
              </>
            )}
          </div>
          <Button variant="ghost" size="icon-sm" className="sm:hidden" onClick={() => setOpen((o) => !o)} aria-label="Menu" aria-expanded={open}>
            {open ? <X /> : <Menu />}
          </Button>
        </div>
        {open && (
          <div className="border-t bg-background px-4 pb-4 pt-2 sm:hidden animate-fade-up">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to.startsWith("/#") ? "/" : l.to}
                onClick={() => {
                  setOpen(false);
                  if (l.to.startsWith("/#")) setTimeout(() => scrollTo(l.to.slice(2)), 60);
                }}
                className="block rounded-md px-2 py-2.5 text-sm hover:bg-accent"
              >
                {l.label}
              </Link>
            ))}
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Button variant="outline" asChild>
                <Link to="/login">Log in</Link>
              </Button>
              <Button asChild>
                <Link to="/signup">Start free</Link>
              </Button>
            </div>
          </div>
        )}
      </header>
      <main id="content">{children}</main>
      <footer className="border-t bg-canvas">
        <div className="container grid grid-cols-1 gap-8 py-12 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-3">
            <Logo />
            <p className="max-w-xs text-sm text-muted-foreground">A job search copilot for career changers and people restarting after a layoff.</p>
          </div>
          <div>
            <div className="mb-3 text-sm font-semibold">Product</div>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link className="hover:text-foreground" to="/pricing">Pricing</Link></li>
              <li><button className="hover:text-foreground" onClick={() => scrollTo("features")}>How it works</button></li>
              <li><button className="hover:text-foreground" onClick={() => scrollTo("shield")}>How we score jobs</button></li>
            </ul>
          </div>
          <div>
            <div className="mb-3 text-sm font-semibold">Account</div>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link className="hover:text-foreground" to="/signup">Create an account</Link></li>
              <li><Link className="hover:text-foreground" to="/login">Log in</Link></li>
            </ul>
          </div>
          <div>
            <div className="mb-3 text-sm font-semibold">Plain English</div>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><button className="hover:text-foreground" onClick={() => setPolicy("privacy")}>Privacy</button></li>
              <li><button className="hover:text-foreground" onClick={() => setPolicy("terms")}>Terms and refunds</button></li>
            </ul>
          </div>
        </div>
        <div className="border-t">
          <div className="container py-5 text-xs text-muted-foreground">
            CareerQuest prototype. All companies, people, jobs, and testimonials shown are fictional sample content.
          </div>
        </div>
      </footer>
      <PlainPolicyDialog open={!!policy} onOpenChange={(o) => !o && setPolicy(null)} kind={policy ?? "privacy"} />
    </div>
  );
}
