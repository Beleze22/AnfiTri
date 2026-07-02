import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db/client";
import { apiError, requireSession } from "@/lib/server/http";

const priceRuleUpdate = z.object({
  name: z.string().min(1).optional(),
  ruleType: z.string().min(1).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
  multiplier: z.coerce.number().positive().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const session = await requireSession("gestor");
  if (!session) {
    return apiError("unauthorized", "Não autorizado.", 401);
  }

  const { id } = await params;
  const parsed = priceRuleUpdate.safeParse(await request.json());
  if (!parsed.success) {
    return apiError("invalid_input", "Dados inválidos.", 400);
  }

  const rule = await prisma.priceRule.update({
    where: { id },
    data: parsed.data,
  });
  return NextResponse.json(rule);
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const session = await requireSession("gestor");
  if (!session) {
    return apiError("unauthorized", "Não autorizado.", 401);
  }

  const { id } = await params;
  await prisma.priceRule.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
