import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db/client";
import { apiError, readJson, requireSession } from "@/lib/server/http";

type RouteContext = { params: Promise<{ id: string }> };

const atualizarInput = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
});

export async function PATCH(request: Request, { params }: RouteContext) {
  const session = await requireSession("gestor");
  if (!session) {
    return apiError("unauthorized", "Não autorizado.", 401);
  }

  const { id } = await params;
  const parsed = atualizarInput.safeParse(await readJson(request));
  if (!parsed.success) {
    return apiError("invalid_input", "Dados inválidos.", 400);
  }

  const dono = await prisma.user.findUnique({ where: { id } });
  if (!dono || dono.role !== "proprietario") {
    return apiError("not_found", "Proprietário não encontrado.", 404);
  }

  const email = parsed.data.email?.toLowerCase();
  if (email && email !== dono.email) {
    // E-mail é a credencial: o magic link passa a ser enviado para o novo
    // endereço. Colidir com outro usuário trocaria o acesso de dono.
    const emUso = await prisma.user.findUnique({ where: { email } });
    if (emUso) {
      return apiError("email_em_uso", "Esse e-mail já está em uso.", 409);
    }
  }

  const atualizado = await prisma.user.update({
    where: { id },
    data: {
      ...parsed.data,
      ...(email ? { email } : {}),
      ...(parsed.data.phone !== undefined
        ? { phone: parsed.data.phone || null }
        : {}),
    },
  });

  return NextResponse.json({
    id: atualizado.id,
    name: atualizado.name,
    email: atualizado.email,
    phone: atualizado.phone,
  });
}

// Excluir um proprietário não apaga histórico: os imóveis dele voltam a ser
// tratados como do gestor, e as reservas seguem intactas. Sem isso o gestor
// não teria como desfazer um cadastro errado.
export async function DELETE(_request: Request, { params }: RouteContext) {
  const session = await requireSession("gestor");
  if (!session) {
    return apiError("unauthorized", "Não autorizado.", 401);
  }

  const { id } = await params;
  const dono = await prisma.user.findUnique({ where: { id } });
  if (!dono || dono.role !== "proprietario") {
    return apiError("not_found", "Proprietário não encontrado.", 404);
  }

  await prisma.$transaction([
    prisma.property.updateMany({
      where: { ownerId: id },
      data: { ownerId: null },
    }),
    prisma.magicLinkToken.deleteMany({ where: { userId: id } }),
    prisma.user.delete({ where: { id } }),
  ]);

  return NextResponse.json({ removed: true });
}
