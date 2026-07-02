import { NextResponse } from "next/server";

import { expireOverdueBookings } from "@/lib/server/booking/service";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Não autorizado." } },
      { status: 401 },
    );
  }

  const count = await expireOverdueBookings();
  return NextResponse.json({ expired: count });
}
