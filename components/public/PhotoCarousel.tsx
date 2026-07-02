"use client";

import { IconArrowLeft } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

// Carrossel em tela cheia (design-ui-ux.md, seção 4.2) — aspect-ratio 4:3,
// botão de voltar sobreposto, contador de fotos.
export function PhotoCarousel({ photos }: { photos: { url: string }[] }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const total = Math.max(photos.length, 1);
  const photo = photos[index];

  return (
    <div className="relative aspect-[4/3] w-full bg-border">
      {photo && (
        // eslint-disable-next-line @next/next/no-img-element -- URL de storage externo, ainda a decidir (pendência de storage)
        <img
          src={photo.url}
          alt=""
          className="h-full w-full object-cover"
          onClick={() => setIndex((current) => (current + 1) % total)}
        />
      )}

      <button
        type="button"
        aria-label="Voltar"
        onClick={() => router.back()}
        className="absolute left-3 top-3 rounded-full bg-surface/90 p-2 text-text-primary"
      >
        <IconArrowLeft size={18} />
      </button>

      <span className="absolute bottom-3 right-3 rounded-pill bg-surface/90 px-2.5 py-1 text-caption text-text-primary">
        {index + 1}/{total}
      </span>
    </div>
  );
}
