import Stripe from "stripe";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/client";

// Pagamento "à la Airbnb" com captura manual: o cartão do hóspede é
// AUTORIZADO no checkout (retenção, sem cobrança) e só é CAPTURADO quando o
// gestor aprova a reserva. Recusa/expiração libera a retenção sem cobrar.
// A retenção de cartão vale 7 dias — muito acima do prazo de expiração de
// pedidos da plataforma (horas).
//
// Feature flag: sem STRIPE_SECRET_KEY, nada disso roda e o fluxo de reserva
// segue sem pagamento, como antes.

export class PaymentError extends Error {}

export function isPaymentsEnabled() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

const DATE_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  timeZone: "UTC",
});

// Cria a sessão de checkout do pedido e registra o Payment (aguardando).
// Retorna a URL para onde o hóspede é redirecionado após solicitar.
export async function createBookingCheckout(input: {
  bookingId: string;
  propertyId: string;
  totalPrice: Prisma.Decimal;
  guestEmail: string;
  checkIn: Date;
  checkOut: Date;
  origin: string;
}) {
  const property = await prisma.property.findUniqueOrThrow({
    where: { id: input.propertyId },
    select: { title: true, slug: true },
  });

  const amountCents = Math.round(input.totalPrice.toNumber() * 100);
  const period = `${DATE_FORMATTER.format(input.checkIn)} – ${DATE_FORMATTER.format(input.checkOut)}`;

  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    payment_intent_data: {
      capture_method: "manual",
      metadata: { bookingId: input.bookingId },
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "brl",
          unit_amount: amountCents,
          product_data: {
            name: property.title,
            description: `Reserva ${period}`,
          },
        },
      },
    ],
    customer_email: input.guestEmail,
    metadata: { bookingId: input.bookingId },
    success_url: `${input.origin}/reservas/sucesso?bookingId=${input.bookingId}`,
    cancel_url: `${input.origin}/hospedagens/${property.slug}?checkout=cancelado`,
  });

  await prisma.payment.create({
    data: {
      bookingId: input.bookingId,
      checkoutSessionId: session.id,
      amount: input.totalPrice,
      status: "aguardando",
    },
  });

  return session.url;
}

// Webhook: hóspede concluiu o checkout — cartão autorizado, cobrança retida.
export async function markCheckoutCompleted(session: {
  id: string;
  payment_intent: string | Stripe.PaymentIntent | null;
}) {
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);

  await prisma.payment.updateMany({
    where: { checkoutSessionId: session.id, status: "aguardando" },
    data: { status: "autorizado", paymentIntentId },
  });
}

// Webhook: sessão de checkout expirou sem o hóspede concluir.
export async function markCheckoutExpired(sessionId: string) {
  await prisma.payment.updateMany({
    where: { checkoutSessionId: sessionId, status: "aguardando" },
    data: { status: "cancelado" },
  });
}

// Captura a cobrança na aprovação do gestor. Lança PaymentError se a captura
// falhar (cartão recusado na efetivação, retenção vencida etc.).
export async function captureBookingPayment(bookingId: string) {
  const payment = await prisma.payment.findUnique({ where: { bookingId } });
  if (!payment || payment.status !== "autorizado" || !payment.paymentIntentId) {
    return;
  }

  try {
    await getStripe().paymentIntents.capture(payment.paymentIntentId);
  } catch (error) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: "falhou" },
    });
    console.error(`[payments] captura falhou (booking ${bookingId}):`, error);
    throw new PaymentError(
      "Não foi possível efetivar a cobrança no cartão do hóspede.",
    );
  }

  await prisma.payment.update({
    where: { id: payment.id },
    data: { status: "pago" },
  });
}

// Libera o dinheiro do hóspede na recusa/expiração: retenção autorizada é
// cancelada; pagamento já capturado é estornado integralmente; checkout
// aberto é expirado para o hóspede não pagar um pedido que já morreu.
export async function releaseBookingPayment(bookingId: string) {
  const payment = await prisma.payment.findUnique({ where: { bookingId } });
  if (!payment || payment.status === "cancelado") return;

  const stripe = getStripe();
  if (payment.status === "aguardando" && payment.checkoutSessionId) {
    try {
      await stripe.checkout.sessions.expire(payment.checkoutSessionId);
    } catch {
      // Sessão já expirada/concluída — o webhook trata o outro caminho.
    }
  } else if (payment.status === "autorizado" && payment.paymentIntentId) {
    await stripe.paymentIntents.cancel(payment.paymentIntentId);
  } else if (payment.status === "pago" && payment.paymentIntentId) {
    await stripe.refunds.create({ payment_intent: payment.paymentIntentId });
  }

  await prisma.payment.update({
    where: { id: payment.id },
    data: { status: "cancelado" },
  });
}
