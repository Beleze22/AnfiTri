import { IconCircleCheck } from "@tabler/icons-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { StatusBadge } from "@/components/ui/StatusBadge";
import { getBookingById } from "@/lib/server/booking/service";
import { getSession } from "@/lib/server/auth/session";

export default async function SucessoPage({
  searchParams,
}: {
  searchParams: Promise<{ bookingId?: string }>;
}) {
  const { bookingId } = await searchParams;
  if (!bookingId) {
    notFound();
  }

  // Reserva feita com e-mail já cadastrado não emite sessão (a posse do
  // e-mail ainda não foi provada) — nesse caso a página mostra a versão
  // genérica, sem detalhes da reserva, e orienta a entrar pelo link enviado.
  const session = await getSession();
  const booking = session ? await getBookingById(bookingId) : null;
  const ownBooking =
    booking && session && booking.userId === session.sub ? booking : null;

  const formatter = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <main className="flex min-h-screen flex-col items-center bg-bg px-4 py-10 text-center">
      <IconCircleCheck size={48} className="text-green" />
      <h1 className="mt-3 text-page-title font-semibold text-text-primary">
        Pedido enviado!
      </h1>

      {ownBooking ? (
        <div className="mt-6 w-full max-w-sm rounded-card border border-border bg-surface p-4 text-left">
          <p className="text-card-title font-semibold text-text-primary">
            {ownBooking.property.title}
          </p>
          <div className="mt-2">
            <StatusBadge status="pendente" label="Pendente de confirmação" />
          </div>
          {ownBooking.expiresAt && (
            <p className="mt-2 text-caption text-text-secondary">
              Prazo de confirmação: {formatter.format(ownBooking.expiresAt)}
            </p>
          )}
          {ownBooking.payment?.status === "autorizado" && (
            <p className="mt-2 rounded-card bg-green-light p-2 text-caption text-green">
              Cartão autorizado — a cobrança só acontece se o gestor aprovar a
              reserva. Se recusar ou o prazo vencer, nada é cobrado.
            </p>
          )}
          {ownBooking.payment?.status === "aguardando" && (
            <p className="mt-2 rounded-card bg-accent-light p-2 text-caption text-accent-dark">
              Pagamento não concluído — sem ele o pedido expira sozinho e a data
              volta a ficar disponível.
            </p>
          )}
        </div>
      ) : (
        <div className="mt-6 w-full max-w-sm rounded-card border border-border bg-surface p-4 text-left">
          <p className="text-body text-text-primary">
            Esse e-mail já tem cadastro por aqui. Enviamos um link de acesso
            para ele — entre por lá para acompanhar a reserva.
          </p>
        </div>
      )}

      <p className="mt-4 max-w-sm text-caption text-text-secondary">
        Acompanhe a resposta do gestor pela aba Mensagens.
      </p>

      {ownBooking ? (
        <Link
          href="/perfil"
          className="mt-6 w-full max-w-sm rounded-pill bg-accent px-4 py-3 text-body font-medium text-accent-text"
        >
          Ver minhas reservas
        </Link>
      ) : null}
      <Link href="/" className="mt-3 text-body text-text-secondary underline">
        Voltar ao início
      </Link>
    </main>
  );
}
