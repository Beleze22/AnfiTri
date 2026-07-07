"use client";

import {
  IconBrandWhatsapp,
  IconMail,
  IconMessageCircle2,
  IconX,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";

import { StatusBadge } from "@/components/ui/StatusBadge";

type BookingDetail = {
  id: string;
  status: "pendente" | "confirmado" | "cancelado" | "expirado";
  source: "airbnb" | "manual" | "site";
  checkIn: string;
  checkOut: string;
  totalPrice: string | null;
  property: { title: string };
  user: { name: string; email: string; phone: string | null };
  conversation: { id: string } | null;
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  timeZone: "UTC",
});

function whatsappLink(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const withCountryCode = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${withCountryCode}`;
}

// Painel lateral de detalhes (design-ui-ux.md, seção 3.1) — componente único,
// reaproveitado entre Dashboard, Calendário e bookings, e Inbox. O conteúdo
// se adapta à origem/status do booking, não três painéis diferentes.
export function BookingDetailPanel({
  bookingId,
  onClose,
  onChanged,
}: {
  bookingId: string | null;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const [booking, setBooking] = useState<BookingDetail | null>(null);

  useEffect(() => {
    if (!bookingId) return;
    fetch(`/api/bookings/${bookingId}`)
      .then((response) => response.json())
      .then(setBooking);
  }, [bookingId]);

  async function handleAction(action: "confirm" | "cancel") {
    if (!bookingId) return;
    await fetch(`/api/bookings/${bookingId}/${action}`, { method: "PATCH" });
    onChanged?.();
    onClose();
  }

  const open = bookingId !== null;
  const isAirbnb = booking?.source === "airbnb";

  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 z-20 bg-[rgba(39,39,39,0.25)] transition-opacity ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <aside
        className={`fixed right-0 top-0 z-30 h-screen w-full max-w-85 overflow-y-auto bg-surface p-4 shadow-lg transition-transform ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="text-text-secondary"
        >
          <IconX size={20} />
        </button>

        {!booking ? (
          <p className="mt-4 text-body text-text-secondary">Carregando…</p>
        ) : (
          <div className="mt-2">
            <p className="text-card-title font-semibold text-text-primary">
              {booking.property.title}
            </p>
            <p className="mt-1 text-caption text-text-secondary">
              {dateFormatter.format(new Date(booking.checkIn))} –{" "}
              {dateFormatter.format(new Date(booking.checkOut))}
            </p>
            <div className="mt-2 flex gap-2">
              <StatusBadge status={booking.status} />
              {isAirbnb && <StatusBadge status="airbnb" />}
            </div>
            {booking.totalPrice && (
              <p className="mt-2 text-body font-medium text-text-primary">
                R$ {booking.totalPrice}
              </p>
            )}

            {isAirbnb ? (
              <p className="mt-4 rounded-card bg-blue-light p-3 text-body text-blue">
                Reservado direto no Airbnb. A comunicação com o hóspede acontece
                pelo próprio Airbnb.
              </p>
            ) : (
              <>
                <div className="mt-4 rounded-card border border-border p-3">
                  <p className="text-body font-medium text-text-primary">
                    {booking.user.name}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-caption text-text-secondary">
                    <IconMail size={14} /> {booking.user.email}
                  </p>
                  {booking.user.phone && (
                    <a
                      href={whatsappLink(booking.user.phone)}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1.5 rounded-pill bg-green-light px-3 py-1.5 text-caption font-medium text-green"
                    >
                      <IconBrandWhatsapp size={16} /> WhatsApp
                    </a>
                  )}
                </div>

                {booking.conversation && (
                  <a
                    href={`/gestor/mensagens/${booking.conversation.id}`}
                    className="mt-3 flex items-center gap-1.5 text-body text-accent"
                  >
                    <IconMessageCircle2 size={16} /> Ver conversa
                  </a>
                )}

                {booking.status === "pendente" && (
                  <div className="mt-5 flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleAction("confirm")}
                      className="flex-1 rounded-pill bg-accent px-4 py-2.5 text-body font-medium text-accent-text"
                    >
                      Confirmar reserva
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAction("cancel")}
                      className="flex-1 rounded-pill border border-border px-4 py-2.5 text-body text-text-primary"
                    >
                      Cancelar
                    </button>
                  </div>
                )}
                {booking.status === "confirmado" && (
                  <div className="mt-5">
                    <button
                      type="button"
                      onClick={() => handleAction("cancel")}
                      className="w-full rounded-pill border border-border px-4 py-2.5 text-body text-text-primary"
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </aside>
    </>
  );
}
