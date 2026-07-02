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
  const session = await getSession();
  if (!bookingId || !session) {
    notFound();
  }

  const booking = await getBookingById(bookingId);
  if (!booking || booking.userId !== session.sub) {
    notFound();
  }

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

      <div className="mt-6 w-full max-w-sm rounded-card border border-border bg-surface p-4 text-left">
        <p className="text-card-title font-semibold text-text-primary">
          {booking.property.title}
        </p>
        <div className="mt-2">
          <StatusBadge status="pendente" label="Pendente de confirmação" />
        </div>
        {booking.expiresAt && (
          <p className="mt-2 text-caption text-text-secondary">
            Prazo de confirmação: {formatter.format(booking.expiresAt)}
          </p>
        )}
      </div>

      <p className="mt-4 max-w-sm text-caption text-text-secondary">
        Acompanhe a resposta do gestor pela aba Mensagens.
      </p>

      <Link
        href="/perfil"
        className="mt-6 w-full max-w-sm rounded-pill bg-accent px-4 py-3 text-body font-medium text-accent-text"
      >
        Ver minhas reservas
      </Link>
      <Link href="/" className="mt-3 text-body text-text-secondary underline">
        Voltar ao início
      </Link>
    </main>
  );
}
