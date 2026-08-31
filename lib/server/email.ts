import { getGmailClient } from "@/lib/server/airbnb/gmail";

// Envio de e-mail pela conta do gestor, via Gmail API — mesma credencial já
// usada para ler as confirmações do Airbnb. Sem GMAIL_REFRESH_TOKEN/GMAIL_USER
// nada é enviado e o conteúdo cai no log do servidor, o que mantém o fluxo
// testável em desenvolvimento.

const CORES = {
  texto: "#272727",
  secundario: "#6b6862",
  borda: "#e5e3de",
  accent: "#f86363",
};

// Moldura comum a todos os e-mails. Estilos inline porque cliente de e-mail
// ignora folha de estilo externa e, na maioria, também <style> no head.
export function layoutEmail(conteudo: string) {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; color: ${CORES.texto};">
      <p style="font-size: 13px; letter-spacing: 0.12em; text-transform: uppercase; color: ${CORES.accent}; font-weight: 700; margin: 0 0 20px;">anfitri</p>
      ${conteudo}
      <p style="margin-top: 28px; padding-top: 16px; border-top: 1px solid ${CORES.borda}; color: ${CORES.secundario}; font-size: 12px;">
        Você recebeu este e-mail porque tem uma reserva conosco.
      </p>
    </div>`;
}

export function botaoEmail(href: string, rotulo: string) {
  return `<p style="margin: 24px 0;">
    <a href="${href}" style="background: ${CORES.accent}; color: #ffffff; padding: 12px 24px; border-radius: 999px; text-decoration: none; display: inline-block;">${rotulo}</a>
  </p>`;
}

export function blocoReserva(linhas: [string, string][]) {
  const celulas = linhas
    .map(
      ([rotulo, valor]) =>
        `<tr>
          <td style="padding: 4px 0; color: ${CORES.secundario}; font-size: 14px;">${rotulo}</td>
          <td style="padding: 4px 0 4px 16px; font-size: 14px; font-weight: 600;">${valor}</td>
        </tr>`,
    )
    .join("");
  return `<table style="margin: 20px 0; border: 1px solid ${CORES.borda}; border-radius: 14px; padding: 14px 18px; width: 100%;"><tbody>${celulas}</tbody></table>`;
}

export async function enviarEmail(input: {
  para: string;
  assunto: string;
  html: string;
}) {
  console.log(`[email] ${input.assunto} → ${input.para}`);

  if (!process.env.GMAIL_REFRESH_TOKEN || !process.env.GMAIL_USER) {
    return;
  }

  // RFC 2822 com assunto codificado (RFC 2047) por causa dos acentos.
  const assuntoCodificado = `=?UTF-8?B?${Buffer.from(input.assunto).toString("base64")}?=`;
  const raw = [
    `From: anfitri <${process.env.GMAIL_USER}>`,
    `To: ${input.para}`,
    `Subject: ${assuntoCodificado}`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=UTF-8",
    "",
    input.html,
  ].join("\r\n");

  await getGmailClient().users.messages.send({
    userId: "me",
    requestBody: {
      raw: Buffer.from(raw)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, ""),
    },
  });
}

// Notificação nunca pode derrubar a operação que a originou: uma reserva
// confirmada com sucesso não deve virar erro só porque o e-mail falhou.
export function enviarEmailSemBloquear(input: {
  para: string;
  assunto: string;
  html: string;
}) {
  void enviarEmail(input).catch((erro) => {
    console.error(`[email] falha ao enviar "${input.assunto}":`, erro);
  });
}
