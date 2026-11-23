"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Bot } from "lucide-react";
import { BOT_PLAN_TIERS } from "@/lib/bots";
import styles from "@/app/landing.module.css";

export default function LandingPlanExplorer() {
  const [index, setIndex] = useState(0);
  const plan = BOT_PLAN_TIERS[index];
  const money = (value: number) => `$${value.toLocaleString("en-US")}`;
  return <div className={styles.planExplorer}>
    <div className={styles.planTabs} role="group" aria-label="Choose a trading bot plan">
      {BOT_PLAN_TIERS.map((tier, i) => <button type="button" key={tier.id} className={i === index ? styles.planTabActive : ""} onClick={() => setIndex(i)} aria-pressed={i === index}><span>{String(i + 1).padStart(2, "0")}</span>{tier.name}</button>)}
    </div>
    <div className={styles.planDetail} aria-live="polite"><div className={styles.planDetailTop}><span className={styles.cardIcon}><Bot size={23}/></span><span>BOT PLAN / {String(index + 1).padStart(2, "0")}</span></div><h3>{plan.name}</h3><p>Explore a {plan.strategy.toLowerCase()} strategy profile and review the plan details in your account.</p><div className={styles.planMetrics}><div><small>ALLOCATION RANGE</small><strong>{money(plan.min)} – {money(plan.max)}</strong></div><div><small>STRATEGY</small><strong>{plan.strategy}</strong></div><div><small>RISK LEVEL</small><strong>{plan.riskLevel}</strong></div></div><Link href="/dashboard" className={styles.textLink}>Explore plans in your dashboard <ArrowRight size={16}/></Link><p className={styles.planDisclaimer}>Plan availability and terms are shown in your account. Trading involves risk; returns are not guaranteed.</p></div>
  </div>;
}
