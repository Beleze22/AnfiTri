import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db/client";
import { sendMagicLinkEmail } from "@/lib/server/auth/email";
import { createMagicLinkToken } from "@/lib/server/auth/magic-link";
import { apiError, readJson } from "@/lib/server/http";
import { checkRateLimit, getClientIp } from "@/lib/server/rate-limit";

const GENERIC_RESPONSE = {
  message: "Se esse e-mail tiver reservas, enviamos um link de acesso.",
};

const magicLinkInput = z.object({ email: z.string().email() });

export async function POST(request: Request) {
  const parsed = magicLinkInput.safeParse(await readJson(request));
  if (!parsed.success) {
    return apiError("invalid_input", "Dados inválidos.", 400);
  }
  const email = parsed.data.email.toLowerCase();

  // Freia spam de e-mail: por IP (varrer muitos e-mails) e por e-mail
  // (bombardear uma vítima). Os limites valem para qualquer e-mail, exista
  // ou não — o 429 não revela cadastro.
  const ipAllowed = await checkRateLimit(
    "magic-link:ip",
    getClientIp(request),
    10,
    60 * 60,
  );
  const emailAllowed =
    ipAllowed && (await checkRateLimit("magic-link:email", email, 3, 15 * 60));
  if (!ipAllowed || !emailAllowed) {
    return apiError(
      "too_many_requests",
      "Muitas solicitações. Tente novamente em alguns minutos.",
      429,
    );
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  });

  if (user && user.role === "hospede") {
    const token = await createMagicLinkToken(user.id);
    const verifyUrl = new URL("/api/auth/magic-link/verify", request.url);
    verifyUrl.searchParams.set("token", token);
    await sendMagicLinkEmail(user.email, verifyUrl.toString());
  }

  return NextResponse.json(GENERIC_RESPONSE);
}
