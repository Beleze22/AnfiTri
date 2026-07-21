import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/client";
import { calculateExpiresAt } from "@/lib/server/booking/expiry";
import {
  captureBookingPayment,
  releaseBookingPayment,
} from "@/lib/server/payments/stripe";
import { calculatePriceForStay } from "@/lib/server/pricing/calculate";

export class BookingConflictError extends Error {}
export class InvalidTransitionError extends Error {}

const DEFAULT_EXPIRY_CONFIG = {
  defaultExpiryHours: 6,
  quietHoursStart: new Date("1970-01-01T22:00:00Z"),
  quietHoursEnd: new Date("1970-01-01T07:00:00Z"),
  gracePeriodHours: 2,
};

export async function getManagerExpiryConfig() {
  const manager = await prisma.user.findFirstOrThrow({
    where: { role: "gestor" },
  });
  return {
    defaultExpiryHours:
      manager.defaultExpiryHours ?? DEFAULT_EXPIRY_CONFIG.defaultExpiryHours,
    quietHoursStart:
      manager.quietHoursStart ?? DEFAULT_EXPIRY_CONFIG.quietHoursStart,
    quietHoursEnd: manager.quietHoursEnd ?? DEFAULT_EXPIRY_CONFIG.quietHoursEnd,
    gracePeriodHours:
      manager.gracePeriodHours ?? DEFAULT_EXPIRY_CONFIG.gracePeriodHours,
  };
}

export async function findOverlap(
  tx: Prisma.TransactionClient,
  propertyId: string,
  checkIn: Date,
  checkOut: Date,
) {
  return tx.booking.findFirst({
    where: {
      propertyId,
      status: { in: ["pendente", "confirmado"] },
      checkIn: { lt: checkOut },
      checkOut: { gt: checkIn },
    },
  });
}

// Checagem de leitura (fora de transação), usada pela vitrine pública para
// decidir em qual seção (disponível/indisponível) cada imóvel entra (seção
// 3.5 do doc de design). A criação de booking usa `findOverlap` dentro da
// transação serializable, não esta função.
export async function isAvailable(
  propertyId: string,
  checkIn: Date,
  checkOut: Date,
) {
  const conflict = await prisma.booking.findFirst({
    where: {
      propertyId,
      status: { in: ["pendente", "confirmado"] },
      checkIn: { lt: checkOut },
      checkOut: { gt: checkIn },
    },
  });
  return !conflict;
}

// Datas ocupadas (pendente/confirmado), usadas pelo calendário de seleção de
// intervalo (3.3) para desenhar dias indisponíveis.
export function getOccupiedRanges(propertyId: string) {
  return prisma.booking.findMany({
    where: { propertyId, status: { in: ["pendente", "confirmado"] } },
    select: { checkIn: true, checkOut: true },
  });
}

