import { NextResponse } from "next/server";

import { listOpenAlerts } from "@/lib/server/alerts";
import { apiError, requireSession } from "@/lib/server/http";

export async function GET() {
  const session = await requireSession("gestor");
  if (!session) {
    return apiError("unauthorized", "Não autorizado.", 401);
  }

  const alerts = await listOpenAlerts();
  return NextResponse.json(
    alerts.map((alert) => ({
      id: alert.id,
      kind: alert.kind,
      title: alert.title,
      detail: alert.detail,
      createdAt: alert.createdAt.toISOString(),
      booking: alert.booking
        ? {
            id: alert.booking.id,
            status: alert.booking.status,
            checkIn: alert.booking.checkIn.toISOString().slice(0, 10),
            checkOut: alert.booking.checkOut.toISOString().slice(0, 10),
            propertyTitle: alert.booking.property.title,
          }
        : null,
    })),
  );
}
