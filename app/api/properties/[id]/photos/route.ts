import { NextResponse } from "next/server";

import { prisma } from "@/lib/db/client";
import { apiError, requireSession } from "@/lib/server/http";
import { uploadPropertyPhoto } from "@/lib/server/storage";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const session = await requireSession("gestor");
  if (!session) {
    return apiError("unauthorized", "Não autorizado.", 401);
  }

  const { id } = await params;
  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return apiError("invalid_input", "Arquivo não enviado.", 400);
  }

  const existingCount = await prisma.photo.count({
    where: { propertyId: id },
  });
  const { url } = await uploadPropertyPhoto(id, file);

  const photo = await prisma.photo.create({
    data: {
      propertyId: id,
      url,
      order: existingCount,
      isCover: existingCount === 0,
    },
  });

  return NextResponse.json(photo, { status: 201 });
}
