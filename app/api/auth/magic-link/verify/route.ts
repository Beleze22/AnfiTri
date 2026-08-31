import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db/client";
import {
  GUEST_SESSION_DURATION,
  GUEST_SESSION_MAX_AGE_SECONDS,
  OWNER_SESSION_DURATION,
  OWNER_SESSION_MAX_AGE_SECONDS,
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

  if (!user || (user.role !== "hospede" && user.role !== "proprietario")) {
    return NextResponse.redirect(new URL("/?login=erro", request.url));
  }

  // Cada papel tem duração e destino próprios: o hóspede volta para a
  // vitrine, o proprietário cai direto no painel dele.
  const proprietario = user.role === "proprietario";
  const session = await signSession(
    { sub: user.id, role: user.role },
    proprietario ? OWNER_SESSION_DURATION : GUEST_SESSION_DURATION,
  );

  (await cookies()).set(SESSION_COOKIE, session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: proprietario
      ? OWNER_SESSION_MAX_AGE_SECONDS
      : GUEST_SESSION_MAX_AGE_SECONDS,
  });

  return NextResponse.redirect(
    new URL(proprietario ? "/proprietario" : "/?login=ok", request.url),
  );
}
