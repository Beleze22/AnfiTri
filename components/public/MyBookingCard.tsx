import Link from "next/link";

import { StatusBadge } from "@/components/ui/StatusBadge";

type BookingWithProperty = {
  id: string;
  status: "pendente" | "confirmado" | "cancelado" | "expirado";
  checkIn: Date;
  checkOut: Date;
  expiresAt: Date | null;
  conversationId: string | null;
  property: { title: string };
};

// checkIn/checkOut são datas de calendário (sem hora) — timeZone: "UTC"
// evita que o fuso local (ex: Brasil, UTC-3) mostre o dia anterior.
const calendarDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  timeZone: "UTC",
});

// expiresAt é um instante real (prazo com hora) — aqui sim queremos o fuso
// local do navegador, sem override.
const expiryFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

// Mesmo padrão visual/código de cores de status do dashboard do gestor
// (design-ui-ux.md, seção 4.11 — consistência entre as duas áreas do
// produto). Card clicável, leva direto à conversa da reserva.
export function MyBookingCard({ booking }: { booking: BookingWithProperty }) {
  return (
    <Link
      href={
        booking.conversationId ? `/mensagens/${booking.conversationId}` : "#"
      }
      className="block rounded-card border border-border bg-surface p-3"
    >
      <div className="flex items-center justify-between">
        <span className="text-card-title font-semibold text-text-primary">
          {booking.property.title}
        </span>
        <StatusBadge status={booking.status} />
      </div>
      <p className="mt-1 text-caption text-text-secondary">
        {calendarDateFormatter.format(booking.checkIn)} –{" "}
        {calendarDateFormatter.format(booking.checkOut)}
      </p>
      {booking.status === "pendente" && booking.expiresAt && (
        <p className="mt-1 text-caption text-amber">
          Prazo de confirmação: {expiryFormatter.format(booking.expiresAt)}
        </p>
      )}
    </Link>
  );
}
