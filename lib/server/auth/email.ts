import { getGmailClient } from "@/lib/server/airbnb/gmail";

// Envio real via Gmail API — reusa o OAuth da conta do gestor já configurado
// para a leitura dos e-mails do Airbnb (Etapa 7). Exige o escopo gmail.send
// no refresh token. Sem credenciais (dev local sem .env), cai no log do
// servidor, que continua suficiente para testar o fluxo.
export async function sendMagicLinkEmail(email: string, link: string) {
  // O link sempre vai para o log — facilita depurar mesmo com envio real.
  console.log(`[magic-link] e-mail para ${email}: ${link}`);

  if (!process.env.GMAIL_REFRESH_TOKEN || !process.env.GMAIL_USER) {
    return;
  }

  const subject = "Seu link de acesso — anfitri";
  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #272727;">anfitri</h2>
      <p>Recebemos um pedido de acesso às suas reservas.</p>
      <p style="margin: 24px 0;">
        <a href="${link}"
           style="background: #e8555a; color: #ffffff; padding: 12px 24px;
                  border-radius: 999px; text-decoration: none;">
          Acessar minhas reservas
        </a>
      </p>
      <p style="color: #6b6b6b; font-size: 13px;">
        O link vale por 15 minutos e só pode ser usado uma vez.
        Se você não pediu esse acesso, ignore este e-mail.
      </p>
    </div>`;

  // RFC 2822 com assunto codificado (RFC 2047) por causa dos acentos.
  const encodedSubject = `=?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`;
  const raw = [
    `From: anfitri <${process.env.GMAIL_USER}>`,
    `To: ${email}`,
    `Subject: ${encodedSubject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=UTF-8",
    "",
    html,
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
