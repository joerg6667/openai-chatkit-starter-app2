import { NextRequest, NextResponse } from "next/server";

export const config = {
  // Alles außer Next-Assets, API und Login schützen
  matcher: ["/((?!_next/|api/|favicon.ico|robots.txt|sitemap.xml|login).*)"],
};

const COOKIE = "fm_invite"; // Invite-Cookie
const isProd = process.env.NODE_ENV === "production";

// ENV: "alice=ABC123,bob=XYZ789"
function parseAllowlist() {
  const raw = process.env.INVITE_TOKENS || "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((p) => p.split("=")) // [name, token]
    .filter(([n, t]) => n && t) as [string, string][];
}

export default function middleware(req: NextRequest) {
  const url = new URL(req.url);
  const path = url.pathname;

  // Extra-Guard (falls matcher später geändert wird):
  if (
    path.startsWith("/_next/") ||
    path.startsWith("/api/") ||
    path === "/login" ||
    path === "/favicon.ico" ||
    path === "/robots.txt" ||
    path === "/sitemap.xml"
  ) {
    return NextResponse.next();
  }

  const tokenFromUrl = url.searchParams.get("t");
  const cookieToken = req.cookies.get(COOKIE)?.value;

  const list = parseAllowlist();
  const isValid = (t?: string) => !!t && list.some(([_, tok]) => tok === t);

  // 1) Gültiger Token im URL → Cookie setzen → Query aufräumen
  if (tokenFromUrl && isValid(tokenFromUrl)) {
    const res = NextResponse.redirect(new URL(url.pathname, url.origin));
    res.cookies.set(COOKIE, tokenFromUrl, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 Tage
      secure: isProd, // lokal kein Secure erzwingen
    });
    return res;
  }

  // 2) Cookie gültig → durchlassen
  if (isValid(cookieToken)) {
    return NextResponse.next();
  }

  // 3) Kein Zugriff → Login-Hinweis
  return NextResponse.redirect(new URL("/login", req.url));
}
