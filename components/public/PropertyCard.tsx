import Link from "next/link";

type PropertyCardData = {
  slug: string;
  title: string;
  location: string;
  photos: { url: string }[];
};

function CoverPhoto({
  photo,
  className,
}: {
  photo?: { url: string };
  className: string;
}) {
  if (!photo) {
    // Sem foto cadastrada ainda — storage de fotos é pendência aberta
    // (arquitetura, seção 11), ainda não resolvida.
    return <div className={`${className} bg-border`} />;
  }
  // eslint-disable-next-line @next/next/no-img-element -- URL de storage externo, ainda a decidir (pendência de storage)
  return <img src={photo.url} alt="" className={`${className} object-cover`} />;
}

// Card completo — orientação vertical para grid responsivo (seção 3.5).
export function PropertyCard({
  property,
  priceLabel,
}: {
  property: PropertyCardData;
  priceLabel?: string;
}) {
  return (
    <Link
      href={`/hospedagens/${property.slug}`}
      className="flex flex-col rounded-card border border-border bg-surface overflow-hidden"
    >
      <CoverPhoto photo={property.photos[0]} className="aspect-4/3 w-full" />
      <div className="flex flex-col p-3">
        <span className="text-card-title font-semibold text-text-primary">
          {property.title}
        </span>
        <span className="text-caption text-text-secondary">
          {property.location}
        </span>
        {priceLabel && (
          <span className="mt-1 text-body font-medium text-text-primary">
            {priceLabel}
          </span>
        )}
      </div>
    </Link>
  );
}

// Card compacto — seção "Indisponíveis nesse período", opacidade reduzida,
// ainda clicável (seção 3.5).
export function UnavailablePropertyCard({
  property,
}: {
  property: PropertyCardData;
}) {
  return (
    <Link
      href={`/hospedagens/${property.slug}`}
      className="flex items-center gap-3 rounded-card p-2 opacity-55"
    >
      <CoverPhoto
        photo={property.photos[0]}
        className="h-12 w-12 shrink-0 rounded-card"
      />
      <div className="flex flex-col">
        <span className="text-body font-medium text-text-primary">
          {property.title}
        </span>
        <span className="text-caption text-text-secondary">
          Ocupado nesse período
        </span>
      </div>
    </Link>
  );
}
