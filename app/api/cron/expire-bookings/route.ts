import { NextResponse } from "next/server";

import { expireOverdueBookings } from "@/lib/server/booking/service";
import { cleanupExpiredRateLimits } from "@/lib/server/rate-limit";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Não autorizado." } },
      { status: 401 },
    );
  }

  const count = await expireOverdueBookings();
  // Aproveita o cron de 15 min para varrer contadores de rate limit vencidos.
  const cleanedRateLimits = await cleanupExpiredRateLimits();
  return NextResponse.json({ expired: count, cleanedRateLimits });
}
