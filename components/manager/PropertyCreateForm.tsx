"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import type { Category } from "@/lib/server/categories";

const ACCENTED_CHARS: Record<string, string> = {
  á: "a",
  à: "a",
  â: "a",
  ã: "a",
  ä: "a",
  é: "e",
  è: "e",
  ê: "e",
  í: "i",
  ì: "i",
  ó: "o",
  ò: "o",
  ô: "o",
  õ: "o",
  ú: "u",
  ù: "u",
  ü: "u",
  ç: "c",
  ñ: "n",
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .split("")
    .map((char) => ACCENTED_CHARS[char] ?? char)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function PropertyCreateForm() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("São Paulo, SP");
  const [category, setCategory] = useState("urbano");

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((data: Category[]) => {
        setCategories(data);
        if (data.length > 0) setCategory(data[0].slug);
      });
  }, []);
  const [maxGuests, setMaxGuests] = useState(2);
  const [bedrooms, setBedrooms] = useState(1);
  const [basePrice, setBasePrice] = useState(200);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const response = await fetch("/api/properties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        slug,
        description,
        location,
        category,
        maxGuests,
        bedrooms,
        basePrice,
      }),
    });
    if (!response.ok) {
      const body = await response.json();
      setError(body.error?.message ?? "Não foi possível criar.");
      return;
    }
    const property = await response.json();
    router.push(`/gestor/hospedagens/${property.id}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-[480px] rounded-card border border-border bg-surface p-5"
    >
      <label className="block text-caption text-text-secondary">
        Título
        <input
          required
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            if (!slugTouched) setSlug(slugify(event.target.value));
          }}
          className="mt-1 w-full rounded-card border border-border px-3 py-2 text-body"
        />
      </label>

      <label className="mt-3 block text-caption text-text-secondary">
        Slug (URL)
        <input
          required
          value={slug}
          onChange={(event) => {
            setSlug(event.target.value);
            setSlugTouched(true);
          }}
          className="mt-1 w-full rounded-card border border-border px-3 py-2 text-body"
        />
      </label>

      <label className="mt-3 block text-caption text-text-secondary">
        Descrição
        <textarea
          required
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className="mt-1 w-full rounded-card border border-border px-3 py-2 text-body"
        />
      </label>

      <label className="mt-3 block text-caption text-text-secondary">
        Localização
        <input
          required
          value={location}
          onChange={(event) => setLocation(event.target.value)}
          className="mt-1 w-full rounded-card border border-border px-3 py-2 text-body"
        />
      </label>

      <label className="mt-3 block text-caption text-text-secondary">
        Categoria
        <select
          value={category}
          onChange={(event) =>
            setCategory(event.target.value as typeof category)
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
            required
            type="number"
            min={1}
            value={maxGuests}
            onChange={(event) => setMaxGuests(Number(event.target.value))}
            className="mt-1 w-full rounded-card border border-border px-3 py-2 text-body"
          />
        </label>
        <label className="flex-1 text-caption text-text-secondary">
          Quartos
          <input
            required
            type="number"
            min={0}
            value={bedrooms}
            onChange={(event) => setBedrooms(Number(event.target.value))}
            className="mt-1 w-full rounded-card border border-border px-3 py-2 text-body"
          />
        </label>
        <label className="flex-1 text-caption text-text-secondary">
          Preço-base
          <input
            required
            type="number"
            min={0}
            step="0.01"
            value={basePrice}
            onChange={(event) => setBasePrice(Number(event.target.value))}
            className="mt-1 w-full rounded-card border border-border px-3 py-2 text-body"
          />
        </label>
      </div>

      {error && <p className="mt-3 text-caption text-accent-dark">{error}</p>}

      <button
        type="submit"
        className="mt-4 rounded-pill bg-accent px-5 py-2.5 text-body font-medium text-accent-text"
      >
        Criar hospedagem
      </button>
    </form>
  );
}
