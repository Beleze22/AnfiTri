import { prisma } from "@/lib/db/client";

const CONFIG_KEY = "property_categories";

export type Category = { slug: string; label: string };

const DEFAULTS: Category[] = [
  { slug: "praia", label: "Praia" },
  { slug: "montanha", label: "Montanha/Serra" },
  { slug: "campo", label: "Campo/Rural" },
  { slug: "urbano", label: "Urbano/Cidade" },
  { slug: "lago", label: "Lago/Represa" },
  { slug: "outro", label: "Outro" },
];

export async function getCategories(): Promise<Category[]> {
  const config = await prisma.systemConfig.findUnique({
    where: { key: CONFIG_KEY },
  });
  if (!config) return DEFAULTS;
  try {
    return JSON.parse(config.value) as Category[];
  } catch {
    return DEFAULTS;
  }
}

export async function saveCategories(categories: Category[]) {
  await prisma.systemConfig.upsert({
    where: { key: CONFIG_KEY },
    update: { value: JSON.stringify(categories) },
    create: { id: `config-${CONFIG_KEY}`, key: CONFIG_KEY, value: JSON.stringify(categories) },
  });
}
