import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  BookingConflictError,
  createSiteBooking,
  listBookingsForProperty,
} from "@/lib/server/booking/service";
import {
  GUEST_SESSION_DURATION,
  SESSION_COOKIE,
  signSession,
} from "@/lib/server/auth/jwt";
import { apiError, requireSession } from "@/lib/server/http";

const createBookingInput = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1).optional(),
  checkIn: z.coerce.date(),
  checkOut: z.coerce.date(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const session = await requireSession("gestor");
  if (!session) {
    return apiError("unauthorized", "Não autorizado.", 401);
  }

  const { id } = await params;
  const bookings = await listBookingsForProperty(id);
  return NextResponse.json(bookings);
}

// Cria a reserva pendente do fluxo público (seção 6.1) e já autentica o
// hóspede na hora (sessão por magic link só é necessária em visitas
// futuras — ver discussão da Etapa 3).
export async function POST(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const parsed = createBookingInput.safeParse(await request.json());
  if (!parsed.success || parsed.data.checkIn >= parsed.data.checkOut) {
    return apiError("invalid_input", "Dados inválidos.", 400);
  }

  try {
    const { booking, guest } = await createSiteBooking({
      propertyId: id,
      ...parsed.data,
    });

    const session = await signSession(
      { sub: guest.id, role: "hospede" },
      GUEST_SESSION_DURATION,
    );
    (await cookies()).set(SESSION_COOKIE, session, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 60,
    });

    return NextResponse.json(booking, { status: 201 });
  } catch (error) {
    if (error instanceof BookingConflictError) {
      return apiError("booking_conflict", error.message, 409);
    }
    throw error;
  }
}
