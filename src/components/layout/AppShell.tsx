import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Bird,
  CalendarCheck2,
  CreditCard,
  FileText,
  Kanban,
  LogOut,
  Map as MapIcon,
  Maximize2,
  Menu,
  Moon,
  Search,
  Settings,
  ShieldCheck,
  Sun,
  Lock,
  MoreHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import { useStore, type AddOns } from "@/store/AppStore";
import { isPro } from "@/lib/selectors";
import { Logo, PersonAvatar, WrenAvatar } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";
import { Chat, newConversation } from "@/components/copilot/Chat";
import { COPILOT_NAME } from "@/data/copilot";
import { diffDays } from "@/lib/date";
import { useLive } from "@/live/LiveProvider";
import { useJobsVersion } from "@/hooks/useJobs";

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  pro?: boolean;
  /** Bought separately from any plan, so Pro does not unlock it. */
  addOn?: keyof AddOns;
  feature?: boolean;
}

const NAV: { heading?: string; items: NavItem[] }[] = [
  {
    items: [
      { to: "/app", label: "Dashboard", icon: CalendarCheck2 },
      { to: "/app/matches", label: "Matches", icon: Search },
      { to: "/app/tracker", label: "Tracker", icon: Kanban },
    ],
  },
  {
    heading: "Tools",
    items: [
      // Resume, cover letter, and the Career Translator all live here now.
      { to: "/app/studio", label: "Studio", icon: FileText },
      { to: "/app/roadmap", label: "Skill Gap Roadmap", icon: MapIcon },
      { to: "/app/copilot", label: `Copilot (${COPILOT_NAME})`, icon: Bird },
    ],
  },
];

