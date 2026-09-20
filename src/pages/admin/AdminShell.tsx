import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { Activity, ArrowLeft, Briefcase, ClipboardList, LayoutDashboard, Loader2, Lock, Moon, ScrollText, ShieldCheck, Sun, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/common";
import { useTheme } from "@/hooks/useTheme";
import { useLive } from "@/live/LiveProvider";
import { LIVE_AVAILABLE } from "@/live/supabase";
import { useDocTitle } from "@/hooks/useDocTitle";
import { cn } from "@/lib/utils";
import { ApiError } from "@/live/api";
import { adminApi } from "./shared";

const NAV = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/jobs", label: "Job cache", icon: Briefcase },
  { to: "/admin/applications", label: "Applications", icon: ClipboardList },
  { to: "/admin/system", label: "System", icon: Activity },
  { to: "/admin/log", label: "Audit log", icon: ScrollText },
];

interface Who {
  admin: true;
  id: string;
  email: string | null;
  viaEnv: boolean;
}

/** Everything under /admin is behind this. The server checks again on every call. */
export default function AdminShell() {
  useDocTitle("Admin");
  const { phase, user } = useLive();
  const { theme, setTheme } = useTheme();
  const nav = useNavigate();
  const [who, setWho] = useState<Who | null>(null);
  const [state, setState] = useState<"checking" | "ok" | "denied" | "anon">("checking");
  // The server explains exactly why it said no. Repeating that beats a guess.
  const [why, setWhy] = useState<string | null>(null);

  useEffect(() => {
    if (!LIVE_AVAILABLE) {
      setState("denied");
      return;
    }
    if (phase === "loading") return;
    if (!user) {
      setState("anon");
      return;
    }
    let live = true;
    adminApi<Who>("whoami")
      .then((w) => live && (setWho(w), setState("ok")))
      .catch((e) => {
        if (!live) return;
        setWhy(e instanceof ApiError ? e.message : null);
        setState("denied");
      });
    return () => {
      live = false;
    };
  }, [phase, user]);

  if (state === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking your access
      </div>
    );
  }

  if (state !== "ok") {
    const anon = state === "anon";
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Card className="max-w-md text-center">
          <Lock className="mx-auto h-7 w-7 text-muted-foreground" />
          <h1 className="mt-3 font-display text-xl font-semibold">{anon ? "Please log in" : "This area is for staff"}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {anon
              ? "The admin panel needs a signed in staff account."
              : !LIVE_AVAILABLE
                ? "This copy of CareerQuest is not connected to a database, so there is nothing to administer."
                : (why ?? "Your account does not have admin access. If that is wrong, ask another admin to grant it, or add your email to ADMIN_EMAILS.")}
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Button variant="outline" onClick={() => nav("/app")}>
              Back to the app
            </Button>
            {anon && <Button onClick={() => nav("/login")}>Log in</Button>}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas">
      {/* A permanent reminder that this is not the normal app. */}
      <div className="flex items-center justify-center gap-2 bg-foreground px-4 py-1.5 text-center text-xs font-medium text-background">
        <ShieldCheck className="h-3.5 w-3.5" />
        Staff view. You are looking at real accounts and real data.
      </div>

      <div className="mx-auto flex max-w-[1400px] gap-6 px-4 py-6 sm:px-6">
        <aside className="hidden w-52 shrink-0 lg:block">
          <div className="sticky top-6">
            <Link to="/app" className="mb-5 flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              CareerQuest app
            </Link>
            <nav aria-label="Admin sections">
              <ul className="space-y-0.5">
                {NAV.map((it) => (
                  <li key={it.to}>
                    <NavLink
                      to={it.to}
                      end={it.end}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                          isActive ? "bg-primary-soft text-primary" : "text-foreground/75 hover:bg-accent hover:text-foreground",
                        )
                      }
                    >
                      <it.icon className="h-[18px] w-[18px]" />
                      {it.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="mt-6 border-t pt-4">
              <div className="px-3 text-xs text-muted-foreground">
                <div className="truncate font-medium text-foreground">{who?.email}</div>
                <div className="mt-0.5">{who?.viaEnv ? "Admin via ADMIN_EMAILS" : "Admin account"}</div>
              </div>
              <Button variant="ghost" size="sm" className="mt-2 w-full justify-start gap-3 px-3" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
                {theme === "dark" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
                {theme === "dark" ? "Light mode" : "Dark mode"}
              </Button>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          {/* Small screens get the nav as a scrolling row instead of a sidebar. */}
          <div className="-mx-4 mb-5 overflow-x-auto px-4 lg:hidden">
            <nav aria-label="Admin sections" className="flex gap-1.5">
              {NAV.map((it) => (
                <NavLink
                  key={it.to}
                  to={it.to}
                  end={it.end}
                  className={({ isActive }) =>
                    cn(
                      "flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                      isActive ? "border-primary bg-primary-soft text-primary" : "text-muted-foreground hover:text-foreground",
                    )
                  }
                >
                  <it.icon className="h-3.5 w-3.5" />
                  {it.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <Outlet context={who} />
        </main>
      </div>
    </div>
  );
}
