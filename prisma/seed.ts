import { hashSync } from "bcryptjs";

import { prisma } from "../lib/db/client";

const GESTOR_SEED_PASSWORD = "mudar123";

async function main() {
  const gestor = await prisma.user.upsert({
    where: { email: "beleze.dev@gmail.com" },
    update: {},
    create: {
      name: "Gestor (teste)",
      email: "beleze.dev@gmail.com",
      role: "gestor",
      passwordHash: hashSync(GESTOR_SEED_PASSWORD, 10),
      defaultExpiryHours: 6,
      quietHoursStart: new Date("1970-01-01T22:00:00Z"),
      quietHoursEnd: new Date("1970-01-01T07:00:00Z"),
      gracePeriodHours: 2,
    },
  });

  await prisma.property.upsert({
    where: { slug: "casa-de-teste-1" },
    update: {},
    create: {
      title: "Casa de Teste 1",
      slug: "casa-de-teste-1",
      description: "Hospedagem de teste usada durante o desenvolvimento.",
      maxGuests: 4,
      bedrooms: 2,
      basePrice: 250,
      status: "publicada",
      amenities: {
        create: [
          { name: "Wi-Fi", icon: "wifi" },
          { name: "Piscina", icon: "pool" },
        ],
      },
    },
  });

  await prisma.property.upsert({
    where: { slug: "apartamento-de-teste-2" },
    update: {},
    create: {
      title: "Apartamento de Teste 2",
      slug: "apartamento-de-teste-2",
      description: "Hospedagem de teste usada durante o desenvolvimento.",
      maxGuests: 2,
      bedrooms: 1,
      basePrice: 180,
      status: "publicada",
      amenities: {
        create: [
          { name: "Wi-Fi", icon: "wifi" },
          { name: "Estacionamento", icon: "parking" },
        ],
      },
    },
  });

  console.log("Seed concluído. Login do gestor de teste:");
  console.log(`  email: ${gestor.email}`);
  console.log(`  senha: ${GESTOR_SEED_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
