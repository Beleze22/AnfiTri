import { createHash, randomBytes } from "node:crypto";

import { prisma } from "@/lib/db/client";

const TOKEN_TTL_MINUTES = 15;

function hashToken(rawToken: string) {
  return createHash("sha256").update(rawToken).digest("hex");
}

export async function createMagicLinkToken(userId: string) {
  const rawToken = randomBytes(32).toString("hex");
  await prisma.magicLinkToken.create({
    data: {
      userId,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000),
    },
  });
  return rawToken;
}

export async function consumeMagicLinkToken(
  rawToken: string,
): Promise<string | null> {
  const token = await prisma.magicLinkToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
  });

  if (!token || token.usedAt || token.expiresAt < new Date()) {
    return null;
  }

  await prisma.magicLinkToken.update({
    where: { id: token.id },
    data: { usedAt: new Date() },
  });

  return token.userId;
}
