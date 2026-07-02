import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db/client";
import { apiError, requireSession } from "@/lib/server/http";

export async function GET() {
  const session = await requireSession();
  if (!session) {
    return apiError("unauthorized", "Não autorizado.", 401);
  }
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.sub },
  });
  return NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
  });
}

const updateInput = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().min(1).optional(),
});

export async function PATCH(request: Request) {
  const session = await requireSession();
  if (!session) {
    return apiError("unauthorized", "Não autorizado.", 401);
  }
  const parsed = updateInput.safeParse(await request.json());
  if (!parsed.success) {
    return apiError("invalid_input", "Dados inválidos.", 400);
  }
  const user = await prisma.user.update({
    where: { id: session.sub },
    data: parsed.data,
  });
  return NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
  });
}
