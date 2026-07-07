import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db/client";
import { apiError, readJson, requireSession } from "@/lib/server/http";
import { listPublishedProperties } from "@/lib/server/properties/service";

const query = z.object({
  category: z.string().optional(),
  checkIn: z.coerce.date().optional(),
  checkOut: z.coerce.date().optional(),
});

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const parsed = query.safeParse({
    category: searchParams.get("category") ?? undefined,
    checkIn: searchParams.get("checkIn") ?? undefined,
    checkOut: searchParams.get("checkOut") ?? undefined,
  });

  if (!parsed.success) {
    return apiError("invalid_input", "Parâmetros inválidos.", 400);
  }

  if (
    parsed.data.checkIn &&
    parsed.data.checkOut &&
    parsed.data.checkIn >= parsed.data.checkOut
  ) {
    return apiError("invalid_input", "Datas inválidas.", 400);
  }

  const result = await listPublishedProperties(parsed.data);
  return NextResponse.json(result);
}

const createInput = z.object({
  title: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().min(1),
  location: z.string().min(1),
  category: z.string().min(1),
  maxGuests: z.coerce.number().int().positive(),
  bedrooms: z.coerce.number().int().min(0),
  basePrice: z.coerce.number().positive(),
});

export async function POST(request: Request) {
  const session = await requireSession("gestor");
  if (!session) {
    return apiError("unauthorized", "Não autorizado.", 401);
  }

  const parsed = createInput.safeParse(await readJson(request));
  if (!parsed.success) {
    return apiError("invalid_input", "Dados inválidos.", 400);
  }

  const property = await prisma.property.create({ data: parsed.data });
  return NextResponse.json(property, { status: 201 });
}
