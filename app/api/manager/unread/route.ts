import { NextResponse } from "next/server";

import { prisma } from "@/lib/db/client";
import { apiError, requireSession } from "@/lib/server/http";

// Contador global de mensagens de hóspede não lidas — alimenta a bolinha na
// navegação do gestor (Sidebar), que faz polling leve desta rota.
export async function GET() {
  const session = await requireSession("gestor");
  if (!session) {
    return apiError("unauthorized", "Não autorizado.", 401);
  }

  const unread = await prisma.message.count({
    where: { read: false, sender: { role: "hospede" } },
  });

  return NextResponse.json({ unread });
}
