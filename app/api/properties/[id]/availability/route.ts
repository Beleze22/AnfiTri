import { NextResponse } from "next/server";

import { getOccupiedRanges } from "@/lib/server/booking/service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const ranges = await getOccupiedRanges(id);
  return NextResponse.json(
    ranges.map((range) => ({
      checkIn: range.checkIn.toISOString().slice(0, 10),
      checkOut: range.checkOut.toISOString().slice(0, 10),
    })),
  );
}
