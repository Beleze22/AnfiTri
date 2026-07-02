import { NextResponse } from "next/server";

import {
  listAllBookings,
  listBookingsForUser,
} from "@/lib/server/booking/service";
import { apiError, requireSession } from "@/lib/server/http";

// Gestor vê todas as reservas (visão consolidada, seção 8.2); hóspede vê só
// as próprias (seção 8.1, "Minhas reservas").
export async function GET() {
  const session = await requireSession();
  if (!session) {
    return apiError("unauthorized", "Não autorizado.", 401);
  }

  const bookings =
    session.role === "gestor"
      ? await listAllBookings()
      : await listBookingsForUser(session.sub);

  return NextResponse.json(bookings);
}
