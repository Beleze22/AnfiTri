import Link from "next/link";

import { StatusBadge } from "@/components/ui/StatusBadge";
import { listAllPropertiesForManager } from "@/lib/server/properties/service";

const STATUS_LABELS: Record<string, "confirmado" | "pendente" | "cancelado"> = {
  publicada: "confirmado",
  rascunho: "pendente",
  pausada: "cancelado",
};
const STATUS_TEXT: Record<string, string> = {
  publicada: "Publicada",
  rascunho: "Rascunho",
  pausada: "Pausada",
};

export default async function HospedagensPage() {
  const properties = await listAllPropertiesForManager();

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-page-title font-semibold text-text-primary">
          Hospedagens
        </h1>
        <Link
          href="/gestor/hospedagens/nova"
          className="rounded-pill bg-accent px-4 py-2 text-body font-medium text-accent-text"
        >
          Nova hospedagem
        </Link>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {properties.map((property) => (
          <Link
            key={property.id}
            href={`/gestor/hospedagens/${property.id}`}
            className="rounded-card border border-border bg-surface p-4"
          >
            {property.photos[0] ? (
              // eslint-disable-next-line @next/next/no-img-element -- URL do Supabase Storage
              <img
                src={property.photos[0].url}
                alt=""
                className="h-32 w-full rounded-card object-cover"
              />
            ) : (
              <div className="h-32 rounded-card bg-border" />
            )}
            <div className="mt-3 flex items-center justify-between">
              <p className="text-body font-medium text-text-primary">
                {property.title}
              </p>
              <StatusBadge
                status={STATUS_LABELS[property.status]}
                label={STATUS_TEXT[property.status]}
              />
            </div>
            <p className="text-caption text-text-secondary">
              R$ {property.basePrice.toFixed(2)} / noite
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
