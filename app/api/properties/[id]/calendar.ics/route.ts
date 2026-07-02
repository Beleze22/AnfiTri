import { generatePropertyCalendar } from "@/lib/server/airbnb/export";

type RouteContext = { params: Promise<{ id: string }> };

// Endpoint público — é essa URL que o gestor cadastra no Airbnb como
// "calendário externo" (card "Nosso feed para o Airbnb" na Etapa 6).
export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const ics = await generatePropertyCalendar(id);

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": "inline; filename=calendar.ics",
    },
  });
}
