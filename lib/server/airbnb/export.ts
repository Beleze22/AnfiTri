import ical from "ical-generator";

import { prisma } from "@/lib/db/client";

// Feed iCal para o Airbnb (arquitetura, seção 3.2) — só bookings confirmados
// entram aqui; pendentes ficam só na plataforma (podem expirar).
export async function generatePropertyCalendar(propertyId: string) {
  const property = await prisma.property.findUniqueOrThrow({
    where: { id: propertyId },
  });

  const bookings = await prisma.booking.findMany({
    where: { propertyId, status: "confirmado" },
  });

  const calendar = ical({ name: `anfitri — ${property.title}` });

  for (const booking of bookings) {
    // UID gerado automaticamente pelo ical-generator se não fornecido — o
    // Airbnb lê o feed como um snapshot completo, não precisa de UID estável.
    calendar.createEvent({
      start: booking.checkIn,
      end: booking.checkOut,
      allDay: true,
      summary: "Reservado",
      description: `Reserva ${booking.id} (${booking.source})`,
    });
  }

  return calendar.toString();
}
