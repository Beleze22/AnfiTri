import { prisma } from "@/lib/db/client";

// Grade de calendário consolidado (design-ui-ux.md, seção 3.4) — hospedagens
// nas linhas, navegação por semana.
export async function getWeekCalendar(weekStart: Date) {
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

  const properties = await prisma.property.findMany({
    where: { status: { not: "rascunho" } },
    orderBy: { title: "asc" },
    include: {
      bookings: {
        where: {
          status: { in: ["pendente", "confirmado"] },
          checkIn: { lt: weekEnd },
          checkOut: { gt: weekStart },
        },
        include: { user: true },
      },
    },
  });

  return properties;
}
