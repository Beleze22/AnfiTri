import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { SESSION_COOKIE, verifySession } from "@/lib/server/auth/jwt";

// Duas áreas protegidas, com papéis distintos: /gestor exige papel gestor,
// /proprietario exige papel proprietario. O gestor NÃO entra na área do
// proprietário e vice-versa — são visões diferentes do mesmo dado, e cruzar
// os papéis confundiria mais do que ajudaria.
const AREAS = [
  { prefixo: "/gestor", login: "/gestor/login", papel: "gestor" },
  {
    prefixo: "/proprietario",
    login: "/proprietario/login",
    papel: "proprietario",
  },
] as const;

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const area = AREAS.find((a) => pathname.startsWith(a.prefixo));
  if (!area || pathname === area.login) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;

  if (!session || session.role !== area.papel) {
    return NextResponse.redirect(new URL(area.login, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/gestor/:path*", "/proprietario/:path*"],
};
