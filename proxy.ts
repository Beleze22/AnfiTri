import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { SESSION_COOKIE, verifySession } from "@/lib/server/auth/jwt";

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/gestor/login") {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;

  if (!session || session.role !== "gestor") {
    return NextResponse.redirect(new URL("/gestor/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/gestor/:path*",
};
