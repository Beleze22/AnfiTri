import { compare } from "bcryptjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db/client";
import {
  MANAGER_SESSION_DURATION,
  MANAGER_SESSION_MAX_AGE_SECONDS,
  SESSION_COOKIE,
  signSession,
} from "@/lib/server/auth/jwt";
import { apiError, readJson } from "@/lib/server/http";
import { checkRateLimit, getClientIp } from "@/lib/server/rate-limit";

const loginInput = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  const parsed = loginInput.safeParse(await readJson(request));
  if (!parsed.success) {
    return apiError("invalid_input", "Dados inválidos.", 400);
  }
  const { email, password } = parsed.data;

  // Freia força bruta: 5 tentativas por IP+e-mail a cada 15 minutos.
  const allowed = await checkRateLimit(
    "login",
    `${getClientIp(request)}:${email.toLowerCase()}`,
    5,
    15 * 60,
  );
  if (!allowed) {
    return apiError(
      "too_many_requests",
      "Muitas tentativas. Tente novamente em alguns minutos.",
      429,
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (
    !user ||
    user.role !== "gestor" ||
    !user.passwordHash ||
    !(await compare(password, user.passwordHash))
  ) {
    return apiError("invalid_credentials", "E-mail ou senha incorretos.", 401);
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
    maxAge: MANAGER_SESSION_MAX_AGE_SECONDS,
  });

  return NextResponse.json({ id: user.id, name: user.name, email: user.email });
}
