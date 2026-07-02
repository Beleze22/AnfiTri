import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, requireSession } from "@/lib/server/http";
import { getWeekCalendar } from "@/lib/server/calendar";
import { startOfWeek } from "@/lib/shared/dates";

const query = z.object({ weekStart: z.coerce.date().optional() });

export async function GET(request: Request) {
  const session = await requireSession("gestor");
  if (!session) {
    return apiError("unauthorized", "Não autorizado.", 401);
  }

  const parsed = query.safeParse({
    weekStart: new URL(request.url).searchParams.get("weekStart") ?? undefined,
  });
  if (!parsed.success) {
    return apiError("invalid_input", "Parâmetros inválidos.", 400);
  }

  const weekStart = startOfWeek(parsed.data.weekStart ?? new Date());
  const properties = await getWeekCalendar(weekStart);

  return NextResponse.json({
    weekStart: weekStart.toISOString().slice(0, 10),
    properties: properties.map((property) => ({
      id: property.id,
      title: property.title,
      bookings: property.bookings.map((booking) => ({
        id: booking.id,
        checkIn: booking.checkIn.toISOString().slice(0, 10),
        checkOut: booking.checkOut.toISOString().slice(0, 10),
        status: booking.status,
        source: booking.source,
        userName: booking.user.name,
      })),
    })),
  });
}
