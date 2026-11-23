"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Eye, EyeOff, LockKeyhole } from "lucide-react";
import RegisterModal from "@/components/register-modal";
import ForgotPasswordModal from "@/components/forgot-password-modal";
import AuthShowcase from "@/components/auth-showcase";
import { ConfirmProvider } from "@/components/confirm-provider";

export default function AuthPage({ mode }: { mode: "sign-in" | "sign-up" }) {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  if (mode === "sign-up") return <RegisterModal standalone onClose={() => router.push("/sign-in")} onSwitchToLogin={() => router.push("/sign-in")} onRegistered={() => router.replace("/dashboard")} />;
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(""); setBusy(true);
    try {
      const response = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "login", identifier, password }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to sign in.");
      router.replace("/dashboard");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to sign in."); }
    finally { setBusy(false); }
  };
  return <ConfirmProvider><main className="ddcm-auth-page">
    <div className="ddcm-auth-shell">
      <AuthShowcase mode="sign-in"/>
      <section className="ddcm-auth-content" aria-labelledby="signin-title">
        <div className="ddcm-auth-form-wrap">
          <Link href="/" className="ddcm-back-home"><ArrowLeft size={15}/> Back to homepage</Link>
          <div className="ddcm-auth-mobile-brand">DDCM <span>DENARY DRILL CAPITAL MARKETS</span></div>
          <div className="ddcm-auth-heading"><span className="ddcm-auth-kicker">YOUR ACCOUNT</span><h2 id="signin-title">Welcome back</h2><p>Sign in to continue to your account.</p></div>
          <form onSubmit={submit}>
            <label className="input-label" htmlFor="signin-identifier">Email or username</label>
            <input id="signin-identifier" className="text-input" autoComplete="username" placeholder="you@example.com or username" value={identifier} onChange={e=>setIdentifier(e.target.value)} required/>
            <div className="ddcm-auth-label-row"><label className="input-label" htmlFor="signin-password">Password</label><button type="button" onClick={()=>setForgotOpen(true)}>Forgot password?</button></div>
            <div className="ddcm-password"><input id="signin-password" className="text-input" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Enter your password" value={password} onChange={e=>setPassword(e.target.value)} required/><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(v => !v)}>{showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}</button></div>
            {error && <p className="form-error-text" role="alert">{error}</p>}
            <button className="primary-btn full-btn ddcm-auth-submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}<ArrowRight size={16}/></button>
          </form>
          <div className="ddcm-auth-switch">New to DDCM? <Link href="/sign-up">Create an account</Link></div>
          <div className="ddcm-auth-security"><LockKeyhole size={14}/> Your credentials are protected</div>
        </div>
      </section>
    </div>
    {forgotOpen && <ForgotPasswordModal onClose={()=>setForgotOpen(false)} onSwitchToLogin={()=>setForgotOpen(false)}/>}
  </main></ConfirmProvider>;
}
