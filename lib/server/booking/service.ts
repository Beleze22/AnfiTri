import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/client";
import { calculateExpiresAt } from "@/lib/server/booking/expiry";
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

async function findOverlap(
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

        return { booking, guest };
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

export async function confirmBooking(id: string) {
  const booking = await prisma.booking.findUniqueOrThrow({ where: { id } });
  if (booking.status !== "pendente") {
    throw new InvalidTransitionError(
      "Só é possível confirmar uma reserva pendente.",
    );
  }
  return prisma.booking.update({
    where: { id },
    data: { status: "confirmado" },
  });
}

export async function cancelBooking(id: string) {
  const booking = await prisma.booking.findUniqueOrThrow({ where: { id } });
  if (booking.status !== "pendente" && booking.status !== "confirmado") {
    throw new InvalidTransitionError(
      "Só é possível cancelar uma reserva pendente ou confirmada.",
    );
  }
  return prisma.booking.update({
    where: { id },
    data: { status: "cancelado" },
  });
}

export function getBookingById(id: string) {
  return prisma.booking.findUnique({
    where: { id },
    include: { property: true, user: true, conversation: true },
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
// liberando a data.
export async function expireOverdueBookings() {
  const result = await prisma.booking.updateMany({
    where: {
      status: "pendente",
      expiresAt: { lt: new Date() },
    },
    data: { status: "expirado" },
  });
  return result.count;
}
