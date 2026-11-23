"use client";
import DdcmMark from "@/components/ddcm-mark";
import { ArrowUpRight } from "lucide-react";

export default function AuthShowcase({ mode }: { mode: "sign-in" | "sign-up" | "reset" }) {
  const signup = mode === "sign-up";
  const reset = mode === "reset";
  return <aside className="auth-showcase" aria-label="Denary Drill Capital Markets">
    <div className="auth-showcase-brand"><span className="auth-showcase-mark"><DdcmMark size={22}/></span><div><strong>DDCM</strong></div><ArrowUpRight size={16}/></div>
    <div className="auth-showcase-content">
      <span className="auth-showcase-eyebrow">A CLEARER WAY FORWARD</span>
      <div className="auth-showcase-intro"><h1>{reset ? <>A fresh<br/>start.</> : signup ? <>Get started<br/>with us.</> : <>Welcome<br/>back.</>}</h1><p>{reset ? "Create a new password and get back to your account securely." : signup ? "A few simple steps to get your account ready." : "Pick up where you left off and stay connected to your account."}</p></div>
      <div className="auth-showcase-steps" aria-label="Account journey">
        <div className="auth-showcase-step active"><span>01</span><strong>{reset ? "Open your reset link" : signup ? "Create your account" : "Sign in securely"}</strong></div>
        <div className="auth-showcase-step"><span>02</span><strong>{reset ? "Choose a new password" : "Verify your email"}</strong></div>
        <div className="auth-showcase-step"><span>03</span><strong>{reset ? "Sign in securely" : "Explore your dashboard"}</strong></div>
      </div>
    </div>
    <p className="auth-showcase-foot">DENARY DRILL CAPITAL MARKETS · DDCM</p>
  </aside>;
}
