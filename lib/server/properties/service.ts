import { prisma } from "@/lib/db/client";
import { calculateNightPrices } from "@/lib/server/pricing/calculate";

export function getPropertyBySlug(slug: string) {
  return prisma.property.findFirst({
    where: { slug, status: "publicada" },
    include: {
      // Capa primeiro: é a foto de abertura do carrossel na página pública.
      photos: { orderBy: [{ isCover: "desc" }, { order: "asc" }] },
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
    include: {
      // A thumb do card é a foto de capa; sem capa marcada, a primeira na
      // ordem definida pelo gestor.
      photos: { orderBy: [{ isCover: "desc" }, { order: "asc" }], take: 1 },
    },
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
    include: {
      // Card da vitrine mostra a foto de capa, como a lista do gestor.
      photos: { orderBy: [{ isCover: "desc" }, { order: "asc" }], take: 1 },
    },
    orderBy: { title: "asc" },
  });

  if (!params.checkIn || !params.checkOut) {
    return { withDates: false as const, properties };
  }

  const checkIn = params.checkIn;
  const checkOut = params.checkOut;

  // Duas queries em lote (conflitos + regras) em vez de duas por propriedade —
  // a vitrine é a página mais acessada e crescia linearmente em round-trips.
  const conflicts = await prisma.booking.findMany({
    where: {
      propertyId: { in: properties.map((property) => property.id) },
      status: { in: ["pendente", "confirmado"] },
      checkIn: { lt: checkOut },
      checkOut: { gt: checkIn },
    },
    select: { propertyId: true },
  });
  const unavailableIds = new Set(conflicts.map((c) => c.propertyId));

  const availableProperties = properties.filter(
    (property) => !unavailableIds.has(property.id),
  );
  const unavailable = properties.filter((property) =>
    unavailableIds.has(property.id),
  );

  const rules = await prisma.priceRule.findMany({
    where: {
      propertyId: { in: availableProperties.map((property) => property.id) },
      startDate: { lte: checkOut },
      endDate: { gte: checkIn },
    },
  });
  const rulesByProperty = new Map<string, typeof rules>();
  for (const rule of rules) {
    const group = rulesByProperty.get(rule.propertyId) ?? [];
    group.push(rule);
    rulesByProperty.set(rule.propertyId, group);
  }

  const available = availableProperties.map((property) => {
    const { total } = calculateNightPrices(
      property.basePrice,
      rulesByProperty.get(property.id) ?? [],
      checkIn,
      checkOut,
    );
    return { ...property, totalPrice: total.toFixed(2) };
  });

  return { withDates: true as const, available, unavailable };
}
