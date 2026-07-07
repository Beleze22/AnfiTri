import nodeIcal from "node-ical";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/client";
import { findOverlap } from "@/lib/server/booking/service";
import { getAirbnbPlaceholderGuest } from "@/lib/server/airbnb/shared";

function toUtcDate(date: Date) {
  return new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
}

// Camada de backup (arquitetura, seção 3.2): importa o iCal oficial do
// Airbnb e cria localmente qualquer reserva que o parser de e-mail não
// tiver capturado. Detectar o caso inverso (data que estava ocupada e
// voltou a ficar livre, sinal de cancelamento) é melhoria futura, fora do
// MVP — o próprio documento já assume essa limitação.
export async function syncPropertyFromAirbnbIcal(propertyId: string) {
  const property = await prisma.property.findUniqueOrThrow({
    where: { id: propertyId },
  });
  if (!property.airbnbIcalUrl) {
    return { created: 0 };
  }

  const events = await nodeIcal.async.fromURL(property.airbnbIcalUrl);
  let created = 0;

  for (const event of Object.values(events)) {
    if (!event || event.type !== "VEVENT" || !event.start || !event.end)
      continue;

    const checkIn = toUtcDate(event.start);
    const checkOut = toUtcDate(event.end);
    if (checkIn >= checkOut) continue;

    // O UID do evento identifica a reserva no Airbnb — usado como airbnbRef
    // (único no schema) para o re-sync de hora em hora ser idempotente
    // mesmo que as datas mudem.
    const airbnbRef = typeof event.uid === "string" ? event.uid : null;
    if (airbnbRef) {
      const existing = await prisma.booking.findUnique({
        where: { airbnbRef },
        select: { id: true },
      });
      if (existing) continue;
    }

    const guest = await getAirbnbPlaceholderGuest();
    try {
      // Mesma proteção da reserva pelo site: checagem de overlap + criação
      // numa transação serializable, para não colidir com um booking do
      // site criado no mesmo instante.
      const wasCreated = await prisma.$transaction(
        async (tx) => {
          const conflict = await findOverlap(tx, propertyId, checkIn, checkOut);
          if (conflict) return false;

          await tx.booking.create({
            data: {
              propertyId,
              userId: guest.id,
              checkIn,
              checkOut,
              source: "airbnb",
              status: "confirmado",
              airbnbRef,
            },
          });
          return true;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      if (wasCreated) created += 1;
    } catch (error) {
      // Corrida perdida (serialização ou airbnbRef duplicado): outro processo
      // já tratou essa data/reserva — segue para o próximo evento.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === "P2034" || error.code === "P2002")
      ) {
        continue;
      }
      throw error;
    }
  }

  await prisma.property.update({
    where: { id: propertyId },
    data: { airbnbSyncedAt: new Date() },
  });

  return { created };
}

export async function syncAllPropertiesFromAirbnbIcal() {
  const properties = await prisma.property.findMany({
    where: { airbnbIcalUrl: { not: null } },
    select: { id: true },
  });

  const results = await Promise.allSettled(
    properties.map((property) => syncPropertyFromAirbnbIcal(property.id)),
  );

  let created = 0;
  let failed = 0;
  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      created += result.value.created;
    } else {
      // Sem isso, um iCal quebrado (URL revogada, Airbnb fora do ar) falharia
      // em silêncio para sempre.
      failed += 1;
      console.error(
        `[airbnb-ical] falha ao sincronizar propriedade ${properties[index].id}:`,
        result.reason,
      );
    }
  });

  return { created, failed };
}
