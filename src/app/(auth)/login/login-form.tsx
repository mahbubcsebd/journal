"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, Loader2, Mail } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { OtpInput } from "@/components/ui/otp-input";
import { authClient } from "@/lib/auth-client";
import { safeNext } from "@/lib/safe-next";

const RESEND_SECONDS = 30;


export function LoginForm() {
  const params = useSearchParams();
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    const value = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setError("Enter a valid email address");
      return;
    }
    setLoading(true);
    const { error } = await authClient.emailOtp.sendVerificationOtp({ email: value, type: "sign-in" });
    setLoading(false);
    if (error) {
      setError(error.status === 429 ? "Too many requests. Please wait a minute." : (error.message ?? "Could not send code"));
      return;
    }
    setEmail(value);
    setOtp("");
    setStep("otp");
    setCooldown(RESEND_SECONDS);
  }

  async function verify(code = otp) {
    if (code.length !== 6 || loading) return;
    setLoading(true);
    setError(null);
    const { error } = await authClient.signIn.emailOtp({ email, otp: code });
    if (error) {
      setLoading(false);
      setOtp("");
      setError(
        error.code === "OTP_EXPIRED"
          ? "This code has expired. Request a new one."
          : error.code === "TOO_MANY_ATTEMPTS"
            ? "Too many attempts. Request a new code."
            : "That code is not correct. Try again.",
      );
      return;
    }
    // Full page load: start the new session with no client cache or page state
    // left over from a previous user in this browser.
    window.location.replace(safeNext(params.get("next")));
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      {step === "email" ? (
        <motion.form
          key="email"
          onSubmit={sendCode}
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="grid gap-6"
        >
          <div className="grid gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
            <p className="text-sm text-muted-foreground">
              Sign in or create your account with your email. New here? An account is created automatically.
            </p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                autoComplete="email"
                autoFocus
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={Boolean(error)}
                className="h-11 pl-9"
              />
            </div>
            {error && <p className="text-xs text-loss">{error}</p>}
          </div>
          <Button type="submit" size="lg" disabled={loading} className="w-full">
            {loading ? <Loader2 className="animate-spin" /> : null}
            Continue with email
            {!loading && <ArrowRight />}
          </Button>
        </motion.form>
      ) : (
        <motion.div
          key="otp"
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 16 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="grid gap-6"
        >
          <button
            type="button"
            onClick={() => {
              setStep("email");
              setError(null);
            }}
            className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Change email
          </button>
          <div className="grid gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Check your inbox</h1>
            <p className="text-sm text-muted-foreground">
              We sent a 6-digit code to <span className="font-medium text-foreground">{email}</span>
            </p>
          </div>
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              verify();
            }}
          >
            <OtpInput value={otp} onChange={setOtp} onComplete={verify} disabled={loading} invalid={Boolean(error)} />
            {error && <p className="text-xs text-loss">{error}</p>}
            <Button type="submit" size="lg" disabled={loading || otp.length !== 6} className="w-full">
              {loading && <Loader2 className="animate-spin" />}
              Verify &amp; sign in
            </Button>
          </form>
          <p className="text-sm text-muted-foreground">
            Didn&apos;t get it?{" "}
            {cooldown > 0 ? (
              <span className="tabular">Resend in {cooldown}s</span>
            ) : (
              <button type="button" onClick={() => sendCode()} className="font-medium text-foreground underline-offset-4 hover:underline">
                Resend code
              </button>
            )}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
