import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db/client";
import {
  GUEST_SESSION_DURATION,
  GUEST_SESSION_MAX_AGE_SECONDS,
  SESSION_COOKIE,
  signSession,
} from "@/lib/server/auth/jwt";
import { consumeMagicLinkToken } from "@/lib/server/auth/magic-link";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/?login=erro", request.url));
  }

  const userId = await consumeMagicLinkToken(token);
  const user = userId
    ? await prisma.user.findUnique({ where: { id: userId } })
    : null;

  if (!user || user.role !== "hospede") {
    return NextResponse.redirect(new URL("/?login=erro", request.url));
  }

  const session = await signSession(
    { sub: user.id, role: "hospede" },
    GUEST_SESSION_DURATION,
  );

  (await cookies()).set(SESSION_COOKIE, session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: GUEST_SESSION_MAX_AGE_SECONDS,
  });

  return NextResponse.redirect(new URL("/?login=ok", request.url));
}
