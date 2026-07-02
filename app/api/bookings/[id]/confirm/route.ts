import { NextResponse } from "next/server";

import {
  confirmBooking,
  InvalidTransitionError,
} from "@/lib/server/booking/service";
import { apiError, requireSession } from "@/lib/server/http";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(_request: Request, { params }: RouteContext) {
  const session = await requireSession("gestor");
  if (!session) {
    return apiError("unauthorized", "Não autorizado.", 401);
  }

  const { id } = await params;
  try {
    const booking = await confirmBooking(id);
    return NextResponse.json(booking);
  } catch (error) {
    if (error instanceof InvalidTransitionError) {
      return apiError("invalid_transition", error.message, 409);
    }
    throw error;
  }
}
