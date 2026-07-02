import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError } from "@/lib/server/http";
import { calculatePriceForStay } from "@/lib/server/pricing/calculate";

const query = z.object({
  checkIn: z.coerce.date(),
  checkOut: z.coerce.date(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const searchParams = new URL(request.url).searchParams;
  const parsed = query.safeParse({
    checkIn: searchParams.get("checkIn"),
    checkOut: searchParams.get("checkOut"),
  });

  if (!parsed.success || parsed.data.checkIn >= parsed.data.checkOut) {
    return apiError("invalid_input", "Datas inválidas.", 400);
  }

  const { total, nights } = await calculatePriceForStay(
    id,
    parsed.data.checkIn,
    parsed.data.checkOut,
  );

  return NextResponse.json({
    total: total.toFixed(2),
    nights: nights.map((night) => ({
      date: night.date.toISOString().slice(0, 10),
      price: night.price.toFixed(2),
      appliedRules: night.appliedRules,
    })),
  });
}
