import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const password = process.env.SITE_PASSWORD;

  if (!password) return NextResponse.next();
  if (
    pathname === "/login" ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname.startsWith("/icon")
  ) {
    return NextResponse.next();
  }
  if (pathname === "/api/scan" && req.headers.get("authorization")?.startsWith("Bearer ")) {
    return NextResponse.next();
  }
  if (req.cookies.get("site_auth")?.value === password) {
    return NextResponse.next();
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("from", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
