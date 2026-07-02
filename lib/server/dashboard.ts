import { prisma } from "@/lib/db/client";

function monthRange(reference = new Date()) {
  const start = new Date(
    Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), 1),
  );
  const end = new Date(
    Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() + 1, 1),
  );
  return { start, end };
}

// Cards de métricas (design-ui-ux.md, seção 4.5).
export async function getDashboardMetrics() {
  const { start, end } = monthRange();

  const [pendingCount, confirmedThisMonth, unreadCount, propertyCount] =
    await Promise.all([
      prisma.booking.count({ where: { status: "pendente" } }),
      prisma.booking.count({
        where: { status: "confirmado", checkIn: { gte: start, lt: end } },
      }),
      prisma.message.count({
        where: { read: false, sender: { role: "hospede" } },
      }),
      prisma.property.count({ where: { status: "publicada" } }),
    ]);

  const confirmedBookingsThisMonth = await prisma.booking.findMany({
    where: {
      status: "confirmado",
      checkIn: { lt: end },
      checkOut: { gt: start },
    },
    select: { checkIn: true, checkOut: true },
  });

  const daysInMonth = Math.round(
    (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
  );
  const totalAvailableNights = propertyCount * daysInMonth;
  const bookedNights = confirmedBookingsThisMonth.reduce((sum, booking) => {
    const from = booking.checkIn < start ? start : booking.checkIn;
    const to = booking.checkOut > end ? end : booking.checkOut;
    const nights = Math.max(
      0,
      Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)),
    );
    return sum + nights;
  }, 0);
  const occupancyPercent =
    totalAvailableNights > 0
      ? Math.round((bookedNights / totalAvailableNights) * 100)
      : 0;

  return {
    pendingCount,
    confirmedThisMonth,
    occupancyPercent,
    unreadCount,
  };
}

// Ordenada por urgência — menor tempo restante primeiro (seção 4.5).
export function listPendingBookingsByUrgency() {
  return prisma.booking.findMany({
    where: { status: "pendente" },
    include: { property: true, user: true },
    orderBy: { expiresAt: "asc" },
  });
}

// Mistura todas as origens (seção 4.5).
export function listUpcomingCheckins(limit = 8) {
  return prisma.booking.findMany({
    where: { status: "confirmado", checkIn: { gte: new Date() } },
    include: { property: true, user: true },
    orderBy: { checkIn: "asc" },
    take: limit,
  });
}
