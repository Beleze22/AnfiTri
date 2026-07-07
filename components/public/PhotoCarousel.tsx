"use client";

import {
  IconArrowLeft,
  IconChevronLeft,
  IconChevronRight,
} from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

const SWIPE_THRESHOLD_PX = 48;

// Carrossel em tela cheia (design-ui-ux.md, seção 4.2) — aspect-ratio 4:3,
// botão de voltar sobreposto, contador de fotos. Navegação por arrasto
// (touch), setas laterais e bolinhas indicadoras; a faixa desliza com a
// posição do dedo para dar a sensação de arrasto real.
export function PhotoCarousel({ photos }: { photos: { url: string }[] }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [dragX, setDragX] = useState(0);
  const touchStartX = useRef<number | null>(null);
  // O navegador dispara um click sintético depois do touchend — sem esta
  // guarda, todo swipe avançaria uma foto a mais.
  const didSwipe = useRef(false);
  const total = photos.length;
  const hasMultiple = total > 1;

  function goTo(next: number) {
    setIndex(Math.min(Math.max(next, 0), total - 1));
  }

  function handleTouchStart(event: React.TouchEvent) {
    touchStartX.current = event.touches[0].clientX;
  }

  function handleTouchMove(event: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const delta = event.touches[0].clientX - touchStartX.current;
    // Resistência nas bordas: na primeira/última foto o arrasto rende menos,
    // sinalizando que não há mais nada para aquele lado.
    const atEdge =
      (index === 0 && delta > 0) || (index === total - 1 && delta < 0);
    setDragX(atEdge ? delta / 3 : delta);
  }

  function handleTouchEnd() {
    if (Math.abs(dragX) > SWIPE_THRESHOLD_PX) {
      didSwipe.current = true;
      goTo(dragX < 0 ? index + 1 : index - 1);
    }
    touchStartX.current = null;
    setDragX(0);
  }

  function handleClick() {
    if (didSwipe.current) {
      didSwipe.current = false;
      return;
    }
    if (hasMultiple) goTo((index + 1) % total);
  }

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden bg-border">
      {total > 0 && (
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={handleClick}
          className={`flex h-full ${dragX === 0 ? "transition-transform duration-300" : ""}`}
          style={{
            transform: `translateX(calc(${-index * 100}% + ${dragX}px))`,
          }}
        >
          {photos.map((photo) => (
            // eslint-disable-next-line @next/next/no-img-element -- URL do Supabase Storage
            <img
              key={photo.url}
              src={photo.url}
              alt=""
              draggable={false}
              className="h-full w-full shrink-0 object-cover"
            />
          ))}
        </div>
      )}

      <button
        type="button"
        aria-label="Voltar"
        onClick={() => router.back()}
        className="absolute left-3 top-3 rounded-full bg-surface/90 p-2 text-text-primary"
      >
        <IconArrowLeft size={18} />
      </button>

      {hasMultiple && index > 0 && (
        <button
          type="button"
          aria-label="Foto anterior"
          onClick={() => goTo(index - 1)}
          className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-surface/90 p-1.5 text-text-primary"
        >
          <IconChevronLeft size={18} />
        </button>
      )}
      {hasMultiple && index < total - 1 && (
        <button
          type="button"
          aria-label="Próxima foto"
          onClick={() => goTo(index + 1)}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-surface/90 p-1.5 text-text-primary"
        >
          <IconChevronRight size={18} />
        </button>
      )}

      {hasMultiple && (
        <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
          {photos.map((photo, i) => (
            <span
              key={photo.url}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? "w-4 bg-surface" : "w-1.5 bg-surface/60"
              }`}
            />
          ))}
        </div>
      )}

      <span className="absolute bottom-3 right-3 rounded-pill bg-surface/90 px-2.5 py-1 text-caption text-text-primary">
        {index + 1}/{Math.max(total, 1)}
      </span>
    </div>
  );
}
