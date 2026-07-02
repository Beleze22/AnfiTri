// Parser de e-mail de confirmação do Airbnb (arquitetura, seção 3.2).
// Padrões para PT-BR e EN dado que o idioma do e-mail depende das
// configurações da conta Airbnb. Os regex são atualizados conforme
// testamos com e-mails reais via /api/debug/airbnb-email.

const PT_MONTHS: Record<string, number> = {
  jan: 0,
  fev: 1,
  mar: 2,
  abr: 3,
  mai: 4,
  jun: 5,
  jul: 6,
  ago: 7,
  set: 8,
  out: 9,
  nov: 10,
  dez: 11,
  janeiro: 0,
  fevereiro: 1,
  março: 2,
  abril: 3,
  maio: 4,
  junho: 5,
  julho: 6,
  agosto: 7,
  setembro: 8,
  outubro: 9,
  novembro: 10,
  dezembro: 11,
};

const EN_MONTHS: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

function parseDate(text: string): Date | null {
  // Formato PT: "20 de jun" | "sex, 20 de jun" | "20 de junho de 2026"
  const ptMatch = text
    .toLowerCase()
    .match(/(\d{1,2})\s+de\s+(\w+)(?:\s+de\s+(\d{4}))?/);
  if (ptMatch) {
    const day = Number(ptMatch[1]);
    const month = PT_MONTHS[ptMatch[2]];
    const year = ptMatch[3] ? Number(ptMatch[3]) : new Date().getFullYear();
    if (month !== undefined) {
      return new Date(Date.UTC(year, month, day));
    }
  }

  // Formato EN: "Jun 20, 2026" | "June 20, 2026" | "20 Jun 2026"
  const enMatch = text.toLowerCase().match(/(\w+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (enMatch) {
    const month = EN_MONTHS[enMatch[1].slice(0, 3)];
    const day = Number(enMatch[2]);
    const year = Number(enMatch[3]);
    if (month !== undefined) {
      return new Date(Date.UTC(year, month, day));
    }
  }

  const enRevMatch = text.toLowerCase().match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
  if (enRevMatch) {
    const month = EN_MONTHS[enRevMatch[2].slice(0, 3)];
    const day = Number(enRevMatch[1]);
    const year = Number(enRevMatch[3]);
    if (month !== undefined) {
      return new Date(Date.UTC(year, month, day));
    }
  }

  return null;
}

// Extrai o código de confirmação (alfanumérico, 8-12 chars) do e-mail.
function extractConfirmationCode(body: string): string | null {
  // Airbnb usa padrões como "Código de confirmação: HMJKA5R4B4"
  const patterns = [
    /c[oó]digo[^:]*:\s*([A-Z0-9]{8,12})/i,
    /confirmation[^:]*:\s*([A-Z0-9]{8,12})/i,
    /reserva[^:]*:\s*([A-Z0-9]{8,12})/i,
    /\b([A-Z]{2,4}[0-9]{4,8})\b/,
  ];
  for (const pattern of patterns) {
    const match = body.match(pattern);
    if (match) return match[1].toUpperCase();
  }
  return null;
}

// Extrai datas de check-in e check-out do corpo do e-mail.
function extractDates(body: string): {
  checkIn: Date | null;
  checkOut: Date | null;
} {
  const checkInPatterns = [
    /check[\s-]?in[^:]*:\s*([^\n\r]{5,30})/i,
    /entrada[^:]*:\s*([^\n\r]{5,30})/i,
    /chegada[^:]*:\s*([^\n\r]{5,30})/i,
    /arrival[^:]*:\s*([^\n\r]{5,30})/i,
  ];
  const checkOutPatterns = [
    /check[\s-]?out[^:]*:\s*([^\n\r]{5,30})/i,
    /sa[íi]da[^:]*:\s*([^\n\r]{5,30})/i,
    /saída[^:]*:\s*([^\n\r]{5,30})/i,
    /departure[^:]*:\s*([^\n\r]{5,30})/i,
  ];

  let checkIn: Date | null = null;
  let checkOut: Date | null = null;

  for (const pattern of checkInPatterns) {
    const match = body.match(pattern);
    if (match) {
      checkIn = parseDate(match[1]);
      if (checkIn) break;
    }
  }
  for (const pattern of checkOutPatterns) {
    const match = body.match(pattern);
    if (match) {
      checkOut = parseDate(match[1]);
      if (checkOut) break;
    }
  }

  return { checkIn, checkOut };
}

export type ParsedAirbnbEmail = {
  airbnbRef: string | null;
  checkIn: Date | null;
  checkOut: Date | null;
  propertyHint: string;
  rawSnippet: string;
};

export function parseAirbnbConfirmationEmail(
  body: string,
  subject: string,
): ParsedAirbnbEmail {
  const { checkIn, checkOut } = extractDates(body);
  const airbnbRef = extractConfirmationCode(body + " " + subject);

  // O nome do imóvel no Airbnb aparece como texto no e-mail — armazenamos
  // o corpo para que a camada de serviço faça o matching contra os imóveis
  // cadastrados na plataforma (partial/normalized string comparison).
  const propertyHint = body.slice(0, 2000);
  const rawSnippet = body.slice(0, 500);

  return { airbnbRef, checkIn, checkOut, propertyHint, rawSnippet };
}
