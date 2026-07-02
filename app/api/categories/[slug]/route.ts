import { NextResponse } from "next/server";

import { apiError, requireSession } from "@/lib/server/http";
import { getCategories, saveCategories } from "@/lib/server/categories";

type RouteContext = { params: Promise<{ slug: string }> };

export async function DELETE(_request: Request, { params }: RouteContext) {
  const session = await requireSession("gestor");
  if (!session) {
    return apiError("unauthorized", "Não autorizado.", 401);
  }

  const { slug } = await params;
  const categories = await getCategories();
  const updated = categories.filter((c) => c.slug !== slug);

  if (updated.length === categories.length) {
    return apiError("not_found", "Categoria não encontrada.", 404);
  }

  await saveCategories(updated);
  return NextResponse.json(updated);
}
