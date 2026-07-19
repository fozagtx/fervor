import { NextRequest, NextResponse } from "next/server";

/**
 * /mini is popup-only. A normal browser tab hitting /mini/123
 * (no ?p=1) always goes to the full match page - never a stretched
 * scoreboard on a white void.
 */
export function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;
  const m = pathname.match(/^\/mini\/(\d+)\/?$/);
  if (!m) return NextResponse.next();
  if (searchParams.get("p") === "1") return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = `/match/${m[1]}`;
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/mini/:id*"],
};
