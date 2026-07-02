import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db/client";
import { apiError, requireSession } from "@/lib/server/http";

type RouteContext = { params: Promise<{ id: string }> };

const createInput = z.object({
  name: z.string().min(1),
  icon: z.string().min(1),
});

export async function POST(request: Request, { params }: RouteContext) {
  const session = await requireSession("gestor");
  if (!session) {
    return apiError("unauthorized", "Não autorizado.", 401);
  }

  const { id } = await params;
  const parsed = createInput.safeParse(await request.json());
  if (!parsed.success) {
    return apiError("invalid_input", "Dados inválidos.", 400);
  }

  const amenity = await prisma.amenity.create({
    data: { ...parsed.data, propertyId: id },
  });
  return NextResponse.json(amenity, { status: 201 });
}
