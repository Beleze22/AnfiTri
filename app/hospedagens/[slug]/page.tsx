import { IconBed, IconUsers } from "@tabler/icons-react";
import { notFound } from "next/navigation";

import { AmenityItem } from "@/components/public/AmenityItem";
import { PhotoCarousel } from "@/components/public/PhotoCarousel";
import { PropertyBookingSection } from "@/components/public/PropertyBookingSection";
import { getOccupiedRanges } from "@/lib/server/booking/service";
import { getPropertyBySlug } from "@/lib/server/properties/service";

export default async function PropertyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const property = await getPropertyBySlug(slug);
  if (!property) {
    notFound();
  }

  const occupiedRanges = (await getOccupiedRanges(property.id)).map(
    (range) => ({
      checkIn: range.checkIn.toISOString().slice(0, 10),
      checkOut: range.checkOut.toISOString().slice(0, 10),
    }),
  );

  return (
    <main className="min-h-screen bg-bg pb-24">
      <PhotoCarousel photos={property.photos} />

      <div className="px-4 py-4">
        <h1 className="text-page-title font-semibold text-text-primary">
          {property.title}
        </h1>
        <p className="text-body text-text-secondary">{property.location}</p>

        <div className="mt-2 flex gap-4 text-body text-text-secondary">
          <span className="flex items-center gap-1.5">
            <IconUsers size={18} /> {property.maxGuests} hóspedes
          </span>
          <span className="flex items-center gap-1.5">
            <IconBed size={18} /> {property.bedrooms} quartos
          </span>
        </div>

        <p className="mt-4 text-body text-text-primary">
          {property.description}
        </p>

        {property.amenities.length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-3">
            {property.amenities.map((amenity) => (
              <AmenityItem
                key={amenity.id}
                name={amenity.name}
                icon={amenity.icon}
              />
            ))}
          </div>
        )}
      </div>

      <PropertyBookingSection
        propertyId={property.id}
        slug={property.slug}
        basePrice={property.basePrice.toFixed(2)}
        occupiedRanges={occupiedRanges}
      />
    </main>
  );
}
