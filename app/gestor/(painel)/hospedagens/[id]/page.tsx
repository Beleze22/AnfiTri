import { notFound } from "next/navigation";

import { PropertyEditForm } from "@/components/manager/PropertyEditForm";
import { getPropertyById } from "@/lib/server/properties/service";

export default async function EditarHospedagemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const property = await getPropertyById(id);
  if (!property) {
    notFound();
  }

  return (
    <PropertyEditForm
      property={{
        id: property.id,
        title: property.title,
        description: property.description,
        location: property.location,
        category: property.category,
        maxGuests: property.maxGuests,
        bedrooms: property.bedrooms,
        basePrice: property.basePrice.toFixed(2),
        status: property.status,
        airbnbIcalUrl: property.airbnbIcalUrl,
        airbnbSyncedAt: property.airbnbSyncedAt
          ? property.airbnbSyncedAt.toISOString()
          : null,
        photos: property.photos.map((photo) => ({
          id: photo.id,
          url: photo.url,
          isCover: photo.isCover,
        })),
        amenities: property.amenities.map((amenity) => ({
          id: amenity.id,
          name: amenity.name,
          icon: amenity.icon,
        })),
      }}
    />
  );
}
