import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/client";
import { calculateExpiresAt } from "@/lib/server/booking/expiry";
import {
  BookingConflictError,
  InvalidTransitionError,
  cancelBooking,
  confirmBooking,
  createManualBooking,
  createSiteBooking,
  expireOverdueBookings,
} from "@/lib/server/booking/service";

// Integração contra Postgres de verdade, não mock: o que precisa de garantia
// aqui são as transações serializable, a atomicidade das transições e a
// semântica de sobreposição de datas — nada disso sobrevive a um mock do
// Prisma, que testaria o mock.
//
// Sem TEST_DATABASE_URL o arquivo inteiro é pulado. Ver vitest.setup.ts.
const temBanco = Boolean(process.env.TEST_DATABASE_URL);

const dia = (iso: string) => new Date(`${iso}T00:00:00Z`);

// Config de expiração do gestor de teste, compartilhada entre o cenário e as
// asserções.
const CONFIG = {
  defaultExpiryHours: 6,
  quietHoursStart: new Date("1970-01-01T22:00:00Z"),
  quietHoursEnd: new Date("1970-01-01T07:00:00Z"),
  gracePeriodHours: 2,
};

async function limpar() {
  // CASCADE porque conversation/message/payment/alert pendem de booking.
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE alerts, messages, conversations, payments, bookings,
     price_rules, amenities, photos, properties, magic_link_tokens, users
     RESTART IDENTITY CASCADE`,
  );
}

async function cenario() {
  const gestor = await prisma.user.create({
    data: {
      name: "Gestor",
      email: "gestor@teste.local",
      role: "gestor",
      ...CONFIG,
    },
  });
  const property = await prisma.property.create({
    data: {
      title: "Casa Teste",
      slug: "casa-teste",
      description: "…",
      maxGuests: 4,
      bedrooms: 2,
      basePrice: 200,
      status: "publicada",
    },
  });
  return { gestor, property };
}

const hospede = {
  name: "Fulano",
  email: "fulano@teste.local",
  phone: "11999999999",
};

describe.skipIf(!temBanco)("createSiteBooking", () => {
  beforeEach(limpar);

  it("cria pendente com preço, prazo e conversa", async () => {
    const { property } = await cenario();
    const { booking, isNewUser } = await createSiteBooking({
      propertyId: property.id,
      checkIn: dia("2027-03-10"),
      checkOut: dia("2027-03-13"),
      ...hospede,
    });

    expect(booking.status).toBe("pendente");
    expect(booking.source).toBe("site");
    expect(booking.totalPrice?.toFixed(2)).toBe("600.00"); // 3 noites × 200
    expect(isNewUser).toBe(true);

    // Comparar com a função pura, e não com "6 horas" fixas: o prazo passa
    // pela janela de silêncio, então o intervalo real depende da hora em que
    // o teste roda. Uma asserção de 6h passa de manhã e falha à tarde — foi
    // assim que o CI pegou esta versão. O que cabe verificar aqui é que o
    // serviço aplica a config do gestor; o algoritmo em si tem os próprios
    // casos em expiry.test.ts.
    expect(booking.expiresAt).toEqual(
      calculateExpiresAt(booking.createdAt, CONFIG),
    );
    expect(booking.expiresAt!.getTime()).toBeGreaterThan(
      booking.createdAt.getTime(),
    );

    const conversa = await prisma.conversation.findUnique({
      where: { bookingId: booking.id },
    });
    expect(conversa).not.toBeNull();
  });

  it("recusa datas que já têm reserva pendente", async () => {
    const { property } = await cenario();
    await createSiteBooking({
      propertyId: property.id,
      checkIn: dia("2027-03-10"),
      checkOut: dia("2027-03-13"),
      ...hospede,
    });

    await expect(
      createSiteBooking({
        propertyId: property.id,
        checkIn: dia("2027-03-11"),
        checkOut: dia("2027-03-12"),
        ...hospede,
        email: "outro@teste.local",
      }),
    ).rejects.toBeInstanceOf(BookingConflictError);
  });

  it("o dia de check-out fica livre para a próxima entrada", async () => {
    const { property } = await cenario();
    await createSiteBooking({
      propertyId: property.id,
      checkIn: dia("2027-03-10"),
      checkOut: dia("2027-03-12"),
      ...hospede,
    });

    // Entrada no mesmo dia da saída anterior não é sobreposição: o hóspede
    // sai de manhã e o próximo entra à tarde.
    const encostada = await createSiteBooking({
      propertyId: property.id,
      checkIn: dia("2027-03-12"),
      checkOut: dia("2027-03-14"),
      ...hospede,
      email: "outro@teste.local",
    });
    expect(encostada.booking.status).toBe("pendente");
  });

  it("e-mail já cadastrado não tem dados sobrescritos nem ganha sessão", async () => {
    const { property } = await cenario();
    const existente = await prisma.user.create({
      data: {
        name: "Nome Verdadeiro",
        email: "fulano@teste.local",
        phone: "11888888888",
        role: "hospede",
      },
    });

    const { guest, isNewUser } = await createSiteBooking({
      propertyId: property.id,
      checkIn: dia("2027-04-01"),
      checkOut: dia("2027-04-03"),
      name: "Nome Inventado",
      email: "fulano@teste.local",
      phone: "11777777777",
    });

    // Reserva com e-mail alheio não pode reescrever o cadastro de quem
    // realmente é dono dele — nem autenticar quem fez o pedido.
    expect(guest.id).toBe(existente.id);
    expect(guest.name).toBe("Nome Verdadeiro");
    expect(guest.phone).toBe("11888888888");
    expect(isNewUser).toBe(false);
  });
});

describe.skipIf(!temBanco)("confirmBooking", () => {
  beforeEach(limpar);

  it("leva pendente para confirmado", async () => {
    const { property } = await cenario();
    const { booking } = await createSiteBooking({
      propertyId: property.id,
      checkIn: dia("2027-05-10"),
      checkOut: dia("2027-05-12"),
      ...hospede,
    });

    const confirmada = await confirmBooking(booking.id);
    expect(confirmada.status).toBe("confirmado");
  });

  it("recusa confirmar duas vezes", async () => {
    const { property } = await cenario();
    const { booking } = await createSiteBooking({
      propertyId: property.id,
      checkIn: dia("2027-05-10"),
      checkOut: dia("2027-05-12"),
      ...hospede,
    });
    await confirmBooking(booking.id);

    await expect(confirmBooking(booking.id)).rejects.toBeInstanceOf(
      InvalidTransitionError,
    );
  });

  it("recusa pendente cujo prazo já venceu", async () => {
    const { property } = await cenario();
    const { booking } = await createSiteBooking({
      propertyId: property.id,
      checkIn: dia("2027-05-10"),
      checkOut: dia("2027-05-12"),
      ...hospede,
    });
    // Vencida mas ainda não varrida pelo job de expiração, que roda a cada
    // 15 minutos.
    await prisma.booking.update({
      where: { id: booking.id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    await expect(confirmBooking(booking.id)).rejects.toThrow(/prazo/i);
  });

  it("recusa quando outra reserva confirmada ocupou a data no meio do caminho", async () => {
    const { property } = await cenario();
    const { booking } = await createSiteBooking({
      propertyId: property.id,
      checkIn: dia("2027-06-10"),
      checkOut: dia("2027-06-13"),
      ...hospede,
    });

    // Simula a reserva que chega do Airbnb entre o pedido e a aprovação: o
    // nosso feed leva horas para bloquear a data lá.
    const placeholder = await prisma.user.create({
      data: {
        name: "Hóspede via Airbnb",
        email: "airbnb@teste.local",
        role: "hospede",
      },
    });
    await prisma.booking.create({
      data: {
        propertyId: property.id,
        userId: placeholder.id,
        checkIn: dia("2027-06-11"),
        checkOut: dia("2027-06-12"),
        source: "airbnb",
        status: "confirmado",
        airbnbRef: "HMTESTE001",
      },
    });

    await expect(confirmBooking(booking.id)).rejects.toBeInstanceOf(
      BookingConflictError,
    );

    const depois = await prisma.booking.findUniqueOrThrow({
      where: { id: booking.id },
    });
    expect(depois.status).toBe("pendente");
  });
});

describe.skipIf(!temBanco)("cancelBooking", () => {
  beforeEach(limpar);

  it("cancela pendente e confirmada", async () => {
    const { property } = await cenario();
    const a = await createSiteBooking({
      propertyId: property.id,
      checkIn: dia("2027-07-10"),
      checkOut: dia("2027-07-12"),
      ...hospede,
    });
    const b = await createSiteBooking({
      propertyId: property.id,
      checkIn: dia("2027-07-20"),
      checkOut: dia("2027-07-22"),
      ...hospede,
      email: "outro@teste.local",
    });
    await confirmBooking(b.booking.id);

    expect((await cancelBooking(a.booking.id)).status).toBe("cancelado");
    expect((await cancelBooking(b.booking.id)).status).toBe("cancelado");
  });

  it("recusa cancelar o que já está cancelado", async () => {
    const { property } = await cenario();
    const { booking } = await createSiteBooking({
      propertyId: property.id,
      checkIn: dia("2027-07-10"),
      checkOut: dia("2027-07-12"),
      ...hospede,
    });
    await cancelBooking(booking.id);

    await expect(cancelBooking(booking.id)).rejects.toBeInstanceOf(
      InvalidTransitionError,
    );
  });

  it("com somentePendente, cancela pendente", async () => {
    const { property } = await cenario();
    const { booking } = await createSiteBooking({
      propertyId: property.id,
      checkIn: dia("2027-07-10"),
      checkOut: dia("2027-07-12"),
      ...hospede,
    });

    const cancelada = await cancelBooking(booking.id, {
      somentePendente: true,
    });
    expect(cancelada.status).toBe("cancelado");
  });

  it("com somentePendente, recusa reserva já confirmada", async () => {
    const { property } = await cenario();
    const { booking } = await createSiteBooking({
      propertyId: property.id,
      checkIn: dia("2027-07-10"),
      checkOut: dia("2027-07-12"),
      ...hospede,
    });
    await confirmBooking(booking.id);

    // É o caso que protege o hóspede de desfazer o que o gestor já firmou —
    // inclusive na corrida entre ler o status e cancelar.
    await expect(
      cancelBooking(booking.id, { somentePendente: true }),
    ).rejects.toBeInstanceOf(InvalidTransitionError);

    const depois = await prisma.booking.findUniqueOrThrow({
      where: { id: booking.id },
    });
    expect(depois.status).toBe("confirmado");
  });

  it("sem somentePendente, o gestor cancela a confirmada", async () => {
    const { property } = await cenario();
    const { booking } = await createSiteBooking({
      propertyId: property.id,
      checkIn: dia("2027-07-10"),
      checkOut: dia("2027-07-12"),
      ...hospede,
    });
    await confirmBooking(booking.id);

    expect((await cancelBooking(booking.id)).status).toBe("cancelado");
  });

  it("cancelar libera a data para uma reserva nova", async () => {
    const { property } = await cenario();
    const { booking } = await createSiteBooking({
      propertyId: property.id,
      checkIn: dia("2027-08-10"),
      checkOut: dia("2027-08-12"),
      ...hospede,
    });
    await cancelBooking(booking.id);

    const nova = await createSiteBooking({
      propertyId: property.id,
      checkIn: dia("2027-08-10"),
      checkOut: dia("2027-08-12"),
      ...hospede,
      email: "outro@teste.local",
    });
    expect(nova.booking.status).toBe("pendente");
  });
});

describe.skipIf(!temBanco)("expireOverdueBookings", () => {
  beforeEach(limpar);

  it("expira só pendente vencida, sem tocar em confirmada nem em pendente no prazo", async () => {
    const { property } = await cenario();

    const vencida = await createSiteBooking({
      propertyId: property.id,
      checkIn: dia("2027-09-01"),
      checkOut: dia("2027-09-03"),
      ...hospede,
    });
    await prisma.booking.update({
      where: { id: vencida.booking.id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    const noPrazo = await createSiteBooking({
      propertyId: property.id,
      checkIn: dia("2027-09-10"),
      checkOut: dia("2027-09-12"),
      ...hospede,
      email: "b@teste.local",
    });

    const confirmada = await createSiteBooking({
      propertyId: property.id,
      checkIn: dia("2027-09-20"),
      checkOut: dia("2027-09-22"),
      ...hospede,
      email: "c@teste.local",
    });
    await confirmBooking(confirmada.booking.id);
    // Confirmada mantém expiresAt do tempo em que era pendente; o job não
    // pode se guiar só pela data, tem de olhar o status.
    await prisma.booking.update({
      where: { id: confirmada.booking.id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    expect(await expireOverdueBookings()).toBe(1);

    const status = async (id: string) =>
      (await prisma.booking.findUniqueOrThrow({ where: { id } })).status;
    expect(await status(vencida.booking.id)).toBe("expirado");
    expect(await status(noPrazo.booking.id)).toBe("pendente");
    expect(await status(confirmada.booking.id)).toBe("confirmado");
  });

  it("é idempotente: rodar de novo não expira nada", async () => {
    const { property } = await cenario();
    const { booking } = await createSiteBooking({
      propertyId: property.id,
      checkIn: dia("2027-10-01"),
      checkOut: dia("2027-10-03"),
      ...hospede,
    });
    await prisma.booking.update({
      where: { id: booking.id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    expect(await expireOverdueBookings()).toBe(1);
    expect(await expireOverdueBookings()).toBe(0);
  });
});

describe.skipIf(!temBanco)("createManualBooking", () => {
  beforeEach(limpar);

  it("nasce confirmada, com preço calculado e sem prazo de expiração", async () => {
    const { property } = await cenario();
    const booking = await createManualBooking({
      propertyId: property.id,
      checkIn: dia("2027-11-10"),
      checkOut: dia("2027-11-13"),
      ...hospede,
    });

    expect(booking.status).toBe("confirmado");
    expect(booking.source).toBe("manual");
    expect(booking.totalPrice?.toFixed(2)).toBe("600.00");
    expect(booking.expiresAt).toBeNull();
  });

  it("recusa data ocupada", async () => {
    const { property } = await cenario();
    await createManualBooking({
      propertyId: property.id,
      checkIn: dia("2027-11-10"),
      checkOut: dia("2027-11-13"),
      ...hospede,
    });

    await expect(
      createManualBooking({
        propertyId: property.id,
        checkIn: dia("2027-11-12"),
        checkOut: dia("2027-11-14"),
        ...hospede,
      }),
    ).rejects.toBeInstanceOf(BookingConflictError);
  });
});
