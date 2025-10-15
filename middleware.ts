import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export const config = {
  matcher: ["/((?!_next/|favicon.ico|robots.txt|sitemap.xml).*)"],
};

export default function middleware(req: NextRequest) {
  const u = process.env.BASIC_AUTH_USER;
  const p = process.env.BASIC_AUTH_PASS;
  if (!u || !p) return NextResponse.next();

  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Basic ")) {
    const b64 = auth.split(" ")[1]!;
    const [user, pass] = atob(b64).split(":");
    if (user === u && pass === p) return NextResponse.next();
  }
  return new NextResponse("Auth required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="FM-Coach Test"' },
  });
}
