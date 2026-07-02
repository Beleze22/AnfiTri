import { cookies } from "next/headers";

import { SESSION_COOKIE, verifySession } from "@/lib/server/auth/jwt";

export async function getSession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? verifySession(token) : null;
}
