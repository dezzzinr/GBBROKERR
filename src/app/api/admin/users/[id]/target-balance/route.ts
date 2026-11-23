import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { notifyUser } from "@/lib/notify";

export const dynamic = "force-dynamic";
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await requireAdmin(request))) return bad("Admin access required.", 403);
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const gauge = body.gauge;
    if (!["target", "progress", "signal"].includes(gauge)) return bad("Select one gauge to update.");
    if (body.value === "" || body.value == null || !Number.isFinite(Number(body.value))) return bad("Enter a valid value.");
    const value = Number(body.value);
    if (value < 0 || value > (gauge === "target" ? 100000000 : 100)) return bad(gauge === "target" ? "Enter a valid target amount." : "Enter a percentage between 0 and 100.");
    if (gauge === "target" && body.currency !== "USD") return bad("Only USD is supported.");
    const expected = String(body.expected ?? "");
    if (!/^\d+(\.\d{1,2})?$/.test(expected)) return bad("Reload this user before saving.", 409);
    const column = gauge === "target" ? users.targetBalance : gauge === "progress" ? users.targetProgressPercent : users.signalStrength;
    const update = gauge === "target" ? { targetBalance: value.toFixed(2) } : gauge === "progress" ? { targetProgressPercent: value.toFixed(2) } : { signalStrength: value.toFixed(2) };
    const [row] = await db.update(users).set(update).where(and(eq(users.id, id), eq(column, expected))).returning({ id: users.id });
    if (!row) return bad("This gauge changed or the user was not found. Reload and try again.", 409);
    const name = gauge === "target" ? "Target amount" : gauge === "progress" ? "Trade progress" : "Signal strength";
    const display = gauge === "target" ? `$${value.toFixed(2)} USD` : `${value.toFixed(2)}%`;
    // The change is committed already: notification problems must not falsely report a failed save.
    try { await notifyUser({ userId: id, type: gauge === "target" ? "target_balance_updated" : gauge === "progress" ? "trade_progress_updated" : "signal_strength_updated", title: `${name} updated`, message: `An admin updated your ${name.toLowerCase()} to ${display}.` }); }
    catch (err) { console.error("Gauge notification failed:", err); }
    return NextResponse.json({ success: true, message: `${name} updated to ${display}.` });
  } catch (error) { console.error("Admin gauge edit:", error); return bad("Unable to update gauge.", 500); }
}
