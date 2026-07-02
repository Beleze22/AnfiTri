import { google } from "googleapis";

// Cliente Gmail autenticado com o refresh token do gestor (Etapa 7).
// O token é do próprio proprietário das hospedagens no Airbnb — único
// usuário que recebe as confirmações de reserva por e-mail.
export function getGmailClient() {
  const auth = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
  );
  auth.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
  return google.gmail({ version: "v1", auth });
}

// Janela de busca retroativa — evita depender de is:unread, que quebraria
// se o gestor abrisse o e-mail antes do cron rodar. A deduplicação é feita
// pelo campo airbnbRef único no banco, não pelo status lido/não lido.
// 3 dias cobre eventuais falhas do cron e horário de silêncio confortavelmente.
const LOOKBACK_DAYS = 3;

function afterDateFilter() {
  const date = new Date();
  date.setDate(date.getDate() - LOOKBACK_DAYS);
  return `after:${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
}

// Query restrita por remetente — usada pelo cron em produção.
function buildProductionQuery() {
  return [
    afterDateFilter(),
    "(from:automated@airbnb.com OR from:no-reply@airbnb.com",
    " OR from:support@airbnb.com OR from:do_not_reply@airbnb.com)",
    "(subject:confirmada OR subject:confirmed",
    " OR subject:reserva OR subject:reservation OR subject:Buchung)",
  ].join(" ");
}

// Query ampla sem filtro de remetente — usada pelo debug para testar com
// e-mails modelo enviados de qualquer endereço.
function buildDebugQuery() {
  return [
    afterDateFilter(),
    "(subject:confirmada OR subject:confirmed",
    " OR subject:reserva OR subject:reservation)",
  ].join(" ");
}

async function fetchEmailsByQuery(query: string) {
  const gmail = getGmailClient();

  const listResponse = await gmail.users.messages.list({
    userId: "me",
    q: query,
    maxResults: 50,
  });

  const messageIds = listResponse.data.messages ?? [];
  const messages = await Promise.all(
    messageIds.map(({ id }) =>
      gmail.users.messages.get({ userId: "me", id: id! }),
    ),
  );

  return { gmail, messages: messages.map((r) => r.data) };
}

// Busca e-mails com filtro de remetente (cron de produção).
export function fetchUnreadAirbnbEmails() {
  return fetchEmailsByQuery(buildProductionQuery());
}

// Busca por assunto apenas, sem filtro de remetente (debug/teste com e-mail
// modelo enviado de qualquer endereço).
export function fetchEmailsForDebug() {
  return fetchEmailsByQuery(buildDebugQuery());
}

// Extrai o corpo em texto puro de uma mensagem do Gmail, removendo HTML.
export function extractEmailBody(message: {
  payload?: {
    body?: { data?: string | null };
    parts?: Array<{
      mimeType?: string | null;
      body?: { data?: string | null } | null;
    }> | null;
  } | null;
}) {
  const decode = (data: string) =>
    Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
      "utf-8",
    );

  const payload = message.payload;
  if (!payload) return "";

  if (payload.body?.data) {
    return decode(payload.body.data);
  }

  const textPart = payload.parts?.find(
    (part) => part.mimeType === "text/plain",
  );
  if (textPart?.body?.data) {
    return decode(textPart.body.data);
  }

  const htmlPart = payload.parts?.find((part) => part.mimeType === "text/html");
  if (htmlPart?.body?.data) {
    return decode(htmlPart.body.data).replace(/<[^>]+>/g, " ");
  }

  return "";
}

export async function markEmailRead(
  gmail: ReturnType<typeof getGmailClient>,
  messageId: string,
) {
  await gmail.users.messages.modify({
    userId: "me",
    id: messageId,
    requestBody: { removeLabelIds: ["UNREAD"] },
  });
}
