import { jwtVerify, SignJWT } from "jose";

export type Role = "gestor" | "hospede" | "proprietario";

export type SessionPayload = {
  sub: string;
  role: Role;
};

export const SESSION_COOKIE = "session";
// Duração do JWT e maxAge do cookie andam juntos — mudar um sem o outro
// deixaria cookie vivo com token morto (ou vice-versa).
export const MANAGER_SESSION_DURATION = "7d";
export const MANAGER_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
export const GUEST_SESSION_DURATION = "60d";
export const GUEST_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 60;
// Proprietário acessa relatório de tempos em tempos, não é uso diário — 7
// dias, como o gestor, em vez dos 60 do hóspede.
export const OWNER_SESSION_DURATION = "7d";
export const OWNER_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

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
      (payload.role !== "gestor" &&
        payload.role !== "hospede" &&
        payload.role !== "proprietario")
    ) {
      return null;
    }
    return { sub: payload.sub, role: payload.role };
  } catch {
    return null;
  }
}
