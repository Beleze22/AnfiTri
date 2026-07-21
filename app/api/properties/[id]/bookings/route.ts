import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  BookingConflictError,
  createSiteBooking,
  listBookingsForProperty,
} from "@/lib/server/booking/service";
import { sendMagicLinkEmail } from "@/lib/server/auth/email";
import { createMagicLinkToken } from "@/lib/server/auth/magic-link";
import {
  GUEST_SESSION_DURATION,
  GUEST_SESSION_MAX_AGE_SECONDS,
  SESSION_COOKIE,
  signSession,
} from "@/lib/server/auth/jwt";
import { getSession } from "@/lib/server/auth/session";
import { apiError, readJson, requireSession } from "@/lib/server/http";
import {
  createBookingCheckout,
  isPaymentsEnabled,
} from "@/lib/server/payments/stripe";
import { checkRateLimit, getClientIp } from "@/lib/server/rate-limit";

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

// Cria a reserva pendente do fluxo público (seção 6.1). Só autentica na hora
// quando o e-mail é novo (a conta acabou de nascer, não há nada a proteger);
// para e-mail já cadastrado a posse precisa ser provada via magic link —
// emitir sessão direto permitiria assumir a conta de qualquer hóspede só
// conhecendo o e-mail dele.
export async function POST(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const parsed = createBookingInput.safeParse(await readJson(request));
  if (!parsed.success || parsed.data.checkIn >= parsed.data.checkOut) {
    return apiError("invalid_input", "Dados inválidos.", 400);
  }

  // Cada pendente bloqueia a data por horas — sem limite, reservas falsas
  // em série viram DoS de calendário.
  const allowed = await checkRateLimit(
    "booking",
    getClientIp(request),
    5,
    60 * 60,
  );
  if (!allowed) {
    return apiError(
      "too_many_requests",
      "Muitas solicitações de reserva. Tente novamente mais tarde.",
      429,
    );
  }

  try {
    const { booking, guest, isNewUser } = await createSiteBooking({
      propertyId: id,
      ...parsed.data,
    });

    // Hóspede que já está logado como o dono do e-mail não precisa de nada.
    const currentSession = await getSession();
    const alreadyAuthenticated = currentSession?.sub === guest.id;

    if (isNewUser) {
      const session = await signSession(
        { sub: guest.id, role: "hospede" },
        GUEST_SESSION_DURATION,
      );
      (await cookies()).set(SESSION_COOKIE, session, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: GUEST_SESSION_MAX_AGE_SECONDS,
      });
    } else if (!alreadyAuthenticated) {
      const token = await createMagicLinkToken(guest.id);
      const verifyUrl = new URL("/api/auth/magic-link/verify", request.url);
      verifyUrl.searchParams.set("token", token);
      await sendMagicLinkEmail(guest.email, verifyUrl.toString());
    }

    // Com o Stripe configurado, o pedido segue para o checkout: o cartão é
    // autorizado agora e cobrado só na aprovação do gestor (fluxo Airbnb).
    let checkoutUrl: string | null = null;
    if (isPaymentsEnabled() && booking.totalPrice) {
      checkoutUrl = await createBookingCheckout({
        bookingId: booking.id,
        propertyId: id,
        totalPrice: booking.totalPrice,
        guestEmail: guest.email,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        origin: new URL(request.url).origin,
      });
    }

    return NextResponse.json(
      {
        ...booking,
        authenticated: isNewUser || alreadyAuthenticated,
        checkoutUrl,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof BookingConflictError) {
      return apiError("booking_conflict", error.message, 409);
    }
    throw error;
  }
}
