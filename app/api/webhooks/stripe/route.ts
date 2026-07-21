import Stripe from "stripe";
import { NextResponse } from "next/server";

import { apiError } from "@/lib/server/http";
import {
  markCheckoutCompleted,
  markCheckoutExpired,
} from "@/lib/server/payments/stripe";

// Webhook do Stripe — é ele que confirma a autorização do cartão, sem
// depender do navegador do hóspede. A assinatura garante que a chamada veio
// do Stripe (configurar o endpoint no dashboard com os eventos
// checkout.session.completed e checkout.session.expired).
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const key = process.env.STRIPE_SECRET_KEY;
  const signature = request.headers.get("stripe-signature");
  if (!secret || !key || !signature) {
    return apiError("invalid_signature", "Assinatura ausente.", 400);
  }

  let event: Stripe.Event;
  try {
    event = new Stripe(key).webhooks.constructEvent(
      await request.text(),
      signature,
      secret,
    );
  } catch {
    return apiError("invalid_signature", "Assinatura inválida.", 400);
  }

  switch (event.type) {
    case "checkout.session.completed":
      await markCheckoutCompleted(event.data.object);
      break;
    case "checkout.session.expired":
      await markCheckoutExpired(event.data.object.id);
      break;
  }

  return NextResponse.json({ received: true });
}
