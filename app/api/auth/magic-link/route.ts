import { NextResponse } from "next/server";

import { prisma } from "@/lib/db/client";
import { sendMagicLinkEmail } from "@/lib/server/auth/email";
import { createMagicLinkToken } from "@/lib/server/auth/magic-link";

const GENERIC_RESPONSE = {
  message: "Se esse e-mail tiver reservas, enviamos um link de acesso.",
};

export async function POST(request: Request) {
  const { email } = await request.json();

  if (typeof email !== "string") {
    return NextResponse.json(
      { error: { code: "invalid_input", message: "Dados inválidos." } },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (user && user.role === "hospede") {
    const token = await createMagicLinkToken(user.id);
    const verifyUrl = new URL("/api/auth/magic-link/verify", request.url);
    verifyUrl.searchParams.set("token", token);
    await sendMagicLinkEmail(user.email, verifyUrl.toString());
  }

  return NextResponse.json(GENERIC_RESPONSE);
}
