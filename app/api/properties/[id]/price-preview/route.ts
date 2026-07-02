import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, requireSession } from "@/lib/server/http";
import { calculatePriceForStay } from "@/lib/server/pricing/calculate";

const query = z.object({
  year: z.coerce.number().int(),
  month: z.coerce.number().int().min(1).max(12),
});

type RouteContext = { params: Promise<{ id: string }> };

// Preço final por dia do mês (design-ui-ux.md, seção 4.9) — reaproveita a
// mesma função de cálculo da reserva pública, tratando o mês inteiro como
// uma "estadia" para obter o detalhamento por noite.
export async function GET(request: Request, { params }: RouteContext) {
  const session = await requireSession("gestor");
  if (!session) {
    return apiError("unauthorized", "Não autorizado.", 401);
  }

  const { id } = await params;
  const searchParams = new URL(request.url).searchParams;
  const parsed = query.safeParse({
    year: searchParams.get("year"),
    month: searchParams.get("month"),
  });
  if (!parsed.success) {
    return apiError("invalid_input", "Parâmetros inválidos.", 400);
  }

  const monthStart = new Date(
    Date.UTC(parsed.data.year, parsed.data.month - 1, 1),
  );
  const monthEnd = new Date(Date.UTC(parsed.data.year, parsed.data.month, 1));

  const { nights } = await calculatePriceForStay(id, monthStart, monthEnd);

  return NextResponse.json(
    nights.map((night) => ({
      date: night.date.toISOString().slice(0, 10),
      price: night.price.toFixed(2),
      appliedRules: night.appliedRules,
    })),
  );
}
