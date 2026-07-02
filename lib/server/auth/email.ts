// Envio real de e-mail (Resend, SES, etc) ainda não foi decidido — ver
// pendência discutida na Etapa 3. Até lá, o link aparece no log do servidor,
// o que já é suficiente para testar o fluxo de login do hóspede.
export async function sendMagicLinkEmail(email: string, link: string) {
  console.log(`[magic-link] e-mail para ${email}: ${link}`);
}
