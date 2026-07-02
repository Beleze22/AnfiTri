import { NextResponse } from "next/server";

import { prisma } from "@/lib/db/client";
import { apiError, requireSession } from "@/lib/server/http";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: RouteContext) {
  const session = await requireSession("gestor");
  if (!session) {
    return apiError("unauthorized", "Não autorizado.", 401);
  }

  const { id } = await params;
  await prisma.amenity.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
