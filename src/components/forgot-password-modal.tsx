"use client";
import DdcmMark from "@/components/ddcm-mark";
import { useState } from "react";
import { ArrowRight, LockKeyhole, X } from "lucide-react";
import { useLanguage } from "@/components/i18n-provider";

type Props = { onClose: () => void; onSwitchToLogin: () => void };
export default function ForgotPasswordModal({ onClose, onSwitchToLogin }: Props) {
  const { t } = useLanguage();
  const [identifier, setIdentifier] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError(""); setBusy(true);
    try {
      const res = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "requestPasswordReset", identifier: identifier.trim() }) });
      if (!res.ok) { const result = await res.json().catch(() => ({})); throw new Error(result.error || "Unable to process your request. Please try again later."); }
      setSent(true);
    } catch (err) { setError(err instanceof Error ? err.message : "Please try again later."); }
    finally { setBusy(false); }
  }
  return <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="auth-modal ddcm-forgot-modal" role="dialog" aria-modal="true" aria-labelledby="forgot-title">
      <button className="modal-close" onClick={onClose} aria-label={t("Close")}><X size={20}/></button>
      <div className="modal-brand"><div className="brand-icon"><DdcmMark size={22}/></div><span className="ddcm-wordmark">DDCM</span></div>
      {sent ? <><h2 id="forgot-title">Check your email</h2><p>If an eligible account matches, a reset link will be sent to its email address. Check your spam folder too. The link expires in 30 minutes. Please wait a minute before requesting another link.</p><button className="primary-btn full-btn" onClick={onSwitchToLogin}>Back to sign in <ArrowRight size={17}/></button><div className="modal-switch"><button onClick={() => setSent(false)}>Try another address or request again</button></div></> : <><h2 id="forgot-title">Forgot your password?</h2><p>Enter your email or username and we’ll send a reset link to the email on your account.</p><form onSubmit={submit}><label className="input-label" htmlFor="reset-identifier">Email or username</label><input id="reset-identifier" className="text-input" autoComplete="username" placeholder="you@example.com or username" value={identifier} onChange={e => setIdentifier(e.target.value)} required maxLength={254}/>{error && <p className="form-error-text" role="alert">{error}</p>}<button className="primary-btn full-btn" disabled={busy}>{busy ? "Sending…" : "Send reset link"}<ArrowRight size={17}/></button></form><div className="modal-switch"><button onClick={onSwitchToLogin}>Back to sign in</button></div></>}
      <div className="modal-security"><LockKeyhole size={14}/> Your account is secured with encrypted credentials</div>
    </div>
  </div>;
}
