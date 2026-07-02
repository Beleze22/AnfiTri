import { NextResponse } from "next/server";

import { apiError, requireSession } from "@/lib/server/http";
import { getHolidays } from "@/lib/server/pricing/holidays";

export async function GET(request: Request) {
  const session = await requireSession("gestor");
  if (!session) {
    return apiError("unauthorized", "Não autorizado.", 401);
  }

  const yearParam = new URL(request.url).searchParams.get("year");
  const year = yearParam ? Number(yearParam) : new Date().getFullYear();
  if (!Number.isInteger(year)) {
    return apiError("invalid_input", "Ano inválido.", 400);
  }

  const holidays = await getHolidays(year);
  return NextResponse.json(holidays);
}
