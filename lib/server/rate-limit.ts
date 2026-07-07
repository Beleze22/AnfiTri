import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/client";

// Rate limiting de janela fixa sobre Postgres (model RateLimit). Cada
// (escopo, identificador) tem um contador por janela; a chave embute o
// número da janela, então "zerar" é só o bucket seguinte nascer vazio.
// Contadores vencidos são varridos pelo cron de expiração de reservas.
export async function checkRateLimit(
  scope: string,
  identifier: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const windowMs = windowSeconds * 1000;
  const bucket = Math.floor(Date.now() / windowMs);
  const key = `${scope}:${identifier}:${bucket}`;
  const expiresAt = new Date((bucket + 1) * windowMs);

  const entry = await upsertCount(key, expiresAt);
  return entry.count <= limit;
}

async function upsertCount(key: string, expiresAt: Date) {
  try {
    return await prisma.rateLimit.upsert({
      where: { key },
      update: { count: { increment: 1 } },
      create: { key, count: 1, expiresAt },
    });
  } catch (error) {
    // Duas requisições criando a mesma chave ao mesmo tempo — a segunda
    // tentativa cai no ramo de update.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return prisma.rateLimit.update({
        where: { key },
        data: { count: { increment: 1 } },
      });
    }
    throw error;
  }
}

// Na Vercel o primeiro valor de x-forwarded-for é o IP real do cliente.
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

export async function cleanupExpiredRateLimits() {
  const result = await prisma.rateLimit.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return result.count;
}
