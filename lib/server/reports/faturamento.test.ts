import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/client";
import { getFaturamento } from "@/lib/server/reports/faturamento";

// Integração: o relatório é praticamente todo consulta agregada, e o que
// precisa de garantia é a matemática da cascata e o isolamento entre
// proprietários. Ver vitest.setup.ts sobre TEST_DATABASE_URL.
const temBanco = Boolean(process.env.TEST_DATABASE_URL);

const dia = (iso: string) => new Date(`${iso}T00:00:00Z`);
const MES = { de: dia("2027-03-01"), ate: dia("2027-04-01") };

async function limpar() {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE alerts, messages, conversations, payments, bookings,
     price_rules, amenities, photos, properties, magic_link_tokens, users
     RESTART IDENTITY CASCADE`,
  );
}

async function dono(email: string) {
  return prisma.user.create({
    data: { name: `Dono ${email}`, email, role: "proprietario" },
  });
}

async function imovel(opts: {
  slug: string;
  ownerId?: string;
  comissao?: number;
}) {
  return prisma.property.create({
    data: {
      title: `Imóvel ${opts.slug}`,
      slug: opts.slug,
      description: "…",
      maxGuests: 2,
      bedrooms: 1,
      basePrice: 200,
      status: "publicada",
      ownerId: opts.ownerId,
      managementFeePercent: opts.comissao,
    },
  });
}

async function reserva(opts: {
  propertyId: string;
  bruto: number;
  taxa: number;
  checkIn: string;
  checkOut: string;
}) {
  const hospede = await prisma.user.upsert({
    where: { email: "hospede@teste.local" },
    update: {},
    create: {
      name: "Hóspede",
      email: "hospede@teste.local",
      role: "hospede",
    },
  });
  return prisma.booking.create({
    data: {
      propertyId: opts.propertyId,
      userId: hospede.id,
      checkIn: dia(opts.checkIn),
      checkOut: dia(opts.checkOut),
      source: "airbnb",
      status: "confirmado",
      totalPrice: opts.bruto,
      platformFee: opts.taxa,
      netAmount: opts.bruto - opts.taxa,
    },
  });
}

describe.skipIf(!temBanco)("cascata financeira", () => {
  beforeEach(limpar);

  it("comissão incide sobre o líquido, não sobre o bruto", async () => {
    const p = await imovel({ slug: "a", comissao: 20 });
    // Números do e-mail real do Airbnb: 390 bruto, 71,03 de taxa.
    await reserva({
      propertyId: p.id,
      bruto: 390,
      taxa: 71.03,
      checkIn: "2027-03-10",
      checkOut: "2027-03-11",
    });

    const r = await getFaturamento(MES.de, MES.ate);

    expect(r.total.bruto).toBe("390.00");
    expect(r.total.taxa).toBe("71.03");
    expect(r.total.liquido).toBe("318.97");
    // 20% de 318,97 — e não de 390, que daria 78,00.
    expect(r.total.comissao).toBe("63.79");
    expect(r.total.repasse).toBe("255.18");
  });

  it("repasse mais comissão devolvem o líquido", async () => {
    const p = await imovel({ slug: "a", comissao: 17.5 });
    await reserva({
      propertyId: p.id,
      bruto: 1000,
      taxa: 180,
      checkIn: "2027-03-10",
      checkOut: "2027-03-12",
    });

    const r = await getFaturamento(MES.de, MES.ate);
    expect(Number(r.total.comissao) + Number(r.total.repasse)).toBeCloseTo(
      Number(r.total.liquido),
      2,
    );
  });

  it("imóvel sem comissão configurada não infla repasse em silêncio", async () => {
    const p = await imovel({ slug: "a" });
    await reserva({
      propertyId: p.id,
      bruto: 500,
      taxa: 90,
      checkIn: "2027-03-10",
      checkOut: "2027-03-12",
    });

    const r = await getFaturamento(MES.de, MES.ate);
    expect(r.total.comissao).toBe("0.00");
    expect(r.total.repasse).toBe("410.00");
    // O aviso é o que impede o dono de tomar 410 como o valor dele.
    expect(r.reservasSemComissao).toBe(1);
  });
});

describe.skipIf(!temBanco)("isolamento entre proprietários", () => {
  beforeEach(limpar);

  async function doisDonos() {
    const [ana, bruno] = await Promise.all([
      dono("ana@teste.local"),
      dono("bruno@teste.local"),
    ]);
    const daAna = await imovel({
      slug: "ana-1",
      ownerId: ana.id,
      comissao: 20,
    });
    const doBruno = await imovel({
      slug: "bruno-1",
      ownerId: bruno.id,
      comissao: 20,
    });
    await reserva({
      propertyId: daAna.id,
      bruto: 1000,
      taxa: 0,
      checkIn: "2027-03-05",
      checkOut: "2027-03-07",
    });
    await reserva({
      propertyId: doBruno.id,
      bruto: 3000,
      taxa: 0,
      checkIn: "2027-03-15",
      checkOut: "2027-03-18",
    });
    return { ana, bruno, daAna, doBruno };
  }

  it("cada dono vê só o faturamento dos imóveis dele", async () => {
    const { ana, bruno } = await doisDonos();

    const daAna = await getFaturamento(MES.de, MES.ate, undefined, ana.id);
    const doBruno = await getFaturamento(MES.de, MES.ate, undefined, bruno.id);

    expect(daAna.total.bruto).toBe("1000.00");
    expect(daAna.total.reservas).toBe(1);
    expect(daAna.porHospedagem).toHaveLength(1);
    expect(daAna.porHospedagem[0].rotulo).toBe("Imóvel ana-1");

    expect(doBruno.total.bruto).toBe("3000.00");
    expect(doBruno.porHospedagem[0].rotulo).toBe("Imóvel bruno-1");
  });

  it("o gestor, sem filtro de dono, vê os dois", async () => {
    await doisDonos();
    const tudo = await getFaturamento(MES.de, MES.ate);
    expect(tudo.total.bruto).toBe("4000.00");
    expect(tudo.porHospedagem).toHaveLength(2);
  });

  it("dono não alcança imóvel alheio nem pedindo o id dele", async () => {
    const { ana, doBruno } = await doisDonos();

    // Cenário de ataque: a Ana descobre o id do imóvel do Bruno e o envia no
    // parâmetro propertyId. O filtro por dono precisa vencer.
    const r = await getFaturamento(MES.de, MES.ate, doBruno.id, ana.id);

    expect(r.total.reservas).toBe(0);
    expect(r.total.bruto).toBe("0.00");
    expect(r.porHospedagem).toHaveLength(0);
  });

  it("ocupação também é escopada ao dono", async () => {
    const { ana } = await doisDonos();

    const daAna = await getFaturamento(MES.de, MES.ate, undefined, ana.id);
    const tudo = await getFaturamento(MES.de, MES.ate);

    // 31 dias, 1 imóvel para a Ana; 2 imóveis no total do gestor.
    expect(daAna.ocupacao.noitesDisponiveis).toBe(31);
    expect(daAna.ocupacao.noitesOcupadas).toBe(2);
    expect(tudo.ocupacao.noitesDisponiveis).toBe(62);
    expect(tudo.ocupacao.noitesOcupadas).toBe(5);
  });
});
