import { NextResponse } from "next/server";

import { apiError, requireSession } from "@/lib/server/http";
import { listAllPropertiesForManager } from "@/lib/server/properties/service";

export async function GET() {
  const session = await requireSession("gestor");
  if (!session) {
    return apiError("unauthorized", "Não autorizado.", 401);
  }

  const properties = await listAllPropertiesForManager();
  return NextResponse.json(
    properties.map((property) => ({
      id: property.id,
      title: property.title,
      slug: property.slug,
      status: property.status,
      basePrice: property.basePrice.toFixed(2),
    })),
  );
}
