import { NextResponse } from "next/server";
import { z } from "zod";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/client";
import { apiError, requireSession } from "@/lib/server/http";

// Calendário de ocupação do proprietário. Devolve apenas datas e origem —
// nada de nome, e-mail ou telefone do hóspede, que contratou com o gestor e
// não com o dono do imóvel. O dono precisa saber QUANDO está ocupado, não
// QUEM está lá.
const query = z.object({
  mes: z.string().regex(/^\d{4}-\d{2}$/),
  propertyId: z.string().min(1).optional(),
});

export async function GET(request: Request) {
  const session = await requireSession("proprietario");
  if (!session) {
    return apiError("unauthorized", "Não autorizado.", 401);
  }

  const params = new URL(request.url).searchParams;
  const parsed = query.safeParse({
    mes: params.get("mes") ?? "",
    propertyId: params.get("propertyId") ?? undefined,
  });
  if (!parsed.success) {
    return apiError("invalid_input", "Parâmetros inválidos.", 400);
  }

  const [ano, mes] = parsed.data.mes.split("-").map(Number);
  const inicio = new Date(Date.UTC(ano, mes - 1, 1));
  const fim = new Date(Date.UTC(ano, mes, 1));

  const imoveis = await prisma.property.findMany({
    where: {
      ownerId: session.sub,
      ...(parsed.data.propertyId ? { id: parsed.data.propertyId } : {}),
    },
    select: {
      id: true,
      title: true,
      managementFeePercent: true,
      bookings: {
        where: {
          // Pendente também ocupa a data, mas para o dono a distinção entre
          // "pendente" e "confirmado" é ruído do fluxo do gestor: o que
          // importa é se o imóvel está comprometido naquele dia.
          status: { in: ["pendente", "confirmado"] },
          checkIn: { lt: fim },
          checkOut: { gt: inicio },
        },
        select: {
          id: true,
          checkIn: true,
          checkOut: true,
          source: true,
          status: true,
          totalPrice: true,
          platformFee: true,
          netAmount: true,
        },
        orderBy: { checkIn: "asc" },
      },
    },
    orderBy: { title: "asc" },
  });

  const ZERO = new Prisma.Decimal(0);

  return NextResponse.json({
    mes: parsed.data.mes,
    imoveis: imoveis.map((i) => ({
      id: i.id,
      title: i.title,
      ocupacoes: i.bookings.map((b) => {
        // Mesma cascata do relatório, por reserva: o dono vê no calendário o
        // valor que aquela estadia rende para ele, não a receita cheia.
        const bruto = b.totalPrice ?? ZERO;
        const liquido = b.netAmount ?? bruto.minus(b.platformFee ?? ZERO);
        const comissao = i.managementFeePercent
          ? liquido.mul(i.managementFeePercent).div(100)
          : ZERO;

        return {
          id: b.id,
          checkIn: b.checkIn.toISOString().slice(0, 10),
          checkOut: b.checkOut.toISOString().slice(0, 10),
          origem: b.source === "airbnb" ? "Airbnb" : "Reserva direta",
          // Nulo quando o valor ainda não foi apurado — reservas do Airbnb
          // anteriores à leitura financeira dos e-mails. Melhor a tela dizer
          // "em apuração" do que exibir zero como se fosse o valor real.
          repasse: b.totalPrice ? liquido.minus(comissao).toFixed(2) : null,
        };
      }),
    })),
  });
}
