"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { RangeCalendar, type DateRange } from "@/components/ui/RangeCalendar";

// Calendário sempre visível (changelog de design, item 4 — nunca escondido
// atrás de campos de check-in/check-out) + barra de ação fixa no rodapé, que
// substitui o bottom nav nesta tela (seção 3.6, exceção).
export function PropertyBookingSection({
  propertyId,
  slug,
  basePrice,
  occupiedRanges,
}: {
  propertyId: string;
  slug: string;
  basePrice: string;
  occupiedRanges: { checkIn: string; checkOut: string }[];
}) {
  const router = useRouter();
  const [range, setRange] = useState<DateRange>({
    checkIn: null,
    checkOut: null,
  });
  const [total, setTotal] = useState<string | null>(null);

  useEffect(() => {
    if (!range.checkIn || !range.checkOut) return;
    const params = new URLSearchParams({
      checkIn: range.checkIn.toISOString().slice(0, 10),
      checkOut: range.checkOut.toISOString().slice(0, 10),
    });
    fetch(`/api/properties/${propertyId}/price?${params.toString()}`)
      .then((response) => response.json())
      .then((data) => setTotal(data.total));
  }, [propertyId, range]);

  function handleRangeChange(next: DateRange) {
    setRange(next);
    if (!next.checkIn || !next.checkOut) {
      setTotal(null);
    }
  }

  // timeZone: "UTC" — checkIn/checkOut são datas de calendário (sem hora),
  // sem isso o fuso local (ex: Brasil, UTC-3) mostra o dia anterior.
  const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
  const dateLabel =
    range.checkIn && range.checkOut
      ? `${dateFormatter.format(range.checkIn)} – ${dateFormatter.format(range.checkOut)}`
      : null;

  return (
    <>
      <section className="px-4 py-4">
        <h2 className="mb-3 text-card-title font-semibold text-text-primary">
          Disponibilidade
        </h2>
        <RangeCalendar
          occupiedRanges={occupiedRanges}
          value={range}
          onChange={handleRangeChange}
        />
      </section>

      <div className="fixed inset-x-0 bottom-0 z-10 flex items-center justify-between border-t border-border bg-surface px-4 py-3">
        <div>
          <p className="text-body font-semibold text-text-primary">
            {total ? `R$ ${total} total` : `R$ ${basePrice} / noite`}
          </p>
          {dateLabel && (
            <p className="text-caption text-text-secondary">{dateLabel}</p>
          )}
        </div>
        <button
          type="button"
          disabled={!range.checkIn || !range.checkOut}
          onClick={() =>
            router.push(
              `/hospedagens/${slug}/reservar?checkIn=${range.checkIn!.toISOString().slice(0, 10)}&checkOut=${range.checkOut!.toISOString().slice(0, 10)}`,
            )
          }
          className="rounded-pill bg-accent px-5 py-2.5 text-body font-medium text-accent-text disabled:opacity-40"
        >
          Reservar
        </button>
      </div>
    </>
  );
}
