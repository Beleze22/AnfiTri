import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db/client";
import { apiError, readJson, requireSession } from "@/lib/server/http";

// Cadastro dos proprietários que terceirizam a administração para o gestor.
// Não há senha: o acesso deles é por magic link, então basta nome e e-mail.
export async function GET() {
  const session = await requireSession("gestor");
  if (!session) {
    return apiError("unauthorized", "Não autorizado.", 401);
  }

  const donos = await prisma.user.findMany({
    where: { role: "proprietario" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      ownedProperties: {
        select: { id: true, title: true, managementFeePercent: true },
        orderBy: { title: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(
    donos.map((d) => ({
      id: d.id,
      name: d.name,
      email: d.email,
      phone: d.phone,
      imoveis: d.ownedProperties.map((p) => ({
        id: p.id,
        title: p.title,
        comissao: p.managementFeePercent?.toFixed(2) ?? null,
      })),
    })),
  );
}

const criarInput = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1).optional(),
});

export async function POST(request: Request) {
  const session = await requireSession("gestor");
  if (!session) {
    return apiError("unauthorized", "Não autorizado.", 401);
  }

  const parsed = criarInput.safeParse(await readJson(request));
  if (!parsed.success) {
    return apiError("invalid_input", "Dados inválidos.", 400);
  }

  const email = parsed.data.email.toLowerCase();
  const existente = await prisma.user.findUnique({ where: { email } });
  if (existente) {
    // E-mail é único e serve os três papéis. Promover um hóspede a
    // proprietário em silêncio daria a ele acesso a relatório financeiro,
    // então o caso é recusado e fica visível para o gestor.
    return apiError(
      "email_em_uso",
      existente.role === "proprietario"
        ? "Esse proprietário já está cadastrado."
        : "Esse e-mail já pertence a outro usuário da plataforma.",
      409,
    );
  }

  const dono = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email,
      phone: parsed.data.phone,
      role: "proprietario",
    },
  });

  return NextResponse.json(
    { id: dono.id, name: dono.name, email: dono.email, imoveis: [] },
    { status: 201 },
  );
}
