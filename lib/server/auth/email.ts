import { botaoEmail, enviarEmail, layoutEmail } from "@/lib/server/email";

// Magic link do hóspede (arquitetura, seção 3.4). O link também vai para o
// log do servidor — facilita depurar mesmo com envio real, e é o que permite
// testar o fluxo em desenvolvimento sem credencial do Gmail.
export async function sendMagicLinkEmail(email: string, link: string) {
  console.log(`[magic-link] e-mail para ${email}: ${link}`);

  await enviarEmail({
    para: email,
    assunto: "Seu link de acesso — anfitri",
    html: layoutEmail(`
      <p>Recebemos um pedido de acesso às suas reservas.</p>
      ${botaoEmail(link, "Acessar minhas reservas")}
      <p style="color: #6b6862; font-size: 13px;">
        O link vale por 15 minutos e só pode ser usado uma vez.
        Se você não pediu esse acesso, ignore este e-mail.
      </p>`),
  });
}
