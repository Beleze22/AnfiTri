import nodeIcal from "node-ical";

import { prisma } from "@/lib/db/client";
import { isAvailable } from "@/lib/server/booking/service";
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

    if (await isAvailable(propertyId, checkIn, checkOut)) {
      const guest = await getAirbnbPlaceholderGuest();
      await prisma.booking.create({
        data: {
          propertyId,
          userId: guest.id,
          checkIn,
          checkOut,
          source: "airbnb",
          status: "confirmado",
        },
      });
      created += 1;
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

  return results.reduce((sum, result) => {
    return sum + (result.status === "fulfilled" ? result.value.created : 0);
  }, 0);
}
