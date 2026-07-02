import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

import { processAirbnbEmails } from "@/lib/server/airbnb/email-service";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Não autorizado." } },
      { status: 401 },
    );
  }

  const debug = new URL(request.url).searchParams.get("debug") === "true";
  const result = await processAirbnbEmails(debug);
  return NextResponse.json({ ...result, debug });
}
