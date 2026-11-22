"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Activity, ArrowRight, LockKeyhole } from "lucide-react";
import RegisterModal from "@/components/register-modal";
import ForgotPasswordModal from "@/components/forgot-password-modal";
import { ConfirmProvider } from "@/components/confirm-provider";

export default function AuthPage({ mode }: { mode: "sign-in" | "sign-up" }) {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  if (mode === "sign-up") return <RegisterModal onClose={() => router.push("/sign-in")} onSwitchToLogin={() => router.push("/sign-in")} onRegistered={() => router.replace("/")} />;
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(""); setBusy(true);
    try {
      const response = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "login", identifier, password }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to sign in.");
      router.replace("/");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to sign in."); }
    finally { setBusy(false); }
  };
  return <ConfirmProvider><main className="auth-page"><section className="auth-modal auth-page-card"><div className="modal-brand"><div className="brand-icon"><Activity size={23} strokeWidth={3}/></div>Tetra<span>Trades</span></div><h2>Welcome back</h2><p>Sign in to continue to your account.</p><form onSubmit={submit}><label className="input-label">Email or username</label><input className="text-input" autoComplete="username" placeholder="you@example.com or username" value={identifier} onChange={e=>setIdentifier(e.target.value)} required/><label className="input-label">Password</label><input className="text-input" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required/><div className="modal-forgot"><button type="button" onClick={()=>setForgotOpen(true)}>Forgot password?</button></div>{error && <p className="form-error-text">{error}</p>}<button className="primary-btn full-btn" disabled={busy}>{busy ? "Signing in…" : "Sign in"}<ArrowRight size={17}/></button></form><div className="modal-switch">New here? <Link href="/sign-up">Create an account</Link></div><div className="modal-security"><LockKeyhole size={14}/> Your account is secured with encrypted credentials</div></section>{forgotOpen && <ForgotPasswordModal onClose={()=>setForgotOpen(false)} onSwitchToLogin={()=>setForgotOpen(false)}/>}</main></ConfirmProvider>;
}