// Reserva preliminar pelo site (seção 6.1) — cria o Booking pendente
// imediatamente, evitando que duas pessoas selecionem a mesma data enquanto
// negociam com o gestor. A checagem de sobreposição + criação roda numa
// transação serializable para cobrir o caso de duas requisições simultâneas
// para a mesma data (condição de corrida, seção 4 do plano de implementação).
//
// O e-mail informado não é verificado neste ponto, então um e-mail já
// cadastrado nunca tem nome/telefone sobrescritos nem ganha sessão aqui
// (isNewUser=false) — senão qualquer pessoa assumiria a conta de um hóspede
// só de conhecer o e-mail dele. O acesso do usuário existente vem pelo
// magic link.
export async function createSiteBooking(input: {
  propertyId: string;
  checkIn: Date;
  checkOut: Date;
  name: string;
  email: string;
  phone?: string;
}) {
  const config = await getManagerExpiryConfig();
  const { total } = await calculatePriceForStay(
    input.propertyId,
    input.checkIn,
    input.checkOut,
  );

  try {
    return await prisma.$transaction(
      async (tx) => {
        const conflict = await findOverlap(
          tx,
          input.propertyId,
          input.checkIn,
          input.checkOut,
        );
        if (conflict) {
          throw new BookingConflictError("Datas não mais disponíveis.");
        }

        const existingGuest = await tx.user.findUnique({
          where: { email: input.email },
        });
        const guest =
          existingGuest ??
          (await tx.user.create({
            data: {
              name: input.name,
              email: input.email,
              phone: input.phone,
              role: "hospede",
            },
          }));

        const createdAt = new Date();
        const expiresAt = calculateExpiresAt(createdAt, config);

        const booking = await tx.booking.create({
          data: {
            propertyId: input.propertyId,
            userId: guest.id,
            checkIn: input.checkIn,
            checkOut: input.checkOut,
            source: "site",
            status: "pendente",
            expiresAt,
            totalPrice: total,
            createdAt,
            conversation: { create: {} },
          },
        });

        return { booking, guest, isNewUser: !existingGuest };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    ) {
      throw new BookingConflictError("Datas não mais disponíveis.");
    }
    throw error;
  }
}

// Reserva lançada manualmente pelo gestor (ex: telefone, conhecido pessoal).
// Não há tela especificada para isso nos documentos — endpoint construído
// para reuso na Etapa 6 caso essa tela seja adicionada; ver observação na
// resposta sobre essa lacuna.
export async function createManualBooking(input: {
  propertyId: string;
  checkIn: Date;
  checkOut: Date;
  name: string;
  email: string;
  phone?: string;
  status?: "pendente" | "confirmado";
}) {
  const { total } = await calculatePriceForStay(
    input.propertyId,
    input.checkIn,
    input.checkOut,
  );

  return prisma.$transaction(
    async (tx) => {
      const conflict = await findOverlap(
        tx,
        input.propertyId,
        input.checkIn,
        input.checkOut,
      );
      if (conflict) {
        throw new BookingConflictError("Datas não mais disponíveis.");
      }

      const guest = await tx.user.upsert({
        where: { email: input.email },
        update: { name: input.name, phone: input.phone },
        create: {
          name: input.name,
          email: input.email,
          phone: input.phone,
          role: "hospede",
        },
      });

      return tx.booking.create({
        data: {
          propertyId: input.propertyId,
          userId: guest.id,
          checkIn: input.checkIn,
          checkOut: input.checkOut,
          source: "manual",
          status: input.status ?? "confirmado",
          totalPrice: total,
          conversation: { create: {} },
        },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

// Transições usam updateMany com a condição de status no where — a leitura
// separada abria janela para duas requisições simultâneas (ex: confirmar e
// cancelar) passarem ambas pela checagem.
export async function confirmBooking(id: string) {
  // Pedido com pagamento só confirma com o cartão já autorizado — a
  // aprovação do gestor é o que dispara a cobrança (captura), como no Airbnb.
  const withPayment = await prisma.booking.findUniqueOrThrow({
    where: { id },
    include: { payment: true },
  });
  if (withPayment.payment && withPayment.payment.status !== "autorizado") {
    throw new InvalidTransitionError(
      withPayment.payment.status === "aguardando"
        ? "O hóspede ainda não concluiu o pagamento."
        : "O pagamento dessa reserva não está mais válido.",
    );
  }

  const result = await prisma.booking.updateMany({
    where: {
      id,
      status: "pendente",
      // Pendente já vencida não pode ser confirmada, mesmo que o job de
      // expiração (a cada 15 min) ainda não a tenha varrido.
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    data: { status: "confirmado" },
  });

  if (result.count === 0) {
    const booking = await prisma.booking.findUniqueOrThrow({ where: { id } });
    throw new InvalidTransitionError(
      booking.status === "pendente"
        ? "O prazo de confirmação dessa reserva já venceu."
        : "Só é possível confirmar uma reserva pendente.",
    );
  }

  if (withPayment.payment) {
    try {
      await captureBookingPayment(id);
    } catch (error) {
      // Cobrança falhou — a confirmação volta atrás para a data não ficar
      // presa a uma reserva sem pagamento.
      await prisma.booking.update({
        where: { id },
        data: { status: "pendente" },
      });
      throw error;
    }
  }

  return prisma.booking.findUniqueOrThrow({ where: { id } });
}

export async function cancelBooking(id: string) {
  const result = await prisma.booking.updateMany({
    where: { id, status: { in: ["pendente", "confirmado"] } },
    data: { status: "cancelado" },
  });

  if (result.count === 0) {
    await prisma.booking.findUniqueOrThrow({ where: { id } });
    throw new InvalidTransitionError(
      "Só é possível cancelar uma reserva pendente ou confirmada.",
    );
  }

  // Devolve o dinheiro do hóspede: retenção liberada (pendente) ou estorno
  // integral (já confirmada e paga).
  await releaseBookingPayment(id);

  return prisma.booking.findUniqueOrThrow({ where: { id } });
}

export function getBookingById(id: string) {
  return prisma.booking.findUnique({
    where: { id },
    include: { property: true, user: true, conversation: true, payment: true },
  });
}

export function listBookingsForProperty(propertyId: string) {
  return prisma.booking.findMany({
    where: { propertyId },
    include: { user: true },
    orderBy: { checkIn: "asc" },
  });
}

export function listBookingsForUser(userId: string) {
  return prisma.booking.findMany({
    where: { userId },
    include: { property: true, conversation: true },
    orderBy: { checkIn: "desc" },
  });
}

export function listAllBookings() {
  return prisma.booking.findMany({
    include: { property: true, user: true },
    orderBy: { checkIn: "asc" },
  });
}

// Job periódico (seção 6.2, último parágrafo) — expira pendentes vencidos,
// liberando a data. Um por vez, atomicamente: a retenção de cartão só é
// liberada para pedidos que ESTE job expirou — se o gestor confirmar no
// mesmo instante, o updateMany condicional perde a corrida e não tocamos no
// pagamento.
export async function expireOverdueBookings() {
  const overdue = await prisma.booking.findMany({
    where: { status: "pendente", expiresAt: { lt: new Date() } },
    select: { id: true },
  });

  let expired = 0;
  for (const { id } of overdue) {
    const result = await prisma.booking.updateMany({
      where: { id, status: "pendente" },
      data: { status: "expirado" },
    });
    if (result.count === 0) continue;
    expired += 1;

    try {
      await releaseBookingPayment(id);
    } catch (error) {
      // Falha ao liberar não impede a expiração — retenção não capturada
      // cai sozinha em 7 dias; fica o log para acompanhamento.
      console.error(
        `[payments] falha ao liberar retenção (booking ${id}):`,
        error,
      );
    }
  }
  return expired;
}
