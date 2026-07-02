import { IconClock } from "@tabler/icons-react";
import { notFound } from "next/navigation";

import { BookingRequestForm } from "@/components/public/BookingRequestForm";
import { getManagerExpiryConfig } from "@/lib/server/booking/service";
import { getPropertyBySlug } from "@/lib/server/properties/service";
import { calculatePriceForStay } from "@/lib/server/pricing/calculate";

export default async function ReservarPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ checkIn?: string; checkOut?: string }>;
}) {
  const { slug } = await params;
  const { checkIn, checkOut } = await searchParams;
  const property = await getPropertyBySlug(slug);
  if (!property || !checkIn || !checkOut) {
    notFound();
  }

  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  const nights = Math.round(
    (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24),
  );
  const { total } = await calculatePriceForStay(
    property.id,
    checkInDate,
    checkOutDate,
  );
  const { defaultExpiryHours } = await getManagerExpiryConfig();

  // timeZone: "UTC" — checkIn/checkOut são datas de calendário (sem hora),
  // sem isso o fuso local (ex: Brasil, UTC-3) mostra o dia anterior.
  const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
  const dateLabel = `${dateFormatter.format(checkInDate)} – ${dateFormatter.format(checkOutDate)}`;

  return (
    <main className="min-h-screen bg-bg px-4 py-4">
      <h1 className="text-page-title font-semibold text-text-primary">
        {property.title}
      </h1>
      <p className="text-body text-text-secondary">{dateLabel}</p>

      <div className="mt-4 flex items-start gap-2 rounded-card bg-accent-light p-3 text-body text-accent-dark">
        <IconClock size={20} className="mt-0.5 shrink-0" />
        <p>
          A data fica reservada provisoriamente. Você terá até{" "}
          <strong>{defaultExpiryHours} horas</strong> para receber a confirmação
          do gestor — se o prazo passar sem resposta, a reserva expira
          automaticamente e a data é liberada.
        </p>
      </div>

      <div className="mt-4 rounded-card border border-border bg-surface p-4">
        <div className="flex justify-between text-body text-text-secondary">
          <span>{nights} noites</span>
          <span className="font-medium text-text-primary">
            R$ {total.toFixed(2)}
          </span>
        </div>
      </div>

      <BookingRequestForm
        propertyId={property.id}
        checkIn={checkIn}
        checkOut={checkOut}
      />
    </main>
  );
}
