import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, readJson, requireSession } from "@/lib/server/http";
import { getCategories, saveCategories } from "@/lib/server/categories";

// Leitura pública — usada pela Home (chips de filtro) e formulários de
// cadastro, sem precisar de autenticação.
export async function GET() {
  const categories = await getCategories();
  return NextResponse.json(categories);
}

const categoryInput = z.object({
  label: z.string().min(1).max(40),
});

function slugify(label: string) {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function POST(request: Request) {
  const session = await requireSession("gestor");
  if (!session) {
    return apiError("unauthorized", "Não autorizado.", 401);
  }

  const parsed = categoryInput.safeParse(await readJson(request));
  if (!parsed.success) {
    return apiError("invalid_input", "Dados inválidos.", 400);
  }

  const categories = await getCategories();
  const slug = slugify(parsed.data.label);

  if (categories.some((c) => c.slug === slug)) {
    return apiError("conflict", "Essa categoria já existe.", 409);
  }

  categories.push({ slug, label: parsed.data.label });
  await saveCategories(categories);
  return NextResponse.json(categories, { status: 201 });
}
