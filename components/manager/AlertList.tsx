"use client";

import {
  IconAlertTriangle,
  IconCheck,
  IconMailExclamation,
  IconMailOff,
} from "@tabler/icons-react";
import { useCallback, useEffect, useState } from "react";

import { BookingDetailPanel } from "@/components/manager/BookingDetailPanel";
import { StatusBadge } from "@/components/ui/StatusBadge";

type Alert = {
  id: string;
  kind: "parser_sem_referencia" | "divergencia_airbnb" | "falha_de_email";
  title: string;
  detail: string;
  createdAt: string;
  booking: {
    id: string;
    status: "pendente" | "confirmado" | "cancelado" | "expirado";
    checkIn: string;
    checkOut: string;
    propertyTitle: string;
  } | null;
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  timeZone: "UTC",
});
const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

// Alertas de integração: o que os jobs detectaram e não podem decidir
// sozinhos. Sem esta tela os alertas existiriam no banco sem ninguém ver —
// que era exatamente o problema do array `skipped` devolvido no JSON do cron.
export function AlertList() {
  const [alerts, setAlerts] = useState<Alert[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const carregar = useCallback(() => {
    fetch("/api/alerts")
      .then((response) => response.json())
      .then(setAlerts);
  }, []);

  useEffect(carregar, [carregar]);

  async function resolver(id: string) {
    await fetch(`/api/alerts/${id}/resolve`, { method: "PATCH" });
    carregar();
  }

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-page-title font-semibold text-text-primary">
        Alertas
      </h1>
      <p className="mt-1 text-body text-text-secondary">
        Situações que a sincronização com o Airbnb detectou e que precisam da
        sua decisão.
      </p>

      {alerts === null ? (
        <p className="mt-6 text-body text-text-secondary">Carregando…</p>
      ) : alerts.length === 0 ? (
        <div className="mt-6 rounded-card border border-border bg-surface p-6 text-center">
          <IconCheck size={28} className="mx-auto text-green" />
          <p className="mt-2 text-body text-text-primary">
            Nenhum alerta em aberto.
          </p>
          <p className="mt-1 text-caption text-text-secondary">
            A leitura de e-mails e o calendário do Airbnb estão em dia.
          </p>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          {alerts.map((alert) => (
            <article
              key={alert.id}
              className="rounded-card border border-border bg-surface p-4"
            >
              <div className="flex items-start gap-3">
                {/* Cor por natureza do problema: âmbar para leitura de
                    e-mail, azul para divergência do Airbnb, coral para envio
                    que não saiu — este último afeta o hóspede diretamente. */}
                <span
                  className={`mt-0.5 shrink-0 ${
                    alert.kind === "parser_sem_referencia"
                      ? "text-amber"
                      : alert.kind === "falha_de_email"
                        ? "text-accent"
                        : "text-blue"
                  }`}
                >
                  {alert.kind === "parser_sem_referencia" ? (
                    <IconMailExclamation size={20} />
                  ) : alert.kind === "falha_de_email" ? (
                    <IconMailOff size={20} />
                  ) : (
                    <IconAlertTriangle size={20} />
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-card-title font-semibold text-text-primary">
                    {alert.title}
                  </p>
                  <p className="mt-0.5 text-caption text-text-secondary">
                    {dateTimeFormatter.format(new Date(alert.createdAt))}
                  </p>

                  <p className="mt-2 whitespace-pre-line text-body text-text-secondary">
                    {alert.detail}
                  </p>

                  {alert.booking && (
                    <button
                      type="button"
                      onClick={() => setSelectedId(alert.booking!.id)}
                      className="mt-3 flex w-full items-center gap-2 rounded-card border border-border p-3 text-left"
                    >
                      <StatusBadge status={alert.booking.status} />
                      <span className="min-w-0 flex-1 truncate text-body text-text-primary">
                        {alert.booking.propertyTitle}
                      </span>
                      <span className="shrink-0 text-caption text-text-secondary">
                        {dateFormatter.format(new Date(alert.booking.checkIn))}{" "}
                        –{" "}
                        {dateFormatter.format(new Date(alert.booking.checkOut))}
                      </span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => resolver(alert.id)}
                    className="mt-3 rounded-pill border border-border px-4 py-1.5 text-caption text-text-primary"
                  >
                    Marcar como resolvido
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <BookingDetailPanel
        bookingId={selectedId}
        onClose={() => setSelectedId(null)}
        onChanged={carregar}
      />
    </div>
  );
}
