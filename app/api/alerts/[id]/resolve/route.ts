import { NextResponse } from "next/server";

import { resolveAlert } from "@/lib/server/alerts";
import { apiError, requireSession } from "@/lib/server/http";

type RouteContext = { params: Promise<{ id: string }> };

// Marca o alerta como visto. Não mexe na reserva — se o gestor concluiu que a
// reserva foi mesmo cancelada no Airbnb, o cancelamento é uma ação separada,
// pelo painel de detalhes. Aqui ele só diz "já olhei isto".
export async function PATCH(_request: Request, { params }: RouteContext) {
  const session = await requireSession("gestor");
  if (!session) {
    return apiError("unauthorized", "Não autorizado.", 401);
  }

  const { id } = await params;
  const resolvido = await resolveAlert(id);
  if (!resolvido) {
    return apiError("not_found", "Alerta não encontrado ou já resolvido.", 404);
  }

  return NextResponse.json({ resolved: true });
}
