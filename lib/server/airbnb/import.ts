import nodeIcal from "node-ical";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/client";
import { raiseAlert, resolveAlertsByKey } from "@/lib/server/alerts";
import { findOverlap } from "@/lib/server/booking/service";
import { getAirbnbPlaceholderGuest } from "@/lib/server/airbnb/shared";

function toUtcDate(date: Date) {
  return new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
}

function diaChave(date: Date) {
  return date.toISOString().slice(0, 10);
}

function hojeUtc() {
  const agora = new Date();
  return new Date(
    Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate()),
  );
}

type Periodo = { inicio: Date; fim: Date };

// Noites de um período — check-out é exclusivo, como no resto do sistema.
function noites(periodo: Periodo): string[] {
  const dias: string[] = [];
  const cursor = new Date(periodo.inicio);
  while (cursor < periodo.fim) {
    dias.push(diaChave(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dias;
}

// Detecta o que o Airbnb deixou de bloquear e que aqui ainda consta ocupado:
// cancelamento e alteração de datas. Compara CONJUNTOS DE DIAS, não UIDs —
// reserva criada por e-mail guarda o código de confirmação em airbnbRef,
// enquanto a criada por iCal guarda o UID do evento, e casar por UID faria
// toda reserva vinda de e-mail parecer ausente do feed.
//
// Nada é cancelado automaticamente: feed que falhou, veio vazio ou truncado é
// indistinguível de "tudo foi cancelado", e um cron agindo sozinho nessa
// dúvida apagaria a agenda inteira. A decisão fica com o gestor (arquitetura
// §3.2: "sinal de possível cancelamento que o gestor deve investigar").
async function detectarDivergencias(
  propertyId: string,
  propertyTitle: string,
  periodosDoFeed: Periodo[],
) {
  // Sem eventos não dá para concluir nada — pode ser calendário realmente
  // vazio ou feed com problema. Silêncio é a resposta segura.
  if (periodosDoFeed.length === 0) return 0;

  const ocupadosNoAirbnb = new Set(periodosDoFeed.flatMap(noites));

  // O feed cobre uma janela finita. Uma reserva além do horizonte dele não
  // está "ausente" — está fora do alcance da informação.
  const horizonte = periodosDoFeed.reduce(
    (maior, p) => (p.fim > maior ? p.fim : maior),
    periodosDoFeed[0].fim,
  );

  const nossas = await prisma.booking.findMany({
    where: {
      propertyId,
      source: "airbnb",
      status: "confirmado",
      checkOut: { gte: hojeUtc() },
    },
  });

  let divergencias = 0;
  for (const booking of nossas) {
    const chave = `divergencia:${booking.id}`;
    if (booking.checkOut > horizonte) continue;

    const doBooking = noites({
      inicio: booking.checkIn,
      fim: booking.checkOut,
    });
    const aindaOcupadas = doBooking.filter((dia) =>
      ocupadosNoAirbnb.has(dia),
    ).length;

    if (aindaOcupadas === doBooking.length) {
      // Bateu de novo: se havia alerta aberto, era transitório.
      await resolveAlertsByKey(chave);
      continue;
    }

    const periodo = `${diaChave(booking.checkIn)} a ${diaChave(booking.checkOut)}`;
    const criado = await raiseAlert({
      kind: "divergencia_airbnb",
      title:
        aindaOcupadas === 0
          ? "Reserva sumiu do calendário do Airbnb"
          : "Datas da reserva mudaram no Airbnb",
      detail: [
        aindaOcupadas === 0
          ? `A reserva de ${periodo} em "${propertyTitle}" consta confirmada aqui, mas o calendário do Airbnb não bloqueia mais nenhuma dessas noites.`
          : `A reserva de ${periodo} em "${propertyTitle}" consta confirmada aqui, mas ${doBooking.length - aindaOcupadas} das ${doBooking.length} noites já não estão bloqueadas no Airbnb.`,
        "",
        "Confirme no painel do Airbnb antes de decidir. O calendário demora até 12h para atualizar, então uma mudança recente pode ainda não ter chegado.",
        "",
        "Se a reserva foi mesmo cancelada ou alterada lá, cancele-a aqui para liberar a data.",
      ].join("\n"),
      dedupeKey: chave,
      bookingId: booking.id,
    });
    if (criado) divergencias += 1;
  }

  return divergencias;
}

// Camada de backup (arquitetura, seção 3.2): importa o iCal oficial do
// Airbnb e cria localmente qualquer reserva que o parser de e-mail não
// tiver capturado. Faz também o caminho inverso — data que estava ocupada e
// voltou a ficar livre — que a seção 3.2 previa como sinal a ser investigado
// pelo gestor e a decisão 12 deixava fora do MVP. Não virou cancelamento
// automático: vira alerta, ver detectarDivergencias acima.
export async function syncPropertyFromAirbnbIcal(propertyId: string) {
  const property = await prisma.property.findUniqueOrThrow({
    where: { id: propertyId },
  });
  if (!property.airbnbIcalUrl) {
    return { created: 0, divergencias: 0 };
  }

  const events = await nodeIcal.async.fromURL(property.airbnbIcalUrl);
  let created = 0;
  const periodosDoFeed: Periodo[] = [];

  for (const event of Object.values(events)) {
    if (!event || event.type !== "VEVENT" || !event.start || !event.end)
      continue;

    const checkIn = toUtcDate(event.start);
    const checkOut = toUtcDate(event.end);
    if (checkIn >= checkOut) continue;

    periodosDoFeed.push({ inicio: checkIn, fim: checkOut });

    // O UID do evento identifica a reserva no Airbnb — usado como airbnbRef
    // (único no schema) para o re-sync de hora em hora ser idempotente.
    const airbnbRef = typeof event.uid === "string" ? event.uid : null;
    if (airbnbRef) {
      const existing = await prisma.booking.findUnique({
        where: { airbnbRef },
        select: { id: true, status: true },
      });
      if (existing) {
        // Cancelada aqui e ainda ocupada lá: ou o cancelamento local foi
        // engano, ou uma divergência foi resolvida na direção errada.
        // Reviver sozinho seria mudar estado de reserva a partir do feed,
        // que é justamente o que evitamos — então alerta e deixa a decisão
        // com o gestor.
        if (existing.status === "cancelado" || existing.status === "expirado") {
          await raiseAlert({
            kind: "divergencia_airbnb",
            title: "Reserva cancelada aqui continua ocupada no Airbnb",
            detail: [
              `A reserva de ${diaChave(checkIn)} a ${diaChave(checkOut)} em "${property.title}" está ${existing.status} nesta plataforma, mas o calendário do Airbnb ainda bloqueia essas datas.`,
              "",
              "A data aparece livre no site e pode ser vendida de novo, enquanto no Airbnb segue ocupada.",
              "",
              "Confirme no Airbnb: se a reserva existe mesmo, lance-a novamente pelo Calendário.",
            ].join("\n"),
            dedupeKey: `ocupada-no-airbnb:${existing.id}`,
            bookingId: existing.id,
          });
        }
        continue;
      }
    }

    const guest = await getAirbnbPlaceholderGuest();
    try {
      // Mesma proteção da reserva pelo site: checagem de overlap + criação
      // numa transação serializable, para não colidir com um booking do
      // site criado no mesmo instante.
      const conflitante = await prisma.$transaction(
        async (tx) => {
          const conflict = await findOverlap(tx, propertyId, checkIn, checkOut);
          if (conflict) return conflict;

          await tx.booking.create({
            data: {
              propertyId,
              userId: guest.id,
              checkIn,
              checkOut,
              source: "airbnb",
              status: "confirmado",
              airbnbRef,
            },
          });
          return null;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      if (conflitante) {
        // Reserva real do Airbnb caindo sobre uma reserva nossa. Descartar em
        // silêncio — como era feito — deixava a data ocupada lá e nós sem
        // registro: se a nossa expirasse ou fosse cancelada, a data voltaria
        // a ser vendida no site enquanto o hóspede do Airbnb já tinha a
        // estadia garantida.
        await raiseAlert({
          kind: "divergencia_airbnb",
          title: "Reserva do Airbnb conflita com uma reserva desta plataforma",
          detail: [
            `O calendário do Airbnb bloqueia ${diaChave(checkIn)} a ${diaChave(checkOut)} em "${property.title}", mas essas datas já têm uma reserva ${conflitante.status} aqui (origem ${conflitante.source}).`,
            "",
            "A reserva do Airbnb não foi registrada, para não criar duas reservas na mesma data.",
            "",
            "Verifique qual das duas é válida. As duas datas estão prometidas a hóspedes diferentes.",
          ].join("\n"),
          dedupeKey: `conflito-airbnb:${propertyId}:${diaChave(checkIn)}`,
          bookingId: conflitante.id,
        });
      } else {
        created += 1;
      }
    } catch (error) {
      // Corrida perdida (serialização ou airbnbRef duplicado): outro processo
      // já tratou essa data/reserva — segue para o próximo evento.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === "P2034" || error.code === "P2002")
      ) {
        continue;
      }
      throw error;
    }
  }

  const divergencias = await detectarDivergencias(
    propertyId,
    property.title,
    periodosDoFeed,
  );

  await prisma.property.update({
    where: { id: propertyId },
    data: { airbnbSyncedAt: new Date() },
  });

  return { created, divergencias };
}

export async function syncAllPropertiesFromAirbnbIcal() {
  const properties = await prisma.property.findMany({
    where: { airbnbIcalUrl: { not: null } },
    select: { id: true, title: true },
  });

  const results = await Promise.allSettled(
    properties.map((property) => syncPropertyFromAirbnbIcal(property.id)),
  );

  let created = 0;
  let divergencias = 0;
  let failed = 0;
  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      created += result.value.created;
      divergencias += result.value.divergencias;
    } else {
      // Sem isso, um iCal quebrado (URL revogada, Airbnb fora do ar) falharia
      // em silêncio para sempre.
      failed += 1;
      console.error(
        `[airbnb-ical] falha ao sincronizar propriedade ${properties[index].id}:`,
        result.reason,
      );
      // Feed que parou de responder é a falha silenciosa clássica do iCal:
      // nenhuma das plataformas avisa (arquitetura §3.1). Sem isto, uma URL
      // revogada deixaria de sincronizar para sempre com o cron em verde.
      void raiseAlert({
        kind: "divergencia_airbnb",
        title: "Calendário do Airbnb não pôde ser lido",
        detail: [
          `Falhou a leitura do iCal de "${properties[index].title}".`,
          "",
          `Motivo: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`,
          "",
          "Enquanto isso, reservas feitas no Airbnb podem não estar sendo bloqueadas aqui. Confira se a URL do calendário continua válida no painel do Airbnb.",
        ].join("\n"),
        dedupeKey: `ical-falhou:${properties[index].id}`,
      });
    }
  });

  return { created, divergencias, failed };
}
