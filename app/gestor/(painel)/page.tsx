import { DashboardView } from "@/components/manager/DashboardView";
import {
  getDashboardMetrics,
  listPendingBookingsByUrgency,
  listUpcomingCheckins,
} from "@/lib/server/dashboard";

function serializeBooking(booking: {
  id: string;
  checkIn: Date;
  checkOut: Date;
  totalPrice: { toFixed: (n: number) => string } | null;
  expiresAt: Date | null;
  source: "airbnb" | "manual" | "site";
  property: { title: string };
  user: { name: string };
}) {
  return {
    id: booking.id,
    checkIn: booking.checkIn.toISOString(),
    checkOut: booking.checkOut.toISOString(),
    totalPrice: booking.totalPrice ? booking.totalPrice.toFixed(2) : null,
    expiresAt: booking.expiresAt ? booking.expiresAt.toISOString() : null,
    source: booking.source,
    property: { title: booking.property.title },
    user: { name: booking.user.name },
  };
}

export default async function GestorDashboardPage() {
  const [metrics, pending, upcoming] = await Promise.all([
    getDashboardMetrics(),
    listPendingBookingsByUrgency(),
    listUpcomingCheckins(),
  ]);

  return (
    <DashboardView
      metrics={metrics}
      pending={pending.map(serializeBooking)}
      upcoming={upcoming.map(serializeBooking)}
    />
  );
}
