"use client";

import { IconSearch, IconUserCircle } from "@tabler/icons-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { BottomNav } from "@/components/ui/BottomNav";
import { RangeCalendar, type DateRange } from "@/components/ui/RangeCalendar";
import {
  PropertyCard,
  UnavailablePropertyCard,
} from "@/components/public/PropertyCard";
import type { Category } from "@/lib/server/categories";

type Photo = { url: string };
type PropertyListItem = {
  slug: string;
  title: string;
  location: string;
  photos: Photo[];
};

type PropertiesResponse =
  | { withDates: false; properties: PropertyListItem[] }
  | {
      withDates: true;
      available: (PropertyListItem & { totalPrice: string })[];
      unavailable: PropertyListItem[];
    };

function formatDateLabel(range: DateRange): string {
  if (!range.checkIn || !range.checkOut) return "Quando você quer ir?";
  // timeZone: "UTC" — checkIn/checkOut são datas de calendário (sem hora),
  // sem isso o fuso local (ex: Brasil, UTC-3) mostra o dia anterior.
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
  return `${formatter.format(range.checkIn)} – ${formatter.format(range.checkOut)}`;
}

export default function Home() {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [range, setRange] = useState<DateRange>({
    checkIn: null,
    checkOut: null,
  });
  const [category, setCategory] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [data, setData] = useState<PropertiesResponse | null>(null);

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then(setCategories);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (range.checkIn && range.checkOut) {
      params.set("checkIn", range.checkIn.toISOString().slice(0, 10));
      params.set("checkOut", range.checkOut.toISOString().slice(0, 10));
    }
    fetch(`/api/properties?${params.toString()}`)
      .then((response) => response.json())
      .then(setData);
  }, [category, range]);

  return (
    <main className="min-h-screen bg-bg pb-24">
      <header className="flex items-center justify-between px-4 py-4">
        <span className="text-page-title font-semibold text-text-primary">
          anfitri
        </span>
        <Link href="/perfil" className="text-text-secondary">
          <IconUserCircle size={26} />
        </Link>
      </header>

      <div className="px-4">
        <button
          type="button"
          onClick={() => setShowDatePicker((open) => !open)}
          className="flex w-full items-center gap-2 rounded-pill border border-border bg-surface px-4 py-3 text-left text-body text-text-primary"
        >
          <IconSearch size={18} className="text-text-secondary" />
          {range.checkIn && range.checkOut
            ? formatDateLabel(range)
            : "Buscar por data ou local"}
        </button>

        {showDatePicker && (
          <div className="mt-3 rounded-card border border-border bg-surface p-3">
            <p className="mb-2 text-card-title font-semibold text-text-primary">
              Quando você quer ir?
            </p>
            <RangeCalendar
              occupiedRanges={[]}
              value={range}
              onChange={setRange}
            />
            <button
              type="button"
              onClick={() => setShowDatePicker(false)}
              className="mt-3 w-full rounded-pill bg-accent py-2 text-body font-medium text-accent-text"
            >
              Buscar
            </button>
          </div>
        )}

        <div className="mt-4 flex gap-2 overflow-x-auto">
          {categories.map((cat) => (
            <button
              key={cat.slug}
              type="button"
              onClick={() =>
                setCategory((current) =>
                  current === cat.slug ? null : cat.slug,
                )
              }
              className={`shrink-0 rounded-pill border px-3 py-1.5 text-caption ${
                category === cat.slug
                  ? "border-accent bg-accent-light text-accent-dark"
                  : "border-border text-text-secondary"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 px-4">
        {!data ? null : !data.withDates ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data.properties.map((property) => (
              <PropertyCard key={property.slug} property={property} />
            ))}
          </div>
        ) : (
          <>
            {data.available.length > 0 && (
              <div>
                <p className="mb-3 text-card-title font-semibold text-text-primary">
                  Disponíveis nessas datas
                </p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {data.available.map((property) => (
                    <PropertyCard
                      key={property.slug}
                      property={property}
                      priceLabel={`R$ ${property.totalPrice} total`}
                    />
                  ))}
                </div>
              </div>
            )}
            {data.unavailable.length > 0 && (
              <div className="mt-6">
                <p className="mb-2 text-card-title font-semibold text-text-primary">
                  Indisponíveis nesse período
                </p>
                <div className="flex flex-col gap-1">
                  {data.unavailable.map((property) => (
                    <UnavailablePropertyCard
                      key={property.slug}
                      property={property}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <BottomNav />
    </main>
  );
}
