import { NextResponse } from "next/server";

import { prisma } from "@/lib/db/client";
import {
  cancelBooking,
  InvalidTransitionError,
} from "@/lib/server/booking/service";
import { apiError, requireSession } from "@/lib/server/http";
import { avisarGestorCancelamentoDoHospede } from "@/lib/server/notifications/booking-email";

type RouteContext = { params: Promise<{ id: string }> };

// Cancelamento serve a dois papéis, com alcances diferentes: o gestor desfaz
// pendente ou confirmada; o hóspede só desiste da própria reserva e só
// enquanto ela está pendente. Depois de confirmada há compromisso firmado dos
// dois lados, e desfazer vira negociação, não um botão.
export async function PATCH(_request: Request, { params }: RouteContext) {
  const session = await requireSession();
  if (!session) {
    return apiError("unauthorized", "Não autorizado.", 401);
  }

  const { id } = await params;
  const doHospede = session.role === "hospede";

  if (doHospede) {
    const booking = await prisma.booking.findUnique({
      where: { id },
      select: { userId: true },
    });
    if (!booking) {
      return apiError("not_found", "Reserva não encontrada.", 404);
    }
    if (booking.userId !== session.sub) {
      return apiError("forbidden", "Sem acesso a essa reserva.", 403);
    }
  } else if (session.role !== "gestor") {
    // Proprietário tem acesso somente leitura.
    return apiError("unauthorized", "Não autorizado.", 401);
  }

  try {
    const booking = await cancelBooking(id, { somentePendente: doHospede });
    if (doHospede) {
      // A data volta ao mercado sem o gestor saber; sem este aviso ele só
      // descobriria ao abrir o painel.
      await avisarGestorCancelamentoDoHospede(id);
    }
    return NextResponse.json(booking);
  } catch (error) {
    if (error instanceof InvalidTransitionError) {
      return apiError("invalid_transition", error.message, 409);
    }
    throw error;
  }
}
