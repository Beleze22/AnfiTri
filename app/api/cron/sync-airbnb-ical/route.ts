import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

import { syncAllPropertiesFromAirbnbIcal } from "@/lib/server/airbnb/import";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Não autorizado." } },
      { status: 401 },
    );
  }

  const { created, failed } = await syncAllPropertiesFromAirbnbIcal();
  return NextResponse.json({ created, failed });
}
