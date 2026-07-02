import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db/client";
import { apiError, requireSession } from "@/lib/server/http";
import { getPropertyById } from "@/lib/server/properties/service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const session = await requireSession("gestor");
  if (!session) {
    return apiError("unauthorized", "Não autorizado.", 401);
  }

  const { id } = await params;
  const property = await getPropertyById(id);
  if (!property) {
    return apiError("not_found", "Hospedagem não encontrada.", 404);
  }
  return NextResponse.json(property);
}

const updateInput = z.object({
  title: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  location: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  maxGuests: z.coerce.number().int().positive().optional(),
  bedrooms: z.coerce.number().int().min(0).optional(),
  basePrice: z.coerce.number().positive().optional(),
  airbnbIcalUrl: z.string().url().optional().or(z.literal("")),
  status: z.enum(["rascunho", "publicada", "pausada"]).optional(),
});

export async function PATCH(request: Request, { params }: RouteContext) {
  const session = await requireSession("gestor");
  if (!session) {
    return apiError("unauthorized", "Não autorizado.", 401);
  }

  const { id } = await params;
  const parsed = updateInput.safeParse(await request.json());
  if (!parsed.success) {
    return apiError("invalid_input", "Dados inválidos.", 400);
  }

  const property = await prisma.property.update({
    where: { id },
    data: {
      ...parsed.data,
      airbnbIcalUrl: parsed.data.airbnbIcalUrl || null,
    },
  });
  return NextResponse.json(property);
}
