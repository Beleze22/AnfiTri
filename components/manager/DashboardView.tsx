"use client";

import { IconChevronRight } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { BookingDetailPanel } from "@/components/manager/BookingDetailPanel";

type BookingListItem = {
  id: string;
  checkIn: string;
  checkOut: string;
  totalPrice: string | null;
  expiresAt: string | null;
  source: "airbnb" | "manual" | "site";
  property: { title: string };
  user: { name: string };
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  timeZone: "UTC",
});

function formatRemaining(expiresAt: string) {
  const ms = new Date(expiresAt).getTime() - Date.now();
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const urgent = ms < 2 * 60 * 60 * 1000;
  const label =
    ms <= 0
      ? "Expirando"
      : hours > 0
        ? `${hours}h ${minutes}min restantes`
        : `${minutes}min restantes`;
  return { label, urgent };
}

export function DashboardView({
  metrics,
  pending,
  upcoming,
}: {
  metrics: {
    pendingCount: number;
    confirmedThisMonth: number;
    occupancyPercent: number;
    unreadCount: number;
  };
  pending: BookingListItem[];
  upcoming: BookingListItem[];
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  function refresh() {
    router.refresh();
  }

  return (
    <div className="p-6">
      <h1 className="mb-5 text-page-title font-semibold text-text-primary">
        Dashboard
      </h1>

      <div className="grid grid-cols-4 gap-4">
        <MetricCard label="Pendentes" value={metrics.pendingCount} />
        <MetricCard
          label="Confirmadas (mês)"
          value={metrics.confirmedThisMonth}
        />
        <MetricCard
          label="Ocupação (mês)"
          value={`${metrics.occupancyPercent}%`}
        />
        <MetricCard label="Mensagens novas" value={metrics.unreadCount} />
      </div>

      <div className="mt-8 grid grid-cols-2 gap-6">
        <section>
          <h2 className="mb-3 text-card-title font-semibold text-text-primary">
            Reservas pendentes
          </h2>
          <div className="flex flex-col gap-2">
            {pending.length === 0 && (
              <p className="text-body text-text-secondary">
                Nenhuma reserva pendente.
              </p>
            )}
            {pending.map((booking) => {
              const remaining = booking.expiresAt
                ? formatRemaining(booking.expiresAt)
                : null;
              return (
                <button
                  key={booking.id}
                  type="button"
                  onClick={() => setSelectedId(booking.id)}
                  className="flex items-center justify-between rounded-card border border-border bg-surface p-3 text-left"
                >
                  <div>
                    <p className="text-body font-medium text-text-primary">
                      {booking.property.title} — {booking.user.name}
                    </p>
                    <p className="text-caption text-text-secondary">
                      {dateFormatter.format(new Date(booking.checkIn))} –{" "}
                      {dateFormatter.format(new Date(booking.checkOut))}
                      {booking.totalPrice && ` · R$ ${booking.totalPrice}`}
                    </p>
                    {remaining && (
                      <p
                        className={`text-caption ${
                          remaining.urgent
                            ? "font-medium text-amber"
                            : "text-text-secondary"
                        }`}
                      >
                        {remaining.label}
                      </p>
                    )}
                  </div>
                  <IconChevronRight size={18} className="text-text-secondary" />
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-card-title font-semibold text-text-primary">
            Próximos check-ins
          </h2>
          <div className="flex flex-col gap-2">
            {upcoming.length === 0 && (
              <p className="text-body text-text-secondary">
                Nenhum check-in agendado.
              </p>
            )}
            {upcoming.map((booking) => (
              <button
                key={booking.id}
                type="button"
                onClick={() => setSelectedId(booking.id)}
                className="flex items-center justify-between rounded-card border border-border bg-surface p-3 text-left"
              >
                <div>
                  <p className="text-body font-medium text-text-primary">
                    {booking.property.title} — {booking.user.name}
                  </p>
                  <p className="text-caption text-text-secondary">
                    {dateFormatter.format(new Date(booking.checkIn))}
                    {booking.source === "airbnb" && " · Airbnb"}
                  </p>
                </div>
                <IconChevronRight size={18} className="text-text-secondary" />
              </button>
            ))}
          </div>
        </section>
      </div>

      <BookingDetailPanel
        bookingId={selectedId}
        onClose={() => setSelectedId(null)}
        onChanged={refresh}
      />
    </div>
  );
}

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <p className="text-caption text-text-secondary">{label}</p>
      <p className="mt-1 text-page-title font-semibold text-text-primary">
        {value}
      </p>
    </div>
  );
}
