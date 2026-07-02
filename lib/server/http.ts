import { NextResponse } from "next/server";

import { getSession } from "@/lib/server/auth/session";
import type { Role } from "@/lib/server/auth/jwt";

// Formato padrão de erro da API — mesma forma usada desde a Etapa 3
// (app/api/auth/login), para um futuro app mobile consumir de forma
// consistente (princípio arquitetural da seção 9 da arquitetura).
export function apiError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function requireSession(role?: Role) {
  const session = await getSession();
  if (!session || (role && session.role !== role)) {
    return null;
  }
  return session;
}
