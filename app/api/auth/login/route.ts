import { compare } from "bcryptjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db/client";
import {
  MANAGER_SESSION_DURATION,
  SESSION_COOKIE,
  signSession,
} from "@/lib/server/auth/jwt";

export async function POST(request: Request) {
  const { email, password } = await request.json();

  if (typeof email !== "string" || typeof password !== "string") {
    return NextResponse.json(
      { error: { code: "invalid_input", message: "Dados inválidos." } },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (
    !user ||
    user.role !== "gestor" ||
    !user.passwordHash ||
    !(await compare(password, user.passwordHash))
  ) {
    return NextResponse.json(
      {
        error: {
          code: "invalid_credentials",
          message: "E-mail ou senha incorretos.",
        },
      },
      { status: 401 },
    );
  }

  const token = await signSession(
    { sub: user.id, role: "gestor" },
    MANAGER_SESSION_DURATION,
  );

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return NextResponse.json({ id: user.id, name: user.name, email: user.email });
}
