import { prisma } from "@/lib/db/client";
import {
  blocoReserva,
  enviarEmailSemBloquear,
  layoutEmail,
} from "@/lib/server/email";

// Avisos ao hóspede a cada mudança de estado da reserva. Todos disparados
// sem bloquear: confirmar uma reserva não pode falhar porque o e-mail falhou.
//
// Reserva vinda do Airbnb nunca gera aviso — o hóspede é o usuário
// placeholder (reservas-airbnb@anfitri.internal), não uma pessoa, e a
// comunicação com esse hóspede acontece no próprio Airbnb.

const PLACEHOLDER = "reservas-airbnb@anfitri.internal";

const dataCurta = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  timeZone: "UTC",
});

const dataHora = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

async function carregar(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { property: true, user: true },
  });
  if (!booking) return null;
  if (booking.source === "airbnb") return null;
  if (booking.user.email === PLACEHOLDER) return null;
  return booking;
}

type Reserva = NonNullable<Awaited<ReturnType<typeof carregar>>>;

function periodo(booking: Reserva) {
  return `${dataCurta.format(booking.checkIn)} a ${dataCurta.format(booking.checkOut)}`;
}

function detalhes(booking: Reserva): [string, string][] {
  const linhas: [string, string][] = [
    ["Hospedagem", booking.property.title],
    ["Entrada", dataCurta.format(booking.checkIn)],
    ["Saída", dataCurta.format(booking.checkOut)],
  ];
  if (booking.totalPrice) {
    linhas.push(["Total", `R$ ${booking.totalPrice}`]);
  }
  return linhas;
}

export async function avisarReservaSolicitada(bookingId: string) {
  const booking = await carregar(bookingId);
  if (!booking) return;

  const prazo = booking.expiresAt
    ? `até ${dataHora.format(booking.expiresAt)}`
    : "em breve";

  enviarEmailSemBloquear({
    para: booking.user.email,
    assunto: `Recebemos seu pedido — ${booking.property.title}`,
    html: layoutEmail(`
      <p>Olá, ${booking.user.name}!</p>
      <p>
        Seu pedido de reserva foi registrado e as datas já estão guardadas para você.
        O gestor responde <strong>${prazo}</strong>.
      </p>
      ${blocoReserva(detalhes(booking))}
      <p style="color: #6b6862; font-size: 13px;">
        Você não precisa fazer mais nada — avisaremos por e-mail assim que a reserva
        for confirmada.
      </p>`),
  });
}

export async function avisarReservaConfirmada(bookingId: string) {
  const booking = await carregar(bookingId);
  if (!booking) return;

  enviarEmailSemBloquear({
    para: booking.user.email,
    assunto: `Reserva confirmada — ${booking.property.title}`,
    html: layoutEmail(`
      <p>Olá, ${booking.user.name}!</p>
      <p>
        <strong>Sua reserva está confirmada</strong> para ${periodo(booking)}.
      </p>
      ${blocoReserva(detalhes(booking))}
      <p style="color: #6b6862; font-size: 13px;">
        Qualquer dúvida sobre a estadia, é só responder pela conversa da reserva.
      </p>`),
  });
}

export async function avisarReservaCancelada(bookingId: string) {
  const booking = await carregar(bookingId);
  if (!booking) return;

  enviarEmailSemBloquear({
    para: booking.user.email,
    assunto: `Reserva cancelada — ${booking.property.title}`,
    html: layoutEmail(`
      <p>Olá, ${booking.user.name}.</p>
      <p>Sua reserva de ${periodo(booking)} foi cancelada.</p>
      ${blocoReserva(detalhes(booking))}
      <p style="color: #6b6862; font-size: 13px;">
        Se houve cobrança, o estorno é feito automaticamente. Se o cartão estava
        apenas autorizado, a retenção é liberada e nada é cobrado.
      </p>`),
  });
}

export async function avisarReservaExpirada(bookingId: string) {
  const booking = await carregar(bookingId);
  if (!booking) return;

  enviarEmailSemBloquear({
    para: booking.user.email,
    assunto: `Seu pedido expirou — ${booking.property.title}`,
    html: layoutEmail(`
      <p>Olá, ${booking.user.name}.</p>
      <p>
        O prazo de resposta do seu pedido para ${periodo(booking)} venceu, e as datas
        voltaram a ficar disponíveis.
      </p>
      ${blocoReserva(detalhes(booking))}
      <p style="color: #6b6862; font-size: 13px;">
        Nada foi cobrado. Se ainda tiver interesse nessas datas, é só fazer um novo
        pedido pelo site.
      </p>`),
  });
}

// Aviso ao gestor de que há pedido novo com prazo correndo. Sem isto, ele
// precisa lembrar de abrir o painel dentro da janela de expiração.
export async function avisarGestorNovoPedido(bookingId: string) {
  const booking = await carregar(bookingId);
  if (!booking) return;

  const gestor = await prisma.user.findFirst({ where: { role: "gestor" } });
  if (!gestor) return;

  const prazo = booking.expiresAt
    ? dataHora.format(booking.expiresAt)
    : "sem prazo definido";

  enviarEmailSemBloquear({
    para: gestor.email,
    assunto: `Novo pedido de reserva — ${booking.property.title}`,
    html: layoutEmail(`
      <p>Há um pedido novo aguardando sua resposta.</p>
      ${blocoReserva([
        ...detalhes(booking),
        ["Hóspede", booking.user.name],
        ["Contato", booking.user.phone ?? booking.user.email],
        ["Responder até", prazo],
      ])}
      <p style="color: #6b6862; font-size: 13px;">
        Sem resposta até o prazo, o pedido expira sozinho e a data é liberada.
      </p>`),
  });
}

// O hóspede desistiu antes da aprovação. A data volta ao mercado na hora e o
// gestor precisa saber — se a desistência acontece de madrugada, sem este
// aviso ele só descobre ao abrir o painel.
export async function avisarGestorCancelamentoDoHospede(bookingId: string) {
  const booking = await carregar(bookingId);
  if (!booking) return;

  const gestor = await prisma.user.findFirst({ where: { role: "gestor" } });
  if (!gestor) return;

  enviarEmailSemBloquear({
    para: gestor.email,
    assunto: `Pedido cancelado pelo hóspede — ${booking.property.title}`,
    html: layoutEmail(`
      <p>
        <strong>${booking.user.name}</strong> desistiu do pedido antes da sua
        resposta. As datas já voltaram a ficar disponíveis.
      </p>
      ${blocoReserva([...detalhes(booking), ["Hóspede", booking.user.name]])}
      <p style="color: #6b6862; font-size: 13px;">
        Nenhuma cobrança foi feita. Se havia cartão autorizado, a retenção foi
        liberada automaticamente.
      </p>`),
  });
}
