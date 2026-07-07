import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db/client";
import { apiError, readJson, requireSession } from "@/lib/server/http";

const priceRuleInput = z.object({
  name: z.string().min(1),
  ruleType: z.string().min(1),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).default([]),
  multiplier: z.coerce.number().positive(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const session = await requireSession("gestor");
  if (!session) {
    return apiError("unauthorized", "Não autorizado.", 401);
  }

  const { id } = await params;
  const rules = await prisma.priceRule.findMany({
    where: { propertyId: id },
    orderBy: { startDate: "asc" },
  });
  return NextResponse.json(rules);
}

export async function POST(request: Request, { params }: RouteContext) {
  const session = await requireSession("gestor");
  if (!session) {
    return apiError("unauthorized", "Não autorizado.", 401);
  }

  const { id } = await params;
  const parsed = priceRuleInput.safeParse(await readJson(request));
  if (!parsed.success) {
    return apiError("invalid_input", "Dados inválidos.", 400);
  }

  const rule = await prisma.priceRule.create({
    data: { ...parsed.data, propertyId: id },
  });
  return NextResponse.json(rule, { status: 201 });
}
