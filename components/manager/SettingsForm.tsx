"use client";

import { IconTrash } from "@tabler/icons-react";
import { useEffect, useState } from "react";

import type { Category } from "@/lib/server/categories";

// Reaproveita a mesma função usada na criação real do booking (Etapa 4) —
// não uma reimplementação só para a prévia (design-ui-ux.md, seção 4.10).
import { calculateExpiresAt } from "@/lib/server/booking/expiry";

type Settings = {
  defaultExpiryHours: number;
  quietHoursStart: string;
  quietHoursEnd: string;
  gracePeriodHours: number;
};

const exampleFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function toTimeDate(hhmm: string) {
  return new Date(`1970-01-01T${hhmm}:00Z`);
}

export function SettingsForm() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saved, setSaved] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCategoryLabel, setNewCategoryLabel] = useState("");

  useEffect(() => {
    fetch("/api/manager/settings")
      .then((response) => response.json())
      .then(setSettings);
    fetch("/api/categories")
      .then((response) => response.json())
      .then(setCategories);
  }, []);

  async function handleAddCategory(event: React.FormEvent) {
    event.preventDefault();
    if (!newCategoryLabel.trim()) return;
    const response = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: newCategoryLabel }),
    });
    if (response.ok) {
      const updated = await response.json();
      setCategories(updated);
      setNewCategoryLabel("");
    }
  }

  async function handleDeleteCategory(slug: string) {
    const response = await fetch(`/api/categories/${slug}`, {
      method: "DELETE",
    });
    if (response.ok) {
      const updated = await response.json();
      setCategories(updated);
    }
  }

  if (!settings) {
    return <p className="p-6 text-body text-text-secondary">Carregando…</p>;
  }

  const example = calculateExpiresAt(new Date(), {
    defaultExpiryHours: settings.defaultExpiryHours,
    quietHoursStart: toTimeDate(settings.quietHoursStart),
    quietHoursEnd: toTimeDate(settings.quietHoursEnd),
    gracePeriodHours: settings.gracePeriodHours,
  });

  async function handleSave() {
    await fetch("/api/manager/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="max-w-155 p-4 md:p-6">
      <h1 className="mb-5 text-page-title font-semibold text-text-primary">
        Configurações
      </h1>

      <div className="rounded-card border border-border bg-surface p-4">
        <p className="text-body font-medium text-text-primary">
          Prazo padrão de expiração
        </p>
        <p className="text-caption text-text-secondary">
          Quanto tempo uma reserva pendente fica esperando confirmação antes de
          expirar.
        </p>
        <div className="mt-2 flex items-center gap-3">
          <input
            type="range"
            min={1}
            max={48}
            value={settings.defaultExpiryHours}
            onChange={(event) =>
              setSettings({
                ...settings,
                defaultExpiryHours: Number(event.target.value),
              })
            }
            className="flex-1"
          />
          <span className="w-16 text-body text-text-primary">
            {settings.defaultExpiryHours}h
          </span>
        </div>
      </div>

      <div className="mt-4 rounded-card border border-border bg-surface p-4">
        <p className="text-body font-medium text-text-primary">
          Janela de silêncio
        </p>
        <p className="text-caption text-text-secondary">
          Horário em que o prazo não deve vencer (ex: durante a madrugada).
        </p>
        <div className="mt-2 flex items-center gap-3">
          <input
            type="time"
            value={settings.quietHoursStart}
            onChange={(event) =>
              setSettings({ ...settings, quietHoursStart: event.target.value })
            }
            className="rounded-card border border-border px-3 py-2 text-body"
          />
          <span className="text-text-secondary">até</span>
          <input
            type="time"
            value={settings.quietHoursEnd}
            onChange={(event) =>
              setSettings({ ...settings, quietHoursEnd: event.target.value })
            }
            className="rounded-card border border-border px-3 py-2 text-body"
          />
        </div>
      </div>

      <div className="mt-4 rounded-card border border-border bg-surface p-4">
        <p className="text-body font-medium text-text-primary">
          Margem após o silêncio
        </p>
        <p className="text-caption text-text-secondary">
          Tempo extra dado após o fim da janela de silêncio, pra dar tempo do
          gestor ver a notificação.
        </p>
        <div className="mt-2 flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={6}
            value={settings.gracePeriodHours}
            onChange={(event) =>
              setSettings({
                ...settings,
                gracePeriodHours: Number(event.target.value),
              })
            }
            className="flex-1"
          />
          <span className="w-16 text-body text-text-primary">
            {settings.gracePeriodHours}h
          </span>
        </div>
      </div>

      <div className="mt-4 rounded-card bg-amber-light p-4 text-body text-text-primary">
        Se um hóspede reservasse agora, o prazo de confirmação seria às{" "}
        <strong>{exampleFormatter.format(example)}</strong>.
      </div>

      <button
        type="button"
        onClick={handleSave}
        className="mt-5 rounded-pill bg-accent px-5 py-2.5 text-body font-medium text-accent-text"
      >
        {saved ? "Salvo!" : "Salvar"}
      </button>

      <div className="mt-8 rounded-card border border-border bg-surface p-4">
        <p className="text-body font-medium text-text-primary">
          Categorias de hospedagem
        </p>
        <p className="text-caption text-text-secondary">
          Chips de filtro que aparecem na vitrine pública. Adicione ou remova
          conforme o portfólio de imóveis crescer.
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          {categories.map((category) => (
            <span
              key={category.slug}
              className="flex items-center gap-1.5 rounded-pill border border-border px-3 py-1.5 text-caption text-text-primary"
            >
              {category.label}
              <button
                type="button"
                aria-label={`Remover ${category.label}`}
                onClick={() => handleDeleteCategory(category.slug)}
              >
                <IconTrash size={12} className="text-text-secondary" />
              </button>
            </span>
          ))}
        </div>

        <form onSubmit={handleAddCategory} className="mt-3 flex gap-2">
          <input
            value={newCategoryLabel}
            onChange={(event) => setNewCategoryLabel(event.target.value)}
            placeholder="Nova categoria (ex: Chalé, Loft...)"
            className="flex-1 rounded-card border border-border px-3 py-2 text-body text-text-primary outline-none focus:border-accent"
          />
          <button
            type="submit"
            className="rounded-pill bg-accent px-4 py-2 text-body font-medium text-accent-text"
          >
            Adicionar
          </button>
        </form>
      </div>
    </div>
  );
}
