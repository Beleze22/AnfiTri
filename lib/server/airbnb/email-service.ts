import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/client";
import { raiseAlert } from "@/lib/server/alerts";
import { cancelBooking, findOverlap } from "@/lib/server/booking/service";
import { getAirbnbPlaceholderGuest } from "@/lib/server/airbnb/shared";
import {
  extractEmailBody,
  fetchEmailsForDebug,
  fetchUnreadAirbnbEmails,
  markEmailRead,
} from "@/lib/server/airbnb/gmail";
import { parseAirbnbEmail } from "@/lib/server/airbnb/email-parser";

// Normaliza um nome de imóvel para comparação flexível (ignora maiúsculas,
// acentos, espaços extras) — Airbnb pode usar o nome com pequenas variações.
function normalize(text: string) {
  // /[^a-z0-9]/ já remove acentos e caracteres especiais diretamente após
  // lowercase — sem precisar de NFD+combine-mark-strip que gera problemas
  // com bundlers ao escrever literalmente os caracteres combinantes no source.
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Um e-mail que parece reserva mas não pôde ser transformado em booking vira
// alerta no painel. Antes isso só entrava num array devolvido na resposta
// HTTP do cron, que ninguém lê: o job respondia 200 e a integração podia
// estar quebrada há dias sem nenhum sinal. A chave é o id da mensagem, então
// o mesmo e-mail não gera alerta novo a cada 10 minutos.
async function alertaDeLeitura(
  messageId: string,
  subject: string,
  motivo: string,
  trecho: string,
) {
  await raiseAlert({
    kind: "parser_sem_referencia",
    title: "E-mail de reserva não pôde ser processado",
    detail: [
      motivo,
      "",
      `Assunto: ${subject}`,
      `Trecho: ${trecho.slice(0, 300)}`,
      "",
      "A data não foi bloqueada na plataforma. Confira a reserva no Airbnb e, se existir, lance manualmente pelo Calendário.",
    ].join("\n"),
    dedupeKey: `gmail:${messageId}`,
  });
}

async function findProperty(propertyHint: string) {
  const properties = await prisma.property.findMany({
    select: { id: true, title: true },
  });
  const normalizedHint = normalize(propertyHint);
  for (const property of properties) {
    if (normalizedHint.includes(normalize(property.title))) {
      return property;
    }
  }
  return null;
}

export async function processAirbnbEmails(debug = false) {
  const { gmail, messages } = debug
    ? await fetchEmailsForDebug()
    : await fetchUnreadAirbnbEmails();
  let created = 0;
  let cancelados = 0;
  let alertas = 0;
  const skipped: string[] = [];

  for (const message of messages) {
    const headers = message.payload?.headers ?? [];
    const subject =
      headers.find((h) => h.name?.toLowerCase() === "subject")?.value ?? "";
    const body = extractEmailBody(message);

    // Data de envio ancora a inferência de ano das datas sem ano ("29 de
    // ago."). Com "agora" no lugar dela, um e-mail de dois dias atrás jogaria
    // a estadia para o ano seguinte.
    const enviadoEm = message.internalDate
      ? new Date(Number(message.internalDate))
      : new Date();

    const parsed = parseAirbnbEmail(body, subject, enviadoEm);

    // A busca do Gmail filtra por assunto e acaba trazendo aviso de promoção,
    // avaliação e afins. Sem tipo reconhecido não há o que fazer, e alertar
    // aqui encheria o painel de ruído.
    if (parsed.tipo === "desconhecido") {
      skipped.push(`tipo não reconhecido: subject="${subject}"`);
      continue;
    }

    if (parsed.tipo === "cancelamento") {
      if (await tratarCancelamento(parsed, subject)) cancelados += 1;
      else alertas += 1;
      await markEmailRead(gmail, message.id!);
      continue;
    }

    if (parsed.tipo === "alteracao") {
      await tratarAlteracao(parsed, subject, message.id!);
      alertas += 1;
      await markEmailRead(gmail, message.id!);
      continue;
    }

    if (!parsed.checkIn || !parsed.checkOut) {
      skipped.push(`sem datas: subject="${subject}"`);
      await alertaDeLeitura(
        message.id!,
        subject,
        "Não foi possível ler as datas de entrada e saída.",
        parsed.rawSnippet,
      );
      continue;
    }

    // Sem código de confirmação não criamos nada. Ele é a chave de
    // deduplicação: sem ele, a busca do Gmail (3 dias, sem filtrar lidos)
    // reprocessaria o mesmo e-mail e criaria uma reserva nova a cada
    // execução do cron.
    if (!parsed.airbnbRef) {
      skipped.push(`sem código de confirmação: subject="${subject}"`);
      await alertaDeLeitura(
        message.id!,
        subject,
        "As datas foram lidas, mas não há código de confirmação reconhecível — sem ele a reserva não pode ser identificada nem deduplicada.",
        parsed.rawSnippet,
      );
      continue;
    }

    const existing = await prisma.booking.findUnique({
      where: { airbnbRef: parsed.airbnbRef },
    });
    if (existing) {
      await markEmailRead(gmail, message.id!);
      continue;
    }

    const property = await findProperty(parsed.propertyHint);
    if (!property) {
      skipped.push(
        `imóvel não encontrado: subject="${subject}" snippet="${parsed.rawSnippet.slice(0, 80)}"`,
      );
      await alertaDeLeitura(
        message.id!,
        subject,
        `Nenhuma hospedagem cadastrada bate com o anúncio citado no e-mail (código ${parsed.airbnbRef}).`,
        parsed.rawSnippet,
      );
      continue;
    }

    const guest = await getAirbnbPlaceholderGuest();

    // Mesma proteção dos outros dois caminhos de criação: overlap + criação
    // numa transação serializable. Este era o único que criava direto, e a
    // janela é real — nosso feed leva horas para chegar ao Airbnb, então
    // durante esse intervalo a mesma data está vendável nos dois lugares.
    const conflitante = await prisma.$transaction(
      async (tx) => {
        const conflict = await findOverlap(
          tx,
          property.id,
          parsed.checkIn!,
          parsed.checkOut!,
        );
        if (conflict) return conflict;

        await tx.booking.create({
          data: {
            propertyId: property.id,
            userId: guest.id,
            checkIn: parsed.checkIn!,
            checkOut: parsed.checkOut!,
            source: "airbnb",
            status: "confirmado",
            airbnbRef: parsed.airbnbRef,
            // Sem isto a reserva do Airbnb entra com valor nulo e desaparece
            // de qualquer relatório de faturamento.
            totalPrice: parsed.valores.bruto,
            platformFee: parsed.valores.taxa,
            netAmount: parsed.valores.liquido,
            conversation: { create: {} },
          },
        });
        return null;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (conflitante) {
      // Reserva real do Airbnb sobre reserva nossa: as duas datas estão
      // prometidas. Registrar por cima criaria overbooking silencioso; não
      // registrar e calar seria pior ainda.
      await raiseAlert({
        kind: "divergencia_airbnb",
        title: "Reserva do Airbnb conflita com uma reserva desta plataforma",
        detail: [
          `O Airbnb confirmou a reserva ${parsed.airbnbRef} em "${property.title}" para datas que já têm uma reserva ${conflitante.status} aqui (origem ${conflitante.source}).`,
          "",
          "A reserva do Airbnb NÃO foi registrada, para não criar duas reservas na mesma data.",
          "",
          "Resolva no Airbnb ou aqui — as duas datas estão prometidas a hóspedes diferentes.",
        ].join("\n"),
        dedupeKey: `conflito-email:${parsed.airbnbRef}`,
        bookingId: conflitante.id,
      });
      alertas += 1;
      await markEmailRead(gmail, message.id!);
      continue;
    }

    created += 1;
    await markEmailRead(gmail, message.id!);
  }

  return { created, cancelados, alertas, skipped };
}

// Cancelamento é o único caso em que agimos sozinhos. Diferente do diff de
// iCal — que infere a partir de ausência de dado e pode confundir feed
// quebrado com cancelamento em massa — aqui o Airbnb afirma explicitamente
// que cancelou, e identifica a reserva pelo código único. Ainda assim fica
// registrado num alerta, para o gestor ver o que a ferramenta fez.
async function tratarCancelamento(
  parsed: ReturnType<typeof parseAirbnbEmail>,
  subject: string,
) {
  if (!parsed.airbnbRef) {
    await raiseAlert({
      kind: "divergencia_airbnb",
      title: "Cancelamento do Airbnb sem código identificável",
      detail: [
        `Chegou um aviso de cancelamento que não traz código de reserva reconhecível.`,
        "",
        `Assunto: ${subject}`,
        "",
        "A reserva correspondente pode continuar bloqueando a data aqui. Confira no Airbnb e cancele manualmente se for o caso.",
      ].join("\n"),
      dedupeKey: `cancel-sem-ref:${subject}`,
    });
    return false;
  }

  const booking = await prisma.booking.findUnique({
    where: { airbnbRef: parsed.airbnbRef },
    include: { property: { select: { title: true } } },
  });

  // Cancelamento de reserva que nunca chegou a ser registrada aqui: nada a
  // fazer, e não é problema — o e-mail de confirmação pode ter sido anterior
  // ao cadastro da hospedagem.
  if (!booking) return false;
  if (booking.status !== "confirmado" && booking.status !== "pendente") {
    return false;
  }

  await cancelBooking(booking.id);

  await raiseAlert({
    kind: "divergencia_airbnb",
    title: "Reserva cancelada automaticamente pelo aviso do Airbnb",
    detail: [
      `O Airbnb avisou que a reserva ${parsed.airbnbRef} em "${booking.property.title}" foi cancelada, e a data foi liberada aqui.`,
      "",
      "Nenhuma ação é necessária — este alerta existe só para você saber o que mudou.",
    ].join("\n"),
    dedupeKey: `cancelado-por-email:${booking.id}`,
    bookingId: booking.id,
  });

  return true;
}

// Alteração é PEDIDO, não fato: o e-mail diz "se você aceitar... vamos
// atualizar sua reserva". Mudar as datas aqui por conta própria criaria uma
// divergência caso o gestor recuse. Só avisamos.
async function tratarAlteracao(
  parsed: ReturnType<typeof parseAirbnbEmail>,
  subject: string,
  messageId: string,
) {
  const periodo =
    parsed.checkIn && parsed.checkOut
      ? `${parsed.checkIn.toISOString().slice(0, 10)} a ${parsed.checkOut.toISOString().slice(0, 10)}`
      : "período não identificado";

  await raiseAlert({
    kind: "divergencia_airbnb",
    title: "Hóspede pediu alteração de datas no Airbnb",
    detail: [
      `Um hóspede solicitou mudança nas datas de uma reserva (originais: ${periodo}).`,
      "",
      `Assunto: ${subject}`,
      "",
      "A decisão é sua, no painel do Airbnb. Se aceitar, ajuste também a reserva aqui — pelo Calendário — para as datas novas, senão as antigas continuam bloqueadas e as novas ficam abertas para venda.",
    ].join("\n"),
    dedupeKey: `alteracao:${messageId}`,
  });
}
