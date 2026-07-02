import { NextResponse } from "next/server";

import { SESSION_COOKIE } from "@/lib/server/auth/jwt";
import { getSession } from "@/lib/server/auth/session";

export async function POST(request: Request) {
  const session = await getSession();
  const destination = session?.role === "gestor" ? "/gestor/login" : "/";

  const response = NextResponse.redirect(new URL(destination, request.url));
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
