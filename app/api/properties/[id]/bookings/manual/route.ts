import { NextResponse } from "next/server";
import { z } from "zod";

import {
  BookingConflictError,
  createManualBooking,
} from "@/lib/server/booking/service";
import { apiError, readJson, requireSession } from "@/lib/server/http";

// Reserva lançada pelo gestor (telefone, WhatsApp, conhecido pessoal). Fica
// separada do POST público de /bookings porque aquele não pede sessão: juntar
// as duas na mesma rota deixaria o caminho autenticado a um `if` de distância
// de virar público. O serviço já existia desde a Etapa 6 sem rota que o
// chamasse.
const manualBookingInput = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1).optional(),
  checkIn: z.coerce.date(),
  checkOut: z.coerce.date(),
  status: z.enum(["pendente", "confirmado"]).optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const session = await requireSession("gestor");
  if (!session) {
    return apiError("unauthorized", "Não autorizado.", 401);
  }

  const { id } = await params;
  const parsed = manualBookingInput.safeParse(await readJson(request));
  if (!parsed.success || parsed.data.checkIn >= parsed.data.checkOut) {
    return apiError("invalid_input", "Dados inválidos.", 400);
  }

  try {
    const booking = await createManualBooking({
      propertyId: id,
      ...parsed.data,
    });
    return NextResponse.json(booking, { status: 201 });
  } catch (error) {
    if (error instanceof BookingConflictError) {
      return apiError("booking_conflict", error.message, 409);
    }
    throw error;
  }
}
