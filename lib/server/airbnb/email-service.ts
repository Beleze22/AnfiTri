import { prisma } from "@/lib/db/client";
import { getAirbnbPlaceholderGuest } from "@/lib/server/airbnb/shared";
import {
  extractEmailBody,
  fetchEmailsForDebug,
  fetchUnreadAirbnbEmails,
  markEmailRead,
} from "@/lib/server/airbnb/gmail";
import { parseAirbnbConfirmationEmail } from "@/lib/server/airbnb/email-parser";

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
  const skipped: string[] = [];

  for (const message of messages) {
    const headers = message.payload?.headers ?? [];
    const subject =
      headers.find((h) => h.name?.toLowerCase() === "subject")?.value ?? "";
    const body = extractEmailBody(message);

    const parsed = parseAirbnbConfirmationEmail(body, subject);

    if (!parsed.checkIn || !parsed.checkOut) {
      skipped.push(`sem datas: subject="${subject}"`);
      continue;
    }

    // Idempotência — se já existe booking com esse código, pula.
    if (parsed.airbnbRef) {
      const existing = await prisma.booking.findUnique({
        where: { airbnbRef: parsed.airbnbRef },
      });
      if (existing) {
        await markEmailRead(gmail, message.id!);
        continue;
      }
    }

    const property = await findProperty(parsed.propertyHint);
    if (!property) {
      skipped.push(
        `imóvel não encontrado: subject="${subject}" snippet="${parsed.rawSnippet.slice(0, 80)}"`,
      );
      continue;
    }

    const guest = await getAirbnbPlaceholderGuest();
    await prisma.booking.create({
      data: {
        propertyId: property.id,
        userId: guest.id,
        checkIn: parsed.checkIn,
        checkOut: parsed.checkOut,
        source: "airbnb",
        status: "confirmado",
        airbnbRef: parsed.airbnbRef,
        conversation: { create: {} },
      },
    });
    created += 1;
    await markEmailRead(gmail, message.id!);
  }

  return { created, skipped };
}
