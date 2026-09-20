import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppStoreProvider } from "@/store/AppStore";
import { LiveProvider } from "@/live/LiveProvider";
import { AppShell } from "@/components/layout/AppShell";
import { useTheme } from "@/hooks/useTheme";
import Landing from "@/pages/public/Landing";
import Pricing from "@/pages/public/Pricing";
import { LoginPage, ResetPage, SignupPage } from "@/pages/public/Auth";
import Onboarding from "@/pages/onboarding/Onboarding";
import Dashboard from "@/pages/app/Dashboard";
import Matches from "@/pages/app/Matches";
import JobDetail from "@/pages/app/JobDetail";
import ResumeStudio from "@/pages/app/ResumeStudio";
import CoverLetter from "@/pages/app/CoverLetter";
import Tracker from "@/pages/app/Tracker";
import Receipt from "@/pages/app/Receipt";
import Connections from "@/pages/app/Connections";
import Copilot from "@/pages/app/Copilot";
import Roadmap from "@/pages/app/Roadmap";
import Translator from "@/pages/app/Translator";
import Interview from "@/pages/app/Interview";
import Billing from "@/pages/app/Billing";
import Settings from "@/pages/app/Settings";
import NotFound from "@/pages/app/NotFound";
import { LiveGate } from "@/components/LiveGate";
import { AddOnGate } from "@/components/AddOnGate";
import AdminShell from "@/pages/admin/AdminShell";
import AdminOverview from "@/pages/admin/Overview";
import AdminUsers from "@/pages/admin/Users";
import AdminJobs from "@/pages/admin/Jobs";
import AdminApplications from "@/pages/admin/Applications";
import AdminSystem from "@/pages/admin/System";
import AdminAuditLog from "@/pages/admin/AuditLog";

function ThemedToaster() {
  const { theme } = useTheme();
  return <Toaster theme={theme} position="bottom-center" richColors={false} closeButton toastOptions={{ className: "font-sans" }} />;
}

export default function App() {
  return (
    <AppStoreProvider>
      <LiveProvider>
      <TooltipProvider delayDuration={200}>
        <HashRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/reset" element={<ResetPage />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/app" element={<AppShell />}>
              <Route index element={<Dashboard />} />
              <Route path="matches" element={<Matches />} />
              <Route path="jobs/:id" element={<JobDetail />} />
              <Route path="resume" element={<ResumeStudio />} />
              <Route path="cover-letter" element={<CoverLetter />} />
              <Route path="tracker" element={<Tracker />} />
              <Route path="receipts/:id" element={<Receipt />} />
              <Route
                path="connections"
                element={
                  <AddOnGate
                    addOn="connections"
                    title="Insider Connections"
                    blurb="A referral beats a cold application. This finds the people already inside the companies you are targeting and writes you an honest note to send them."
                    points={[
                      "Your own contacts, matched to the companies in your tracker",
                      "A reason to reach out that is actually true, drawn from your shared history",
                      "A short first message you can edit, never sent without your say so",
                      "Follow up reminders so a warm lead does not go cold",
                    ]}
                  >
                    <LiveGate feature="Insider Connections" blurb="No public service lets us see anyone's network, so this will work from the contacts you upload yourself, matched to the companies you are targeting.">
                      <Connections />
                    </LiveGate>
                  </AddOnGate>
                }
              />
              <Route path="copilot" element={<Copilot />} />
              <Route path="check-in" element={<Navigate to="/app" replace />} />
              <Route path="roadmap" element={<Roadmap />} />
              <Route path="translator" element={<Translator />} />
              <Route path="interview" element={<Interview />} />
              <Route path="billing" element={<Billing />} />
              <Route path="settings" element={<Settings />} />
              <Route path="*" element={<NotFound />} />
            </Route>
            <Route path="/admin" element={<AdminShell />}>
              <Route index element={<AdminOverview />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="jobs" element={<AdminJobs />} />
              <Route path="applications" element={<AdminApplications />} />
              <Route path="system" element={<AdminSystem />} />
              <Route path="log" element={<AdminAuditLog />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </HashRouter>
        <ThemedToaster />
      </TooltipProvider>
      </LiveProvider>
    </AppStoreProvider>
  );
}
