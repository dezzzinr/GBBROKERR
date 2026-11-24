"use client";
import { LocalizedText } from "@/components/i18n-provider";
import { MoreHorizontal } from "lucide-react";

type StatisticsUser = { signalStrength: number; targetProgressPercent: number; targetBalance: number; profitBalance: number };
export function StatisticsGauges({ user, money, hideBalance = false, onlySignal = false }: { user: StatisticsUser; money: (value: number) => string; hideBalance?: boolean; onlySignal?: boolean }) {
  return (
        <section className="panel statistics-panel" aria-label="Statistics">
          <div className="section-head"><h2><LocalizedText text="Statistics"/></h2></div>
          <div className={`dashboard-gauges${onlySignal ? " signal-only" : ""}`}>
          {[
            { label: "Signal strength", value: Math.max(0, Math.min(100, user.signalStrength)), display: `${Math.round(user.signalStrength)}%` },
            { label: "Trade progress", value: Math.max(0, Math.min(100, user.targetProgressPercent)), display: `${Math.round(user.targetProgressPercent)}%` },
            { label: "Target amount", value: user.targetBalance > 0 ? Math.max(0, Math.min(100, user.profitBalance / user.targetBalance * 100)) : 0, display: money(user.targetBalance) },
          ].filter(gauge => !onlySignal || gauge.label === "Signal strength").map(gauge => {
            const level = Math.max(1, Math.min(7, Math.floor(gauge.value / 100 * 7) + 1));
            const levelColors = ["#ef4444", "#f97316", "#eab308", "#a3b52b", "#86efac", "#22c55e", "#166534"];
            const levelRatings = ["Weak", "Fair", "Moderate", "Average", "Good", "Strong", "Excellent"];
            const levelColor = levelColors[level - 1];
            return <article className="dashboard-gauge" key={gauge.label}>
              <div className="dashboard-gauge-top"><span className="gauge-kicker">{gauge.label}</span><MoreHorizontal size={19}/></div>
              <p className="dashboard-gauge-description">{gauge.label === "Signal strength" ? "Current signal level for your account." : gauge.label === "Trade progress" ? "Progress set for your current trading goal." : "Profit balance progress toward your admin-set target."}</p>
              {gauge.label === "Trade progress" ? <>
                <div className="dashboard-gauge-value-row"><strong>{gauge.display}</strong></div>
                <div className="dashboard-gauge-single-track" role="meter" aria-label={gauge.label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(gauge.value)}>
                  <div style={{ width: `${gauge.value}%` }}/>
                </div>
              </> : gauge.label === "Target amount" ? <>
                <div className="dashboard-gauge-value-row"><strong>{hideBalance ? "••••••" : gauge.display}</strong></div>
                <div className="dashboard-gauge-single-track capital-target-track" role="meter" aria-label={gauge.label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(gauge.value)}>
                  <div style={{ width: `${gauge.value}%` }}/>
                </div>
                <div className="capital-target-caption">{user.targetBalance > 0 ? <><span>Profit <strong>{hideBalance ? "••••••" : money(user.profitBalance)}</strong></span><span>Target <strong>{hideBalance ? "••••••" : gauge.display}</strong></span></> : <span>Admin has not set a target yet.</span>}</div>
              </> : <>
                <div className="dashboard-gauge-value-row"><strong>{gauge.display}</strong><span className="gauge-rating" style={{ color: levelColor, borderColor: levelColor, backgroundColor: `${levelColor}18` }}>{levelRatings[level - 1]}</span></div>
                <div className="dashboard-gauge-segments" role="meter" aria-label={gauge.label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(gauge.value)} aria-valuetext={`${levelRatings[level - 1]}, level ${level}`}>
                  {Array.from({ length: 24 }, (_, index) => <span key={index} className={index < Math.round(gauge.value / 100 * 24) ? "filled" : ""} style={index < Math.round(gauge.value / 100 * 24) ? { backgroundColor: levelColor } : undefined}/>) }
                </div>
              </>}
            </article>;
          })}
          </div>
        </section>
  );
}
