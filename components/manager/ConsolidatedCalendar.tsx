"use client";

import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { useEffect, useState } from "react";

import { BookingDetailPanel } from "@/components/manager/BookingDetailPanel";
import { startOfWeek } from "@/lib/shared/dates";

type WeekBooking = {
  id: string;
  checkIn: string;
  checkOut: string;
  status: "pendente" | "confirmado";
  source: "airbnb" | "manual" | "site";
  userName: string;
};

type WeekProperty = {
  id: string;
  title: string;
  bookings: WeekBooking[];
};

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const RANGE_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  timeZone: "UTC",
});

function toKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function barClass(booking: WeekBooking) {
  if (booking.status === "pendente") return "bg-amber text-accent-text";
  if (booking.source === "airbnb") return "bg-blue text-accent-text";
  return "bg-green text-accent-text";
}

// Grade de calendário consolidado (design-ui-ux.md, seção 3.4) — navegação
// semanal, hospedagens nas linhas, reaproveita o painel lateral de detalhes
// (3.1) ao clicar em qualquer reserva.
export function ConsolidatedCalendar() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [properties, setProperties] = useState<WeekProperty[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/calendar/week?weekStart=${toKey(weekStart)}`)
      .then((response) => response.json())
      .then((data) => setProperties(data.properties));
  }, [weekStart]);

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart);
    date.setUTCDate(date.getUTCDate() + i);
    return date;
  });
  const todayKey = toKey(new Date());
  const weekEnd = days[6];

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-page-title font-semibold text-text-primary">
          Calendário e bookings
        </h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setWeekStart(startOfWeek(new Date()))}
            className="rounded-pill border border-border px-3 py-1.5 text-caption text-text-primary"
          >
            Hoje
          </button>
          <button
            type="button"
            aria-label="Semana anterior"
            onClick={() =>
              setWeekStart((current) => {
                const next = new Date(current);
                next.setUTCDate(next.getUTCDate() - 7);
                return next;
              })
            }
            className="rounded-pill p-1.5 text-text-secondary"
          >
            <IconChevronLeft size={18} />
          </button>
          <span className="text-body text-text-secondary">
            {RANGE_FORMATTER.format(weekStart)} –{" "}
            {RANGE_FORMATTER.format(weekEnd)}
          </span>
          <button
            type="button"
            aria-label="Próxima semana"
            onClick={() =>
              setWeekStart((current) => {
                const next = new Date(current);
                next.setUTCDate(next.getUTCDate() + 7);
                return next;
              })
            }
            className="rounded-pill p-1.5 text-text-secondary"
          >
            <IconChevronRight size={18} />
          </button>
        </div>
      </div>

      <div className="mt-4 flex gap-4 text-caption text-text-secondary">
        <Legend color="bg-green" label="Confirmado" />
        <Legend color="bg-amber" label="Pendente" />
        <Legend color="bg-blue" label="Airbnb" />
      </div>

      {/* No mobile a semana inteira não cabe — a grade rola na horizontal
          dentro do card, com largura mínima para as barras continuarem
          legíveis. */}
      <div className="mt-4 overflow-x-auto rounded-card border border-border bg-surface">
        <div className="min-w-160">
          <div className="grid grid-cols-[160px_1fr] border-b border-border">
            <div />
            <div className="grid grid-cols-7">
              {days.map((date) => (
                <div
                  key={toKey(date)}
                  className={`px-2 py-2 text-center text-caption text-text-secondary ${
                    toKey(date) === todayKey ? "bg-accent-light" : ""
                  }`}
                >
                  {WEEKDAY_LABELS[date.getUTCDay()]} {date.getUTCDate()}
                </div>
              ))}
            </div>
          </div>

          {properties.map((property) => (
            <div
              key={property.id}
              className="grid grid-cols-[160px_1fr] border-b border-border last:border-b-0"
            >
              <div className="flex items-center px-3 py-3 text-body text-text-primary">
                {property.title}
              </div>
              <div className="relative grid grid-cols-7 gap-px py-2">
                {days.map((date) => (
                  <div
                    key={toKey(date)}
                    className={
                      toKey(date) === todayKey ? "bg-accent-light" : ""
                    }
                  />
                ))}
                {property.bookings.map((booking) => {
                  const startCol = Math.max(
                    0,
                    Math.round(
                      (new Date(booking.checkIn).getTime() -
                        weekStart.getTime()) /
                        (1000 * 60 * 60 * 24),
                    ),
                  );
                  const endCol = Math.min(
                    7,
                    Math.round(
                      (new Date(booking.checkOut).getTime() -
                        weekStart.getTime()) /
                        (1000 * 60 * 60 * 24),
                    ),
                  );
                  if (endCol <= 0 || startCol >= 7) return null;

                  // Cantos arredondados só onde a reserva começa/termina nesta
                  // semana — se estiver cortada pela semana anterior/seguinte,
                  // o lado cortado fica reto (efeito "pílula contínua").
                  const startsThisWeek =
                    new Date(booking.checkIn).getTime() >= weekStart.getTime();
                  const weekEnd = new Date(weekStart);
                  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);
                  const endsThisWeek =
                    new Date(booking.checkOut).getTime() <= weekEnd.getTime();
                  const roundedClass = [
                    startsThisWeek ? "rounded-l-full" : "",
                    endsThisWeek ? "rounded-r-full" : "",
                  ]
                    .filter(Boolean)
                    .join(" ");

                  // O respiro lateral entra no cálculo de left/width (nunca
                  // como margem: margem além dos 100% cria scroll horizontal)
                  // e só nos lados em que a reserva começa/termina — o lado
                  // cortado fica rente à borda, colando na semana vizinha.
                  const leftInsetPx = startsThisWeek ? 2 : 0;
                  const rightInsetPx = endsThisWeek ? 2 : 0;
                  const left = `calc(${(startCol / 7) * 100}% + ${leftInsetPx}px)`;
                  const width = `calc(${((endCol - startCol) / 7) * 100}% - ${leftInsetPx + rightInsetPx}px)`;

                  return (
                    <button
                      key={booking.id}
                      type="button"
                      onClick={() => setSelectedId(booking.id)}
                      style={{
                        position: "absolute",
                        top: 8,
                        bottom: 8,
                        left,
                        width,
                      }}
                      className={`truncate px-2 text-left text-caption font-medium ${roundedClass} ${barClass(booking)}`}
                    >
                      {booking.userName}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <BookingDetailPanel
        bookingId={selectedId}
        onClose={() => setSelectedId(null)}
        onChanged={() => setWeekStart((current) => new Date(current))}
      />
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${color}`} /> {label}
    </span>
  );
}
