import { prisma } from "@/lib/db/client";

const PLACEHOLDER_EMAIL = "reservas-airbnb@anfitri.internal";

// Reservas que chegam via Airbnb (e-mail ou iCal de backup) nem sempre têm
// contato do hóspede disponível de imediato — usamos um User placeholder
// até o gestor completar os dados manualmente, se precisar.
export async function getAirbnbPlaceholderGuest() {
  return prisma.user.upsert({
    where: { email: PLACEHOLDER_EMAIL },
    update: {},
    create: {
      name: "Hóspede via Airbnb",
      email: PLACEHOLDER_EMAIL,
      role: "hospede",
    },
  });
}
