"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Check, Eye, EyeOff, LockKeyhole } from "lucide-react";
import AuthShowcase from "@/components/auth-showcase";

function ResetPasswordForm() {
  const params = useSearchParams();
  const [token, setToken] = useState(() => params.get("token") ?? "");
  const [tokenDraft, setTokenDraft] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  useEffect(() => { if (token) window.history.replaceState(window.history.state, "", "/reset-password"); }, [token]);

  function continueWithToken(e: React.FormEvent) {
    e.preventDefault(); setError("");
    const value = tokenDraft.trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(value)) return setError("Enter the 64-character reset token from your email.");
    setToken(value);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError("");
    if (!token) return setError("This link is missing its token. Request a new link.");
    if (newPassword.length < 8 || newPassword.length > 256) return setError("Use between 8 and 256 characters.");
    if (newPassword !== confirmPassword) return setError("Passwords do not match.");
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "resetPasswordWithToken", token, newPassword }) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "This reset link is invalid or has expired.");
      setNewPassword(""); setConfirmPassword(""); setDone(true);
    } catch (err) { setError(err instanceof Error ? err.message : "Something went wrong. Please try again."); }
    finally { setSubmitting(false); }
  }
  return <main className="ddcm-auth-page"><div className="ddcm-auth-shell"><AuthShowcase mode="reset"/>
    <section className="ddcm-auth-content" aria-labelledby="reset-title"><div className="ddcm-auth-form-wrap">
      <div className="ddcm-auth-heading"><span className="ddcm-auth-kicker">ACCOUNT SECURITY</span><h2 id="reset-title">{done ? "Password updated" : "Reset your password"}</h2><p>{done ? "Your password has been changed. Sign in using your new password." : token ? "Choose a strong new password to secure your account." : "Paste the reset token from your email, or request a new link from the sign-in page."}</p></div>
      {!done && !token && <form onSubmit={continueWithToken}>
        <label className="input-label" htmlFor="reset-token">Reset token</label>
        <input id="reset-token" className="text-input" type="text" autoComplete="off" spellCheck={false} placeholder="Paste your 64-character token" value={tokenDraft} onChange={e => setTokenDraft(e.target.value.replace(/[^a-fA-F0-9]/g, "").slice(0, 64))} required maxLength={64}/>
        {error && <p className="form-error-text" role="alert">{error}</p>}
        <button className="primary-btn full-btn ddcm-auth-submit" disabled={tokenDraft.length !== 64}>Continue<ArrowRight size={16}/></button>
      </form>}
      {!done && token && <form onSubmit={submit}>
        <label className="input-label" htmlFor="reset-new-password">New password</label>
        <div className="ddcm-password"><input id="reset-new-password" className="text-input" type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder="At least 8 characters" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={8} maxLength={256}/><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(v => !v)}>{showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}</button></div>
        <label className="input-label" htmlFor="reset-confirm-password">Confirm new password</label>
        <input id="reset-confirm-password" className="text-input" type="password" autoComplete="new-password" placeholder="Re-enter your password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required minLength={8} maxLength={256}/>
        <p className="ddcm-password-hint">Use at least 8 characters. Your existing sessions will be signed out.</p>
        {error && <p className="form-error-text" role="alert">{error}</p>}
        <button className="primary-btn full-btn ddcm-auth-submit" disabled={submitting}>{submitting ? "Updating…" : "Update password"}<ArrowRight size={16}/></button>
      </form>}
      {(done || !token) && <Link className="primary-btn full-btn ddcm-auth-submit ddcm-auth-link" href="/sign-in">{done ? <><Check size={16}/> Go to sign in</> : <>Back to sign in <ArrowRight size={16}/></>}</Link>}
      {!done && <div className="ddcm-auth-switch"><Link href="/sign-in">Back to sign in</Link> · Need a new link? Select “Forgot password” on sign in.</div>}
      <div className="ddcm-auth-security"><LockKeyhole size={14}/> Your credentials are protected</div>
    </div></section></div></main>;
}
export default function ResetPasswordPage() { return <Suspense fallback={null}><ResetPasswordForm/></Suspense>; }
