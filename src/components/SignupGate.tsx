import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BadgeCheck, Loader2, Mail } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStore } from "@/store/AppStore";
import { supabase } from "@/live/supabase";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Runs once the account exists: the download the person asked for, and the emailed copy. Resolves to true if the email went. */
  onCreated: () => Promise<boolean>;
}

/**
 * Where a guest becomes a member. The account they have been using all along gets an email and a password,
 * so their resume, matches and answers are already there. Nothing is copied or moved.
 */
export function SignupGate({ open, onOpenChange, onCreated }: Props) {
  const { state, update } = useStore();
  const nav = useNavigate();
  const [name, setName] = useState(state.profile.name);
  const [email, setEmail] = useState(state.profile.email);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [stage, setStage] = useState<"form" | "confirm" | "done">("form");
  const [emailed, setEmailed] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setError("");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("That email address does not look right.");
    if (password.length < 8) return setError("Use at least 8 characters for your password.");
    if (name.trim().length < 2) return setError("Please tell us your name.");
    setBusy(true);
    try {
      const { data, error: err } = await supabase.auth.updateUser({ email: email.trim(), password, data: { full_name: name.trim() } });
      if (err) {
        setError(/already|registered|exists/i.test(err.message) ? "That email already has an account. Log in to use it, or try a different email." : err.message);
        return;
      }
      update((s) => {
        s.profile.email = email.trim();
        s.profile.name = name.trim();
      });
      // With email confirmation off the account is real straight away. With it on, they confirm first.
      if (data.user?.is_anonymous || !data.user?.email_confirmed_at) {
        const fresh = (await supabase.auth.getUser()).data.user;
        if (fresh?.is_anonymous) {
          setStage("confirm");
          return;
        }
      }
      setEmailed(await onCreated());
      setStage("done");
    } catch (e) {
      setError((e as Error).message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => stage !== "form" || !busy ? onOpenChange(o) : undefined}>
      <DialogContent className="max-w-md">
        {stage === "form" && (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">Save your resume with a free account</DialogTitle>
              <DialogDescription>Your resume, matches and answers are already saved. Make your account and you can download it now, and we will email you a copy.</DialogDescription>
            </DialogHeader>
            <form onSubmit={submit} className="space-y-3.5">
              <div className="space-y-1.5">
                <Label htmlFor="sg-name">Your name</Label>
                <Input id="sg-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sg-email">Email</Label>
                <Input id="sg-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sg-pw">Password</Label>
                <Input id="sg-pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" placeholder="At least 8 characters" />
              </div>
              {error && (
                <p role="alert" className="rounded-lg border border-danger/30 bg-danger/5 p-2.5 text-sm">
                  {error}{" "}
                  {/already has an account/.test(error) && (
                    <Link to="/login" className="font-medium text-primary hover:underline">
                      Log in
                    </Link>
                  )}
                </p>
              )}
              <Button type="submit" size="lg" className="w-full" disabled={busy}>
                {busy && <Loader2 className="animate-spin" />} Create my free account and download
              </Button>
              <p className="text-center text-xs text-muted-foreground">Free plan: 3 tailored resumes and 3 cover letters a month. No card needed.</p>
            </form>
          </>
        )}

        {stage === "confirm" && (
          <div className="py-2 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
              <Mail className="h-6 w-6" />
            </div>
            <DialogTitle className="font-display text-2xl">Check your email</DialogTitle>
            <DialogDescription className="mt-2">
              We sent a link to <b>{email}</b>. Open it to finish making your account, then come back here and press Download again. Your resume is saved.
            </DialogDescription>
            <Button variant="outline" className="mt-5" onClick={() => onOpenChange(false)}>
              Back to my resume
            </Button>
          </div>
        )}

        {stage === "done" && (
          <div className="py-2 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success-soft text-success animate-pop">
              <BadgeCheck className="h-7 w-7" />
            </div>
            <DialogTitle className="font-display text-2xl">You are in. Your resume is downloading.</DialogTitle>
            <DialogDescription className="mt-2">
              {emailed ? `We also emailed a copy to ${email}.` : "We could not email a copy just now, but your resume is saved in your account and you can download it again any time."}
            </DialogDescription>
            <Button size="lg" className="mt-5" onClick={() => nav("/app")}>
              Go to my dashboard
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
