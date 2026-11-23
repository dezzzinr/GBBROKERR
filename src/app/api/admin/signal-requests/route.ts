import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { signalPurchaseRequests, users } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    if (!(await requireAdmin(request))) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    const rows = await db.select({ id: signalPurchaseRequests.id, userId: signalPurchaseRequests.userId, userName: users.name, userEmail: users.email, percent: signalPurchaseRequests.percent, price100: signalPurchaseRequests.price100, cost: signalPurchaseRequests.cost, status: signalPurchaseRequests.status, createdAt: signalPurchaseRequests.createdAt, reviewedAt: signalPurchaseRequests.reviewedAt, currentSignal: users.signalStrength, capital: users.cashBalance }).from(signalPurchaseRequests).innerJoin(users, eq(signalPurchaseRequests.userId, users.id)).orderBy(sql`CASE WHEN ${signalPurchaseRequests.status} = 'pending' THEN 0 ELSE 1 END`, desc(signalPurchaseRequests.createdAt)).limit(300);
    return NextResponse.json({ requests: rows });
  } catch (error) { console.error("Admin signal requests:", error); return NextResponse.json({ error: "Unable to load signal requests." }, { status: 500 }); }
}
