import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db/client";
import { apiError, requireSession } from "@/lib/server/http";
import { deletePropertyPhoto, pathFromPublicUrl } from "@/lib/server/storage";

type RouteContext = { params: Promise<{ id: string }> };

const updateInput = z.object({ isCover: z.literal(true) });

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

  const photo = await prisma.photo.findUniqueOrThrow({ where: { id } });
  await prisma.$transaction([
    prisma.photo.updateMany({
      where: { propertyId: photo.propertyId },
      data: { isCover: false },
    }),
    prisma.photo.update({ where: { id }, data: { isCover: true } }),
  ]);

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const session = await requireSession("gestor");
  if (!session) {
    return apiError("unauthorized", "Não autorizado.", 401);
  }

  const { id } = await params;
  const photo = await prisma.photo.findUniqueOrThrow({ where: { id } });

  const path = pathFromPublicUrl(photo.url);
  if (path) {
    await deletePropertyPhoto(path);
  }
  await prisma.photo.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
