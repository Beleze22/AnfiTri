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
  payment: {
    status: "aguardando" | "autorizado" | "pago" | "cancelado" | "falhou";
  } | null;
};

const PAYMENT_LABELS: Record<string, { label: string; className: string }> = {
  aguardando: {
    label: "Aguardando pagamento",
    className: "bg-amber-light text-amber",
  },
  autorizado: {
    label: "Pagamento garantido",
    className: "bg-green-light text-green",
  },
  pago: { label: "Pago", className: "bg-green-light text-green" },
  cancelado: {
    label: "Pagamento cancelado",
    className: "bg-accent-light text-accent-dark",
  },
  falhou: {
    label: "Cobrança falhou",
    className: "bg-accent-light text-accent-dark",
  },
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
  const [actionError, setActionError] = useState<string | null>(null);
  const [descarteAberto, setDescarteAberto] = useState(false);
  // Guarda QUAL ação está em curso, não só um booleano: confirmar dispara
  // captura no Stripe e envio de e-mail, então há segundos de espera em que
  // a tela precisa dizer o que está acontecendo.
  const [processando, setProcessando] = useState<"confirm" | "cancel" | null>(
    null,
  );

  useEffect(() => {
    if (!bookingId) return;
    fetch(`/api/bookings/${bookingId}`)
      .then((response) => response.json())
      .then((data) => {
        setBooking(data);
        setActionError(null);
        setDescarteAberto(false);
        setProcessando(null);
      });
  }, [bookingId]);

  async function handleAction(action: "confirm" | "cancel") {
    // Sem esta guarda, um segundo clique durante a espera dispara outra
    // requisição: a primeira conclui e a segunda volta com "só é possível
    // cancelar uma reserva pendente ou confirmada", dando a impressão de que
    // a ação falhou quando ela tinha funcionado.
    if (!bookingId || processando) return;
    setActionError(null);
    setProcessando(action);

    try {
      const response = await fetch(`/api/bookings/${bookingId}/${action}`, {
        method: "PATCH",
      });
      if (!response.ok) {
        const body = await response.json();
        setActionError(body.error?.message ?? "Não foi possível concluir.");
        return;
      }
      onChanged?.();
      onClose();
    } catch {
      setActionError("Falha de conexão. Tente novamente.");
    } finally {
      setProcessando(null);
    }
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
            <div className="mt-2 flex flex-wrap gap-2">
              <StatusBadge status={booking.status} />
              {isAirbnb && <StatusBadge status="airbnb" />}
              {booking.payment && PAYMENT_LABELS[booking.payment.status] && (
                <span
                  className={`rounded-pill px-2.5 py-1 text-caption font-medium ${PAYMENT_LABELS[booking.payment.status].className}`}
                >
                  {PAYMENT_LABELS[booking.payment.status].label}
                </span>
              )}
            </div>
            {booking.totalPrice && (
              <p className="mt-2 text-body font-medium text-text-primary">
                R$ {booking.totalPrice}
              </p>
            )}

            {isAirbnb ? (
              <>
                <p className="mt-4 rounded-card bg-blue-light p-3 text-body text-blue">
                  Reservado direto no Airbnb. A comunicação com o hóspede
                  acontece pelo próprio Airbnb.
                </p>

                {actionError && (
                  <p className="mt-4 rounded-card bg-accent-light p-3 text-caption text-accent-dark">
                    {actionError}
                  </p>
                )}

                {/* Descartar NÃO cancela nada no Airbnb: o feed .ics só
                    bloqueia datas lá, nunca cancela uma reserva de lá
                    (arquitetura, seção 3.2). Serve para corrigir registro
                    errado — duplicata do parser ou data mal interpretada.
                    Fica separado do "Cancelar" das reservas do site, que é
                    ação de negócio, e exige confirmação: a seção 3.1 do design
                    escondia qualquer ação aqui, o que deixava duplicata sem
                    saída pela tela. */}
                {(booking.status === "pendente" ||
                  booking.status === "confirmado") &&
                  (descarteAberto ? (
                    <div className="mt-5 rounded-card border border-border p-3">
                      <p className="text-caption text-text-secondary">
                        Isto libera a data{" "}
                        <strong className="text-text-primary">
                          apenas aqui
                        </strong>
                        . Não cancela nada no Airbnb — nosso calendário só
                        bloqueia datas lá, nunca cancela reserva.
                      </p>
                      <p className="mt-2 text-caption text-text-secondary">
                        Use quando o Airbnb já cancelou a reserva, ou quando o
                        registro veio errado da leitura de e-mail. Se a reserva
                        ainda existe no Airbnb, a data ficará livre aqui e
                        ocupada lá.
                      </p>
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          disabled={processando !== null}
                          onClick={() => handleAction("cancel")}
                          className="flex-1 rounded-pill bg-accent px-4 py-2.5 text-body font-medium text-accent-text disabled:opacity-60"
                        >
                          {processando === "cancel"
                            ? "Descartando…"
                            : "Descartar"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDescarteAberto(false)}
                          className="flex-1 rounded-pill border border-border px-4 py-2.5 text-body text-text-primary"
                        >
                          Voltar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setDescarteAberto(true)}
                      className="mt-5 w-full rounded-pill border border-border px-4 py-2.5 text-body text-text-secondary"
                    >
                      Descartar registro
                    </button>
                  ))}
              </>
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

                {actionError && (
                  <p className="mt-4 rounded-card bg-accent-light p-3 text-caption text-accent-dark">
                    {actionError}
                  </p>
                )}

                {booking.status === "pendente" && (
                  <div className="mt-5 flex gap-2">
                    <button
                      type="button"
                      disabled={processando !== null}
                      onClick={() => handleAction("confirm")}
                      className="flex-1 rounded-pill bg-accent px-4 py-2.5 text-body font-medium text-accent-text disabled:opacity-60"
                    >
                      {processando === "confirm"
                        ? "Confirmando…"
                        : "Confirmar reserva"}
                    </button>
                    <button
                      type="button"
                      disabled={processando !== null}
                      onClick={() => handleAction("cancel")}
                      className="flex-1 rounded-pill border border-border px-4 py-2.5 text-body text-text-primary disabled:opacity-60"
                    >
                      {processando === "cancel" ? "Cancelando…" : "Cancelar"}
                    </button>
                  </div>
                )}
                {booking.status === "confirmado" && (
                  <div className="mt-5">
                    <button
                      type="button"
                      disabled={processando !== null}
                      onClick={() => handleAction("cancel")}
                      className="w-full rounded-pill border border-border px-4 py-2.5 text-body text-text-primary disabled:opacity-60"
                    >
                      {processando === "cancel"
                        ? "Cancelando…"
                        : "Cancelar reserva"}
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
