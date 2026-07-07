import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db/client";
import { apiError, readJson, requireSession } from "@/lib/server/http";
import {
  InvalidPhotoError,
  uploadPropertyPhoto,
  validatePropertyPhoto,
} from "@/lib/server/storage";

type RouteContext = { params: Promise<{ id: string }> };

// Aceita vários arquivos numa requisição (campo "file" repetido). Valida
// todos antes de subir o primeiro — ou entra tudo, ou nada.
export async function POST(request: Request, { params }: RouteContext) {
  const session = await requireSession("gestor");
  if (!session) {
    return apiError("unauthorized", "Não autorizado.", 401);
  }

  const { id } = await params;
  const formData = await request.formData();
  const files = formData.getAll("file").filter((f) => f instanceof File);
  if (files.length === 0) {
    return apiError("invalid_input", "Nenhum arquivo enviado.", 400);
  }

  try {
    for (const file of files) {
      validatePropertyPhoto(file);
    }
  } catch (error) {
    if (error instanceof InvalidPhotoError) {
      return apiError("invalid_input", error.message, 400);
    }
    throw error;
  }

  const existingCount = await prisma.photo.count({
    where: { propertyId: id },
  });

  const photos = [];
  for (const [index, file] of files.entries()) {
    const { url } = await uploadPropertyPhoto(id, file);
    photos.push(
      await prisma.photo.create({
        data: {
          propertyId: id,
          url,
          order: existingCount + index,
          isCover: existingCount === 0 && index === 0,
        },
      }),
    );
  }

  return NextResponse.json(photos, { status: 201 });
}

const reorderInput = z.object({ photoIds: z.array(z.string()).min(1) });

// Reordena as fotos: recebe a lista completa de ids na nova ordem e grava a
// posição de cada uma.
export async function PATCH(request: Request, { params }: RouteContext) {
  const session = await requireSession("gestor");
  if (!session) {
    return apiError("unauthorized", "Não autorizado.", 401);
  }

  const { id } = await params;
  const parsed = reorderInput.safeParse(await readJson(request));
  if (!parsed.success) {
    return apiError("invalid_input", "Dados inválidos.", 400);
  }

  const photos = await prisma.photo.findMany({ where: { propertyId: id } });
  const validIds = new Set(photos.map((photo) => photo.id));
  const { photoIds } = parsed.data;
  if (
    photoIds.length !== photos.length ||
    !photoIds.every((photoId) => validIds.has(photoId))
  ) {
    return apiError(
      "invalid_input",
      "A lista precisa conter todas as fotos da hospedagem.",
      400,
    );
  }

  await prisma.$transaction(
    photoIds.map((photoId, index) =>
      prisma.photo.update({ where: { id: photoId }, data: { order: index } }),
    ),
  );

  return NextResponse.json({ ok: true });
}
