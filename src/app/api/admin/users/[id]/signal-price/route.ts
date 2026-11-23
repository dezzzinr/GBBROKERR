import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
export const dynamic = "force-dynamic";
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await requireAdmin(request))) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const raw = body.price === null ? null : String(body.price ?? "").trim();
    if (raw !== null && (!/^\d+(\.\d{1,2})?$/.test(raw) || Number(raw) < 0.01 || Number(raw) > 100000000)) return NextResponse.json({ error: "Enter a price from $0.01 to $100,000,000, or disable purchases." }, { status: 400 });
    const [row] = await db.update(users).set({ signalPrice100: raw === null ? null : Number(raw).toFixed(2) }).where(eq(users.id, id)).returning({ id: users.id });
    if (!row) return NextResponse.json({ error: "User not found." }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) { console.error("Admin signal price:", error); return NextResponse.json({ error: "Unable to update signal price." }, { status: 500 }); }
}
