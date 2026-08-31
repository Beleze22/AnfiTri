import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, requireSession } from "@/lib/server/http";
import {
  getEvolucaoMensal,
  getFaturamento,
} from "@/lib/server/reports/faturamento";

// Período por mês (AAAA-MM) ou intervalo explícito de datas.
const query = z.object({
  mes: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
  inicio: z.coerce.date().optional(),
  fim: z.coerce.date().optional(),
  propertyId: z.string().min(1).optional(),
});

export async function GET(request: Request) {
  const session = await requireSession("gestor");
  if (!session) {
    return apiError("unauthorized", "Não autorizado.", 401);
  }

  const params = new URL(request.url).searchParams;
  const parsed = query.safeParse({
    mes: params.get("mes") ?? undefined,
    inicio: params.get("inicio") ?? undefined,
    fim: params.get("fim") ?? undefined,
    propertyId: params.get("propertyId") ?? undefined,
  });
  if (!parsed.success) {
    return apiError("invalid_input", "Parâmetros inválidos.", 400);
  }

  let inicio: Date;
  let fim: Date;

  if (parsed.data.mes) {
    const [ano, mes] = parsed.data.mes.split("-").map(Number);
    inicio = new Date(Date.UTC(ano, mes - 1, 1));
    fim = new Date(Date.UTC(ano, mes, 1));
  } else if (parsed.data.inicio && parsed.data.fim) {
    inicio = parsed.data.inicio;
    // `fim` exclusivo na consulta; o gestor informa o último dia que quer ver.
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

  const { propertyId } = parsed.data;
  const [faturamento, evolucao] = await Promise.all([
    getFaturamento(inicio, fim, propertyId),
    getEvolucaoMensal(inicio, 12, propertyId),
  ]);

  return NextResponse.json({ ...faturamento, evolucao });
}
