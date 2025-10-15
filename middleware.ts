import { NextRequest, NextResponse } from "next/server";

export const config = {
  matcher: ["/((?!_next/|favicon.ico|robots.txt|sitemap.xml).*)"],
};

const COOKIE = "fm_invite"; // Cookie-Name

function parseAllowlist() {
  // ENV: "alice=ABC123,bob=XYZ789"
  const raw = process.env.INVITE_TOKENS || "";
  return raw.split(",")
    .map(s => s.trim())
    .filter(Boolean)
    .map(p => p.split("=")) // [name, token]
    .filter(([n, t]) => n && t) as [string, string][];
}

export default function middleware(req: NextRequest) {
  const url = new URL(req.url);
  const tokenFromUrl = url.searchParams.get("t");
  const cookieToken = req.cookies.get(COOKIE)?.value;

  const list = parseAllowlist();
  const isValid = (t?: string) => !!t && list.some(([_, tok]) => tok === t);

  // 1) Token im URL → Cookie setzen → Query aufräumen
  if (tokenFromUrl && isValid(tokenFromUrl)) {
    const res = NextResponse.redirect(new URL(url.pathname, url.origin));
    res.cookies.set(COOKIE, tokenFromUrl, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 Tage
      secure: true,
    });
    return res;
  }

  // 2) Cookie gültig?
  if (isValid(cookieToken)) return NextResponse.next();

  // 3) Kein gültiger Token → Login-Hinweis
  return NextResponse.redirect(new URL("/login", req.url));
}
