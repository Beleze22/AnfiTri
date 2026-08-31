import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db/client";
import { apiError, requireSession } from "@/lib/server/http";
import {
  getEvolucaoMensal,
  getFaturamento,
} from "@/lib/server/reports/faturamento";

// Relatório do proprietário. Rota separada da do gestor de propósito: aqui o
// ownerId vem SEMPRE da sessão e nunca dos parâmetros, então não existe
// combinação de query capaz de mostrar imóvel alheio. Misturar as duas
// visões numa rota só deixaria essa garantia a um `if` de distância.
const query = z.object({
  inicio: z.coerce.date().optional(),
  fim: z.coerce.date().optional(),
  propertyId: z.string().min(1).optional(),
});

export async function GET(request: Request) {
  const session = await requireSession("proprietario");
  if (!session) {
    return apiError("unauthorized", "Não autorizado.", 401);
  }

  const params = new URL(request.url).searchParams;
  const parsed = query.safeParse({
    inicio: params.get("inicio") ?? undefined,
    fim: params.get("fim") ?? undefined,
    propertyId: params.get("propertyId") ?? undefined,
  });
  if (!parsed.success) {
    return apiError("invalid_input", "Parâmetros inválidos.", 400);
  }

  let inicio: Date;
  let fim: Date;
  if (parsed.data.inicio && parsed.data.fim) {
    inicio = parsed.data.inicio;
    fim = new Date(parsed.data.fim.getTime() + 86_400_000);
  } else {
    const agora = new Date();
    inicio = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1));
    fim = new Date(
      Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() + 1, 1),
    );
  }
  if (inicio >= fim) {
    return apiError("invalid_input", "Período inválido.", 400);
  }

  const [faturamento, evolucao, imoveis] = await Promise.all([
    getFaturamento(inicio, fim, parsed.data.propertyId, session.sub),
    getEvolucaoMensal(inicio, 12, parsed.data.propertyId, session.sub),
    prisma.property.findMany({
      where: { ownerId: session.sub },
      select: { id: true, title: true, managementFeePercent: true },
      orderBy: { title: "asc" },
    }),
  ]);

  return NextResponse.json({
    ...faturamento,
    evolucao,
    imoveis: imoveis.map((i) => ({
      id: i.id,
      title: i.title,
      comissao: i.managementFeePercent?.toFixed(2) ?? null,
    })),
  });
}
