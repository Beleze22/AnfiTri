import { jwtVerify, SignJWT } from "jose";

export type Role = "gestor" | "hospede";

export type SessionPayload = {
  sub: string;
  role: Role;
};

export const SESSION_COOKIE = "session";
export const MANAGER_SESSION_DURATION = "7d";
export const GUEST_SESSION_DURATION = "60d";

function getSecretKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET não está configurado.");
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload, expiresIn: string) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getSecretKey());
}

export async function verifySession(
  token: string,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (
      typeof payload.sub !== "string" ||
      (payload.role !== "gestor" && payload.role !== "hospede")
    ) {
      return null;
    }
    return { sub: payload.sub, role: payload.role };
  } catch {
    return null;
  }
}
