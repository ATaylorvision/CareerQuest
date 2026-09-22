import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowRight, BadgeCheck, Eye, EyeOff, Languages, Loader2, MailCheck, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { PlainPolicyDialog } from "@/components/layout/MarketingLayout";
import { useStore } from "@/store/AppStore";
import { useDocTitle } from "@/hooks/useDocTitle";
import { daysFromNow, fmtLongDate } from "@/lib/date";
import { ALLOW_DEMO, LIVE_AVAILABLE, supabase } from "@/live/supabase";

function friendly(msg: string) {
  const m = msg.toLowerCase();
  if (m.includes("invalid login")) return "That email and password do not match. Check them and try again.";
  if (m.includes("already registered") || m.includes("already been registered")) return "That email already has an account. Try logging in instead.";
  if (m.includes("is invalid") || m.includes("email_address_invalid")) return "That email address was not accepted. Check it for typos, or try a different one.";
  if (m.includes("weak") || m.includes("pwned") || m.includes("easy to guess")) return "That password is too easy to guess. Try a longer one with a mix of words and numbers.";
  if (m.includes("email not confirmed")) return "Please confirm your email first. We sent you a link when you signed up.";
  // The mailer has its own limit, and it resets by the hour rather than the
  // minute, so telling someone to wait a minute would simply be untrue.
  if (m.includes("email rate limit") || m.includes("over_email_send_rate_limit") || m.includes("email send rate"))
    return "We could not send your confirmation email just now, because our email service hit its sending limit. This one is on us, not you. Please try again later.";
  if (m.includes("rate limit") || m.includes("too many")) return "Too many tries in a short time. Please wait a minute and try again.";
  if (m.includes("password") && m.includes("characters")) return "Use at least 8 characters for your password.";
  if (m.includes("network") || m.includes("fetch")) return "We could not reach the server. Check your connection and try again.";
  return "Something went wrong. Please try again.";
}

function AuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 min-h-screen lg:grid-cols-2">
      <div className="flex flex-col px-5 py-6 sm:px-10">
        <Logo />
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm page-enter">{children}</div>
        </div>
        <p className="text-xs text-muted-foreground">{LIVE_AVAILABLE ? "Your resume and account are stored privately. Only you can see them." : "Prototype. No real accounts are created and nothing leaves your browser."}</p>
      </div>
      <div className="relative hidden overflow-hidden border-l bg-canvas lg:flex lg:items-center lg:justify-center">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,hsl(var(--success)/0.08),transparent_60%),radial-gradient(ellipse_at_top_right,hsl(var(--primary)/0.1),transparent_55%)]" aria-hidden />
        <div className="relative max-w-md space-y-5 px-10">
          <h2 className="font-display text-3xl font-semibold leading-tight">A calmer way to find what is next.</h2>
          {[
            { icon: Languages, t: "Your history, translated", d: "See how your past work reads in the field you want." },
            { icon: ShieldCheck, t: "Only real jobs", d: "Every listing gets a legitimacy score you can check." },
            { icon: BadgeCheck, t: "Proof, not promises", d: "A receipt for every application you send." },
          ].map((x) => (
            <div key={x.t} className="flex gap-3 rounded-xl border bg-background/80 p-4 shadow-card">
              <x.icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <div className="font-medium">{x.t}</div>
                <div className="text-sm text-muted-foreground">{x.d}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PasswordInput({ id, value, onChange, autoComplete }: { id: string; value: string; onChange: (v: string) => void; autoComplete: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input id={id} type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} className="pr-10" />
      <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-2 text-muted-foreground hover:text-foreground" aria-label={show ? "Hide password" : "Show password"}>
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

export function LoginPage() {
  useDocTitle("Log in");
  const nav = useNavigate();
  const { state, update } = useStore();
  const [email, setEmail] = useState(LIVE_AVAILABLE ? "" : "renee.castillo@example.com");
  const [pw, setPw] = useState(LIVE_AVAILABLE ? "" : "demo-password");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [resetSent, setResetSent] = useState(false);

  // Once the account has loaded, go to the right place.
  useEffect(() => {
    if (state.mode === "live" && state.authed) nav(state.onboarded ? "/app" : "/onboarding", { replace: true });
  }, [state.mode, state.authed, state.onboarded, nav]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) return setErr("That email does not look quite right.");
    if (pw.length < 6) return setErr("Passwords are at least 6 characters.");
    setErr("");
    setBusy(true);
    if (!LIVE_AVAILABLE || !supabase) {
      update((s) => {
        s.mode = "demo";
        s.authed = true;
        s.onboarded = true;
      });
      toast.success("Welcome back, Renee.");
      nav("/app");
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pw });
    if (error) {
      setBusy(false);
      setErr(friendly(error.message));
    }
    // On success the account loads in the background and the effect above redirects.
  };

  const forgot = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email)) return setErr("Type your email above first, then press Forgot it.");
    setErr("");
    if (!supabase) return toast("Password reset", { description: "Not available in the demo." });
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/?reset=1` });
    if (error) return setErr(friendly(error.message));
    setResetSent(true);
  };

  return (
    <AuthFrame>
      <h1 className="font-display text-3xl font-semibold">Welcome back</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">Log in to pick up where you left off.</p>
      <form onSubmit={submit} className="mt-7 space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="pw">Password</Label>
            <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={forgot}>
              Forgot it?
            </button>
          </div>
          <PasswordInput id="pw" value={pw} onChange={setPw} autoComplete="current-password" />
        </div>
        {err && <p className="text-sm text-danger" role="alert">{err}</p>}
        {resetSent && <p className="rounded-lg border border-success-border bg-success-soft p-3 text-sm text-success" role="status">If that email has an account, a reset link is on its way. Check your inbox.</p>}
        <Button type="submit" className="w-full" size="lg" disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : null}
          {busy ? "Logging in" : "Log in"}
        </Button>
      </form>
      {!LIVE_AVAILABLE && (
        <div className="mt-4 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
          The database is not connected in this copy, so this opens the sample account for Renee Castillo, a fictional user.
        </div>
      )}
      <p className="mt-6 text-center text-sm text-muted-foreground">
        New here?{" "}
        <Link to="/signup" className="font-medium text-primary hover:underline">
          Create a free account
        </Link>
      </p>
      {ALLOW_DEMO && (
      <p className="mt-2 text-center text-sm text-muted-foreground">
        Just looking?{" "}
        <button
          className="font-medium text-primary hover:underline"
          onClick={() => {
            update((s) => {
              s.mode = "demo";
              s.authed = true;
              s.onboarded = true;
            });
            nav("/app");
          }}
        >
          Open the sample account
        </button>
      </p>
      )}
    </AuthFrame>
  );
}

export function SignupPage() {
  useDocTitle("Create your account");
  const nav = useNavigate();
  const [params] = useSearchParams();
  const wantsPro = params.get("plan") === "pro";
  const { state, update, reset } = useStore();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [policy, setPolicy] = useState<null | "privacy" | "terms">(null);
  const [checkEmail, setCheckEmail] = useState(false);

  useEffect(() => {
    if (state.mode === "live" && state.authed) nav(state.onboarded ? "/app" : "/onboarding", { replace: true });
  }, [state.mode, state.authed, state.onboarded, nav]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (name.trim().length < 2) next.name = "Add your name so we know what to call you.";
    if (!/^\S+@\S+\.\S+$/.test(email)) next.email = "That email does not look quite right.";
    if (pw.length < 8) next.pw = "Use at least 8 characters.";
    if (!agree) next.agree = "Please confirm you have read the plain English terms.";
    setErrs(next);
    if (Object.keys(next).length) return;
    setBusy(true);

    if (!LIVE_AVAILABLE || !supabase) {
      reset();
      update((s) => {
        s.mode = "demo";
        s.authed = true;
        s.onboarded = false;
        s.billing = wantsPro
          ? { ...s.billing, tier: "trial", cycle: "monthly", trialStartedAt: new Date().toISOString(), trialEndsAt: daysFromNow(7), renewsAt: daysFromNow(7), cancelledAt: null }
          : { ...s.billing, tier: "free", cycle: "monthly", trialStartedAt: null, trialEndsAt: null, renewsAt: null, cancelledAt: null };
      });
      nav("/onboarding");
      return;
    }

    try {
      localStorage.setItem("cq-wants-pro", wantsPro ? "1" : "");
    } catch {
      /* ignore */
    }
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password: pw,
      options: { data: { full_name: name.trim() }, emailRedirectTo: `${window.location.origin}/` },
    });
    if (error) {
      setBusy(false);
      return setErrs({ form: friendly(error.message) });
    }
    // Supabase hides whether an email is already taken by returning a user with no identities.
    if (data.user && data.user.identities?.length === 0) {
      setBusy(false);
      return setErrs({ form: friendly("already registered") });
    }
    if (!data.session) {
      setBusy(false);
      setCheckEmail(true);
    }
    // With a session, the account loads and the effect above sends them to setup.
  };

  if (checkEmail) {
    return (
      <AuthFrame>
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success-soft text-success">
          <MailCheck className="h-6 w-6" />
        </div>
        <h1 className="font-display text-3xl font-semibold">Check your email</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          We sent a confirmation link to <b className="text-foreground">{email}</b>. Open it and you will land right back here, ready to set up.
        </p>
        <p className="mt-4 text-xs text-muted-foreground">Nothing there after a minute? Check spam, or try signing up again.</p>
        <Button variant="outline" className="mt-6" onClick={() => setCheckEmail(false)}>
          Use a different email
        </Button>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame>
      <h1 className="font-display text-3xl font-semibold">Create your account</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        {wantsPro ? <>You will start a 7 day Pro trial after setup. No charge before it ends, and you can cancel in one click.</> : "Free forever. No card needed."}
      </p>
      <form onSubmit={submit} className="mt-7 space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="name">Your name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" aria-invalid={!!errs.name} aria-describedby={errs.name ? "name-err" : undefined} />
          {errs.name && <p id="name-err" className="text-xs text-danger">{errs.name}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="su-email">Email</Label>
          <Input id="su-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" aria-invalid={!!errs.email} aria-describedby={errs.email ? "email-err" : undefined} />
          {errs.email && <p id="email-err" className="text-xs text-danger">{errs.email}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="su-pw">Password</Label>
          <PasswordInput id="su-pw" value={pw} onChange={setPw} autoComplete="new-password" />
          {errs.pw ? <p className="text-xs text-danger">{errs.pw}</p> : <p className="text-xs text-muted-foreground">At least 8 characters.</p>}
        </div>
        <div className="flex items-start gap-2.5">
          <Checkbox id="agree" checked={agree} onCheckedChange={(v) => setAgree(!!v)} className="mt-0.5" />
          <Label htmlFor="agree" className="text-sm font-normal leading-snug text-muted-foreground">
            I have read the{" "}
            <button type="button" className="font-medium text-primary hover:underline" onClick={() => setPolicy("terms")}>
              terms
            </button>{" "}
            and{" "}
            <button type="button" className="font-medium text-primary hover:underline" onClick={() => setPolicy("privacy")}>
              privacy summary
            </button>
            . Both fit on one screen.
          </Label>
        </div>
        {errs.agree && <p className="text-xs text-danger">{errs.agree}</p>}
        {errs.form && <p className="text-sm text-danger" role="alert">{errs.form}</p>}
        <Button type="submit" className="w-full" size="lg" disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : null}
          {busy ? "Setting things up" : "Create account"} {!busy && <ArrowRight />}
        </Button>
      </form>
      {!LIVE_AVAILABLE && (
        <div className="mt-4 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
          The database is not connected in this copy, so after setup you will see the sample account for Renee Castillo, a fictional user.
        </div>
      )}
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link to="/login" className="font-medium text-primary hover:underline">
          Log in
        </Link>
      </p>
      <PlainPolicyDialog open={!!policy} onOpenChange={(o) => !o && setPolicy(null)} kind={policy ?? "terms"} />
    </AuthFrame>
  );
}

export function ResetPage() {
  useDocTitle("Choose a new password");
  const nav = useNavigate();
  const { state } = useStore();
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const ready = state.mode === "live" && state.authed;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 8) return setErr("Use at least 8 characters.");
    if (!supabase) return;
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setErr(friendly(error.message));
    toast.success("Password updated");
    nav("/app");
  };

  return (
    <AuthFrame>
      <h1 className="font-display text-3xl font-semibold">Choose a new password</h1>
      {!ready ? (
        <p className="mt-3 text-sm text-muted-foreground">
          This link has expired or was already used. <Link to="/login" className="font-medium text-primary hover:underline">Go back to log in</Link> and press Forgot it to get a new one.
        </p>
      ) : (
        <form onSubmit={submit} className="mt-7 space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="np">New password</Label>
            <PasswordInput id="np" value={pw} onChange={setPw} autoComplete="new-password" />
            <p className="text-xs text-muted-foreground">At least 8 characters.</p>
          </div>
          {err && <p className="text-sm text-danger" role="alert">{err}</p>}
          <Button type="submit" className="w-full" size="lg" disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : null} Save password
          </Button>
        </form>
      )}
    </AuthFrame>
  );
}