const FOOT: NavItem[] = [
  { to: "/app/billing", label: "Account and billing", icon: CreditCard },
  { to: "/app/settings", label: "Settings", icon: Settings },
];

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const { state } = useStore();
  const { isAdmin } = useLive();
  const pro = isPro(state);
  // Staff only. The admin panel checks again on the server, so this link is
  // convenience, never the thing keeping anyone out.
  const foot = isAdmin ? [...FOOT, { to: "/admin", label: "Admin panel", icon: ShieldCheck }] : FOOT;
  return (
    <nav aria-label="Main" className="flex flex-1 flex-col gap-5">
      {NAV.map((g, gi) => (
        <div key={gi}>
          {g.heading && <div className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">{g.heading}</div>}
          <ul className="space-y-0.5">
            {g.items.map((it) => (
              <li key={it.to}>
                <NavLink
                  to={it.to}
                  end={it.to === "/app"}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive ? "bg-primary-soft text-primary" : "text-foreground/75 hover:bg-accent hover:text-foreground",
                      it.feature && !isActive && "text-foreground",
                    )
                  }
                >
                  <it.icon className="h-[18px] w-[18px] shrink-0" />
                  <span className="flex-1 truncate">{it.label}</span>
                  {it.feature && <Sparkles className="h-3.5 w-3.5 shrink-0 text-success" aria-label="Key feature" />}
                  {it.pro && !pro && <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-label="Pro feature" />}
                  {it.addOn && !state.billing.addOns?.[it.addOn] && <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-label="Paid add on" />}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div className="mt-auto border-t pt-4">
        <ul className="space-y-0.5">
          {foot.map((it) => (
            <li key={it.to}>
              <NavLink
                to={it.to}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn("flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors", isActive ? "bg-primary-soft text-primary" : "text-foreground/75 hover:bg-accent hover:text-foreground")
                }
              >
                <it.icon className="h-[18px] w-[18px]" />
                {it.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}

function TrialChip() {
  const { state } = useStore();
  const b = state.billing;
  if (b.tier === "trial" && b.trialEndsAt) {
    const left = -diffDays(b.trialEndsAt);
    return (
      <Link to="/app/billing" className="hidden rounded-full border border-primary/25 bg-primary-soft px-3 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/15 md:inline-flex">
        Pro trial · {left} day{left === 1 ? "" : "s"} left
      </Link>
    );
  }
  if (b.tier === "free") {
    return (
      <Link to="/app/billing" className="hidden rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground md:inline-flex">
        Free plan
      </Link>
    );
  }
  return (
    <Link to="/app/billing" className="hidden rounded-full border border-success-border bg-success-soft px-3 py-1 text-xs font-medium text-success md:inline-flex">
      Pro
    </Link>
  );
}

const MOBILE_TABS = [
  { to: "/app", label: "Today", icon: CalendarCheck2 },
  { to: "/app/matches", label: "Matches", icon: Search },
  { to: "/app/tracker", label: "Tracker", icon: Kanban },
  { to: "/app/studio", label: "Studio", icon: FileText },
];

export function AppShell() {
  const { state, update } = useStore();
  const { signOut } = useLive();
  const jobsVersion = useJobsVersion();
  const { theme, toggle } = useTheme();
  const nav = useNavigate();
  const loc = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const onCopilotPage = loc.pathname.startsWith("/app/copilot");

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [loc.pathname]);

  useEffect(() => {
    if (!state.authed) nav("/login", { replace: true });
    else if (!state.onboarded) nav("/onboarding", { replace: true });
  }, [state.authed, state.onboarded, nav]);

  // Real accounts start with one empty conversation so Wren is ready to talk.
  useEffect(() => {
    if (state.mode === "live" && state.authed && state.chats.length === 0) update((s) => void s.chats.unshift(newConversation()));
  }, [state.mode, state.authed, state.chats.length, update]);

  const panelConvoId = useMemo(() => state.chats[0]?.id, [state.chats]);

  const logout = async () => {
    if (state.mode === "live") await signOut();
    else update((s) => void ((s.authed = false), (s.mode = "none")));
    nav("/");
  };

  return (
    <div className="min-h-screen bg-canvas">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground">
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r bg-background px-3 py-4 lg:flex">
        <div className="mb-6 px-2">
          <Logo to="/app" />
        </div>
        <NavList />
      </aside>

      {/* Mobile nav sheet */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="flex w-72 flex-col overflow-y-auto p-4">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="mb-5 px-2">
            <Logo to="/app" />
          </div>
          <NavList onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur sm:px-5">
          <Button variant="ghost" size="icon-sm" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
            <Menu />
          </Button>
          <div className="lg:hidden">
            <Logo to="/app" compact />
          </div>
          <div className="flex-1" />
          <TrialChip />
          <Button variant="ghost" size="icon-sm" onClick={toggle} aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
            {theme === "dark" ? <Sun /> : <Moon />}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="rounded-full transition-opacity hover:opacity-85" aria-label="Account menu">
                <PersonAvatar name={state.profile.name} hue={214} size={32} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="text-sm">{state.profile.name}</div>
                <div className="text-xs font-normal text-muted-foreground">{state.profile.email}</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => nav("/app/billing")}>
                <CreditCard className="mr-2 h-4 w-4" /> Account and billing
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => nav("/app/settings")}>
                <Settings className="mr-2 h-4 w-4" /> Settings
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={toggle}>
                {theme === "dark" ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />} {theme === "dark" ? "Light mode" : "Dark mode"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={logout}>
                <LogOut className="mr-2 h-4 w-4" /> Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main id="main" className="mx-auto w-full max-w-[1200px] px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-16 lg:pt-8">
          <div key={`${loc.pathname}:${jobsVersion}`} className="page-enter">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile bottom tabs */}
      <nav aria-label="Quick" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {MOBILE_TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.to === "/app"}
            className={({ isActive }) => cn("flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors", isActive ? "text-primary" : "text-muted-foreground hover:text-foreground")}
          >
            <t.icon className="h-5 w-5" />
            {t.label}
          </NavLink>
        ))}
        <button onClick={() => setMobileOpen(true)} className="flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-muted-foreground hover:text-foreground">
          <MoreHorizontal className="h-5 w-5" />
          More
        </button>
      </nav>

      {/* Copilot floating button and panel */}
      {!onCopilotPage && (
        <button
          onClick={() => setCopilotOpen(true)}
          className="fixed bottom-20 right-3 z-30 flex items-center gap-2 rounded-full border bg-background p-1.5 shadow-lift transition-all hover:-translate-y-0.5 hover:border-primary/40 sm:pr-4 lg:bottom-6 lg:right-6"
          aria-label={`Open ${COPILOT_NAME}, your career copilot`}
        >
          <WrenAvatar size={38} />
          <span className="hidden text-sm font-semibold sm:inline">Ask {COPILOT_NAME}</span>
        </button>
      )}
      <Sheet open={copilotOpen} onOpenChange={setCopilotOpen}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-[440px] [&>button]:hidden">
          <div className="flex items-center gap-3 border-b px-4 py-3">
            <WrenAvatar size={34} />
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-sm font-semibold">{COPILOT_NAME}, your career copilot</SheetTitle>
              <p className="truncate text-xs text-muted-foreground">{state.chats[0]?.title}</p>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Open full screen"
              onClick={() => {
                setCopilotOpen(false);
                nav(`/app/copilot?c=${panelConvoId}`);
              }}
            >
              <Maximize2 />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Close copilot" onClick={() => setCopilotOpen(false)}>
              <X />
            </Button>
          </div>
          <div className="min-h-0 flex-1">
            {panelConvoId && (
              <Chat
                conversationId={panelConvoId}
                compact
                onNew={() =>
                  update((s) => {
                    s.chats.unshift(newConversation());
                  })
                }
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
