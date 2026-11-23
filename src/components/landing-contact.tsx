"use client";
import { useState } from "react";
import { MessageCircle, Mail, ArrowUpRight } from "lucide-react";
import styles from "@/app/landing.module.css";

declare global { interface Window { smartsupp?: (...args: unknown[]) => void } }
export default function LandingContact({ email, chat }: { email: string | null; chat: boolean }) {
  const [error, setError] = useState(false);
  return <div className={styles.contactActions}>
    {email && <a className={styles.contactButton} href={`mailto:${email}`}><Mail size={18}/> Email support <ArrowUpRight size={15}/></a>}
    {chat && <button className={styles.contactButton} type="button" onClick={() => { if (window.smartsupp) { setError(false); window.smartsupp("chat:open"); } else setError(true); }}><MessageCircle size={18}/> Open live chat <ArrowUpRight size={15}/></button>}
    {error && <p role="alert">Chat is not available yet. Please try again shortly{email ? " or use email support" : ""}.</p>}
    {!email && !chat && <p>Support contact details are being set up. Please check back soon.</p>}
  </div>;
}
