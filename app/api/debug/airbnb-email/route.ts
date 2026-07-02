import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

import { apiError, requireSession } from "@/lib/server/http";
import {
  extractEmailBody,
  fetchEmailsForDebug,
} from "@/lib/server/airbnb/gmail";
import { parseAirbnbConfirmationEmail } from "@/lib/server/airbnb/email-parser";

// Rota de depuração (gestor) — mostra os e-mails brutos que chegaram
// correspondendo à query do Airbnb, com o que o parser conseguiu extrair.
// Indispensável para afinar os regex com o e-mail modelo real.
export async function GET() {
  const session = await requireSession("gestor");
  if (!session) {
    return apiError("unauthorized", "Não autorizado.", 401);
  }

  const { messages } = await fetchEmailsForDebug();

  const result = messages.map((message) => {
    const headers = message.payload?.headers ?? [];
    const subject =
      headers.find((h) => h.name?.toLowerCase() === "subject")?.value ?? "";
    const from =
      headers.find((h) => h.name?.toLowerCase() === "from")?.value ?? "";
    const body = extractEmailBody(message);
    const parsed = parseAirbnbConfirmationEmail(body, subject);

    return {
      id: message.id,
      from,
      subject,
      bodySnippet: body.slice(0, 800),
      parsed: {
        airbnbRef: parsed.airbnbRef,
        checkIn: parsed.checkIn?.toISOString().slice(0, 10) ?? null,
        checkOut: parsed.checkOut?.toISOString().slice(0, 10) ?? null,
      },
    };
  });

  return NextResponse.json({ count: result.length, messages: result });
}
