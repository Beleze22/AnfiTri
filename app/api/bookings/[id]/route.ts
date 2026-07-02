import { NextResponse } from "next/server";

import { getBookingById } from "@/lib/server/booking/service";
import { apiError, requireSession } from "@/lib/server/http";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const session = await requireSession();
  if (!session) {
    return apiError("unauthorized", "Não autorizado.", 401);
  }

  const { id } = await params;
  const booking = await getBookingById(id);
  if (!booking) {
    return apiError("not_found", "Reserva não encontrada.", 404);
  }

  if (session.role === "hospede" && booking.userId !== session.sub) {
    return apiError("forbidden", "Sem acesso a essa reserva.", 403);
  }

  return NextResponse.json(booking);
}
