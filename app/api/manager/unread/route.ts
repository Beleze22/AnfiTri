import { NextResponse } from "next/server";

import { prisma } from "@/lib/db/client";
import { countOpenAlerts } from "@/lib/server/alerts";
import { apiError, requireSession } from "@/lib/server/http";

// Contadores da navegação do gestor (Sidebar), que faz polling leve desta
// rota: mensagens de hóspede não lidas e alertas de integração em aberto.
// Os dois viajam juntos para o polling continuar sendo uma requisição só.
export async function GET() {
  const session = await requireSession("gestor");
  if (!session) {
    return apiError("unauthorized", "Não autorizado.", 401);
  }

  const [unread, alerts] = await Promise.all([
    prisma.message.count({
      where: { read: false, sender: { role: "hospede" } },
    }),
    countOpenAlerts(),
  ]);

  return NextResponse.json({ unread, alerts });
}
