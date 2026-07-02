"use client";

import {
  IconPlus,
  IconStar,
  IconStarFilled,
  IconTrash,
} from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";

import { StatusBadge } from "@/components/ui/StatusBadge";
import type { Category } from "@/lib/server/categories";

const ICON_SUGGESTIONS = ["wifi", "pool", "parking"];
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

type Photo = { id: string; url: string; isCover: boolean };
type Amenity = { id: string; name: string; icon: string };
type Property = {
  id: string;
  title: string;
  description: string;
  location: string;
  category: string;
  maxGuests: number;
  bedrooms: number;
  basePrice: string;
  status: "rascunho" | "publicada" | "pausada";
  airbnbIcalUrl: string | null;
  airbnbSyncedAt: string | null;
  photos: Photo[];
  amenities: Amenity[];
};

const syncFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function PropertyEditForm({
  property: initial,
}: {
  property: Property;
}) {
  const [property, setProperty] = useState(initial);
  const [categories, setCategories] = useState<Category[]>([]);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [newAmenityName, setNewAmenityName] = useState("");
  const [newAmenityIcon, setNewAmenityIcon] = useState(ICON_SUGGESTIONS[0]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then(setCategories);
  }, []);

  const feedUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/properties/${property.id}/calendar.ics`
      : "";

  async function handleSave() {
    await fetch(`/api/properties/${property.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: property.title,
        description: property.description,
        location: property.location,
        category: property.category,
        maxGuests: property.maxGuests,
        bedrooms: property.bedrooms,
        basePrice: property.basePrice,
        status: property.status,
        airbnbIcalUrl: property.airbnbIcalUrl ?? "",
      }),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch(`/api/properties/${property.id}/photos`, {
      method: "POST",
      body: formData,
    });
    const photo = await response.json();
    setProperty((current) => ({
      ...current,
      photos: [...current.photos, photo],
    }));
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSetCover(photoId: string) {
    await fetch(`/api/photos/${photoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isCover: true }),
    });
    setProperty((current) => ({
      ...current,
      photos: current.photos.map((photo) => ({
        ...photo,
        isCover: photo.id === photoId,
      })),
    }));
  }

  async function handleDeletePhoto(photoId: string) {
    await fetch(`/api/photos/${photoId}`, { method: "DELETE" });
    setProperty((current) => ({
      ...current,
      photos: current.photos.filter((photo) => photo.id !== photoId),
    }));
  }

  async function handleAddAmenity() {
    if (!newAmenityName.trim()) return;
    const response = await fetch(`/api/properties/${property.id}/amenities`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newAmenityName, icon: newAmenityIcon }),
    });
    const amenity = await response.json();
    setProperty((current) => ({
      ...current,
      amenities: [...current.amenities, amenity],
    }));
    setNewAmenityName("");
  }

  async function handleDeleteAmenity(amenityId: string) {
    await fetch(`/api/amenities/${amenityId}`, { method: "DELETE" });
    setProperty((current) => ({
      ...current,
      amenities: current.amenities.filter((a) => a.id !== amenityId),
    }));
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-3">
        <h1 className="text-page-title font-semibold text-text-primary">
          {property.title || "Hospedagem"}
        </h1>
        <StatusBadge
          status={STATUS_LABELS[property.status]}
          label={STATUS_TEXT[property.status]}
        />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-8">
        {/* Coluna esquerda — conteúdo da vitrine */}
        <div>
          <h2 className="mb-2 text-card-title font-semibold text-text-primary">
            Fotos
          </h2>
          <div className="grid grid-cols-3 gap-2">
            {property.photos.map((photo) => (
              <div key={photo.id} className="group relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- URL do Supabase Storage */}
                <img
                  src={photo.url}
                  alt=""
                  className="h-24 w-full rounded-card object-cover"
                />
                <button
                  type="button"
                  onClick={() => handleSetCover(photo.id)}
                  aria-label="Definir como capa"
                  className="absolute left-1 top-1 rounded-full bg-surface/90 p-1"
                >
                  {photo.isCover ? (
                    <IconStarFilled size={14} className="text-amber" />
                  ) : (
                    <IconStar size={14} className="text-text-secondary" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => handleDeletePhoto(photo.id)}
                  aria-label="Remover foto"
                  className="absolute right-1 top-1 rounded-full bg-surface/90 p-1"
                >
                  <IconTrash size={14} className="text-accent-dark" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex h-24 items-center justify-center rounded-card border border-dashed border-border text-text-secondary"
            >
              <IconPlus size={20} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleUpload}
              className="hidden"
            />
          </div>

          <h2 className="mb-2 mt-6 text-card-title font-semibold text-text-primary">
            Informações básicas
          </h2>
          <label className="block text-caption text-text-secondary">
            Título
            <input
              value={property.title}
              onChange={(event) =>
                setProperty({ ...property, title: event.target.value })
              }
              className="mt-1 w-full rounded-card border border-border px-3 py-2 text-body"
            />
          </label>
          <label className="mt-3 block text-caption text-text-secondary">
            Descrição
            <textarea
              value={property.description}
              onChange={(event) =>
                setProperty({ ...property, description: event.target.value })
              }
              className="mt-1 w-full rounded-card border border-border px-3 py-2 text-body"
            />
          </label>
          <label className="mt-3 block text-caption text-text-secondary">
            Localização
            <input
              value={property.location}
              onChange={(event) =>
                setProperty({ ...property, location: event.target.value })
              }
              className="mt-1 w-full rounded-card border border-border px-3 py-2 text-body"
            />
          </label>
          <label className="mt-3 block text-caption text-text-secondary">
            Categoria
            <select
              value={property.category}
              onChange={(event) =>
                setProperty({
                  ...property,
                  category: event.target.value,
                })
              }
              className="mt-1 w-full rounded-card border border-border px-3 py-2 text-body"
            >
              {categories.map((cat) => (
                <option key={cat.slug} value={cat.slug}>
                  {cat.label}
                </option>
              ))}
            </select>
          </label>
          <div className="mt-3 flex gap-3">
            <label className="flex-1 text-caption text-text-secondary">
              Hóspedes
              <input
                type="number"
                min={1}
                value={property.maxGuests}
                onChange={(event) =>
                  setProperty({
                    ...property,
                    maxGuests: Number(event.target.value),
                  })
                }
                className="mt-1 w-full rounded-card border border-border px-3 py-2 text-body"
              />
            </label>
            <label className="flex-1 text-caption text-text-secondary">
              Quartos
              <input
                type="number"
                min={0}
                value={property.bedrooms}
                onChange={(event) =>
                  setProperty({
                    ...property,
                    bedrooms: Number(event.target.value),
                  })
                }
                className="mt-1 w-full rounded-card border border-border px-3 py-2 text-body"
              />
            </label>
            <label className="flex-1 text-caption text-text-secondary">
              Preço-base
              <input
                type="number"
                min={0}
                step="0.01"
                value={property.basePrice}
                onChange={(event) =>
                  setProperty({ ...property, basePrice: event.target.value })
                }
                className="mt-1 w-full rounded-card border border-border px-3 py-2 text-body"
              />
            </label>
          </div>
          <label className="mt-3 block text-caption text-text-secondary">
            Status
            <select
              value={property.status}
              onChange={(event) =>
                setProperty({
                  ...property,
                  status: event.target.value as Property["status"],
                })
              }
              className="mt-1 w-full rounded-card border border-border px-3 py-2 text-body"
            >
              <option value="rascunho">Rascunho</option>
              <option value="publicada">Publicada</option>
              <option value="pausada">Pausada</option>
            </select>
          </label>

          <h2 className="mb-2 mt-6 text-card-title font-semibold text-text-primary">
            Comodidades
          </h2>
          <div className="flex flex-wrap gap-2">
            {property.amenities.map((amenity) => (
              <span
                key={amenity.id}
                className="flex items-center gap-1.5 rounded-pill border border-border px-3 py-1.5 text-caption text-text-primary"
              >
                {amenity.name}
                <button
                  type="button"
                  onClick={() => handleDeleteAmenity(amenity.id)}
                  aria-label="Remover comodidade"
                >
                  <IconTrash size={12} className="text-text-secondary" />
                </button>
              </span>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <input
              placeholder="Nome (ex: Wi-Fi)"
              value={newAmenityName}
              onChange={(event) => setNewAmenityName(event.target.value)}
              className="flex-1 rounded-card border border-border px-3 py-2 text-body"
            />
            <input
              placeholder="ícone"
              list="icon-suggestions"
              value={newAmenityIcon}
              onChange={(event) => setNewAmenityIcon(event.target.value)}
              className="w-28 rounded-card border border-border px-3 py-2 text-body"
            />
            <datalist id="icon-suggestions">
              {ICON_SUGGESTIONS.map((icon) => (
                <option key={icon} value={icon} />
              ))}
            </datalist>
            <button
              type="button"
              onClick={handleAddAmenity}
              className="rounded-pill border border-border px-3 py-2 text-caption text-text-primary"
            >
              Adicionar
            </button>
          </div>
        </div>

        {/* Coluna direita — integração Airbnb */}
        <div>
          <div className="rounded-card border border-border bg-surface p-4">
            <h2 className="text-card-title font-semibold text-text-primary">
              URL do calendário do Airbnb
            </h2>
            <p className="mt-1 text-caption text-text-secondary">
              Cole aqui a URL .ics gerada pelo Airbnb — usada como camada de
              backup (Etapa 7).
            </p>
            <input
              value={property.airbnbIcalUrl ?? ""}
              onChange={(event) =>
                setProperty({ ...property, airbnbIcalUrl: event.target.value })
              }
              placeholder="https://www.airbnb.com/calendar/ical/..."
              className="mt-2 w-full rounded-card border border-border px-3 py-2 text-body"
            />
            <p className="mt-2 text-caption text-text-secondary">
              Última sincronização:{" "}
              {property.airbnbSyncedAt
                ? syncFormatter.format(new Date(property.airbnbSyncedAt))
                : "ainda não sincronizado"}
            </p>
          </div>

          <div className="mt-4 rounded-card border border-border bg-surface p-4">
            <h2 className="text-card-title font-semibold text-text-primary">
              Nosso feed para o Airbnb
            </h2>
            <p className="mt-1 text-caption text-text-secondary">
              Cadastre esta URL no Airbnb como calendário externo (geração do
              arquivo .ics chega na Etapa 7).
            </p>
            <div className="mt-2 flex items-center gap-2">
              <input
                readOnly
                value={feedUrl}
                className="flex-1 rounded-card border border-border bg-bg px-3 py-2 text-caption text-text-secondary"
              />
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(feedUrl)}
                className="rounded-pill border border-border px-3 py-2 text-caption text-text-primary"
              >
                Copiar
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSave}
            className="mt-5 w-full rounded-pill bg-accent px-5 py-2.5 text-body font-medium text-accent-text"
          >
            {saved ? "Salvo!" : "Salvar alterações"}
          </button>
        </div>
      </div>
    </div>
  );
}
