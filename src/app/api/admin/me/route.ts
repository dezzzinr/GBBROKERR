import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  return NextResponse.json({ user: { id: admin.id, name: admin.name, email: admin.email, currency: "USD" }, fx: { currency: "USD", rate: 1, status: "live", updatedAt: null, rates: { USD: 1 } } });
}
