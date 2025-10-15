import { NextRequest, NextResponse } from "next/server";
import { writeAudit } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const event = (body?.event as string) || "visit";
    const token = req.cookies.get("fm_invite")?.value || "unknown";
    await writeAudit(token, event as any, body?.data);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
