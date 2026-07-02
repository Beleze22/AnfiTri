
import { prisma } from "@/lib/db/client";
import { isAvailable } from "@/lib/server/booking/service";
import { calculatePriceForStay } from "@/lib/server/pricing/calculate";

export function getPropertyBySlug(slug: string) {
  return prisma.property.findFirst({
    where: { slug, status: "publicada" },
    include: {
      photos: { orderBy: { order: "asc" } },
      amenities: true,
    },
  });
}

export function getPropertyById(id: string) {
  return prisma.property.findUnique({
    where: { id },
    include: {
      photos: { orderBy: { order: "asc" } },
      amenities: true,
    },
  });
}

// Listagem para a área do gestor — qualquer status (rascunho/publicada/
// pausada), diferente da vitrine pública que só mostra publicadas.
export function listAllPropertiesForManager() {
  return prisma.property.findMany({
    orderBy: { title: "asc" },
    include: { photos: { orderBy: { order: "asc" }, take: 1 } },
  });
}

// Vitrine pública (seção 3.5 do doc de design):
// - sem datas: lista simples, sem badge de disponibilidade.
// - com datas: separada em disponíveis (com preço total do período) e
//   indisponíveis (lista compacta).
export async function listPublishedProperties(params: {
  category?: string;
  checkIn?: Date;
  checkOut?: Date;
}) {
  const properties = await prisma.property.findMany({
    where: {
      status: "publicada",
      ...(params.category ? { category: params.category } : {}),
    },
    include: { photos: { orderBy: { order: "asc" }, take: 1 } },
    orderBy: { title: "asc" },
  });

  if (!params.checkIn || !params.checkOut) {
    return { withDates: false as const, properties };
  }

  const checkIn = params.checkIn;
  const checkOut = params.checkOut;

  const available: ((typeof properties)[number] & { totalPrice: string })[] =
    [];
  const unavailable: typeof properties = [];

  for (const property of properties) {
    if (await isAvailable(property.id, checkIn, checkOut)) {
      const { total } = await calculatePriceForStay(
        property.id,
        checkIn,
        checkOut,
      );
      available.push({ ...property, totalPrice: total.toFixed(2) });
    } else {
      unavailable.push(property);
    }
  }

  return { withDates: true as const, available, unavailable };
}
