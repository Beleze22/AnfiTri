"use client";

import { useCallback, useEffect, useState } from "react";

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const SUGGESTED_TYPES = [
  "fim_de_semana",
  "feriado",
  "alta_estacao",
  "baixa_estacao",
  "estadia_longa",
];

type Property = { id: string; title: string; basePrice: string };
type PriceRule = {
  id: string;
  name: string;
  ruleType: string;
  startDate: string;
  endDate: string;
  daysOfWeek: number[];
  multiplier: string;
};
type Holiday = { date: string; name: string };
type PreviewDay = { date: string; price: string; appliedRules: string[] };

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  timeZone: "UTC",
});

function emptyForm() {
  return {
    name: "",
    ruleType: SUGGESTED_TYPES[0],
    startDate: "",
    endDate: "",
    daysOfWeek: [] as number[],
    multiplier: "1.2",
  };
}

// Regras de preço (design-ui-ux.md, seção 4.9) — lista de regras + preview
// de calendário com o efeito combinado, nunca isoladamente.
export function PriceRulesManager() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [rules, setRules] = useState<PriceRule[]>([]);
  const [preview, setPreview] = useState<PreviewDay[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [showHolidays, setShowHolidays] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const today = new Date();
  const [previewMonth] = useState({
    year: today.getUTCFullYear(),
    month: today.getUTCMonth() + 1,
  });

  useEffect(() => {
    fetch("/api/manager/properties")
      .then((response) => response.json())
      .then((data: Property[]) => {
        setProperties(data);
        if (data.length > 0) setPropertyId(data[0].id);
      });
  }, []);

  const reloadRulesAndPreview = useCallback(
    (id: string) => {
      fetch(`/api/properties/${id}/price-rules`)
        .then((response) => response.json())
        .then(setRules);
      fetch(
        `/api/properties/${id}/price-preview?year=${previewMonth.year}&month=${previewMonth.month}`,
      )
        .then((response) => response.json())
        .then(setPreview);
    },
    [previewMonth],
  );

  useEffect(() => {
    if (propertyId) reloadRulesAndPreview(propertyId);
  }, [propertyId, reloadRulesAndPreview]);

  function loadHolidays() {
    setShowHolidays((current) => !current);
    if (holidays.length === 0) {
      fetch(`/api/holidays?year=${previewMonth.year}`)
        .then((response) => response.json())
        .then(setHolidays);
    }
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!propertyId) return;
    await fetch(`/api/properties/${propertyId}/price-rules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setForm(emptyForm());
    setShowForm(false);
    reloadRulesAndPreview(propertyId);
  }

  async function handleDelete(ruleId: string) {
    await fetch(`/api/price-rules/${ruleId}`, { method: "DELETE" });
    if (propertyId) reloadRulesAndPreview(propertyId);
  }

  function toggleWeekday(day: number) {
    setForm((current) => ({
      ...current,
      daysOfWeek: current.daysOfWeek.includes(day)
        ? current.daysOfWeek.filter((d) => d !== day)
        : [...current.daysOfWeek, day],
    }));
  }

  return (
    <div className="p-6">
      <h1 className="mb-4 text-page-title font-semibold text-text-primary">
        Regras de preço
      </h1>

      <select
        value={propertyId ?? ""}
        onChange={(event) => setPropertyId(event.target.value)}
        className="rounded-card border border-border bg-surface px-3 py-2 text-body text-text-primary"
      >
        {properties.map((property) => (
          <option key={property.id} value={property.id}>
            {property.title}
          </option>
        ))}
      </select>

      <div className="mt-5 grid grid-cols-2 gap-6">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-card-title font-semibold text-text-primary">
              Regras ativas
            </h2>
            <button
              type="button"
              onClick={() => setShowForm((v) => !v)}
              className="rounded-pill bg-accent px-3 py-1.5 text-caption font-medium text-accent-text"
            >
              Nova regra
            </button>
          </div>

          {showForm && (
            <form
              onSubmit={handleCreate}
              className="mb-4 rounded-card border border-border bg-surface p-3"
            >
              <input
                required
                placeholder="Nome (ex: Carnaval 2026)"
                value={form.name}
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
                className="w-full rounded-card border border-border px-3 py-2 text-body"
              />
              <input
                placeholder="Categoria (ex: fim_de_semana, feriado...)"
                list="rule-type-suggestions"
                value={form.ruleType}
                onChange={(event) =>
                  setForm({ ...form, ruleType: event.target.value })
                }
                className="mt-2 w-full rounded-card border border-border px-3 py-2 text-body"
              />
              <datalist id="rule-type-suggestions">
                {SUGGESTED_TYPES.map((type) => (
                  <option key={type} value={type} />
                ))}
              </datalist>

              <div className="mt-2 flex gap-2">
                <input
                  required
                  type="date"
                  value={form.startDate}
                  onChange={(event) =>
                    setForm({ ...form, startDate: event.target.value })
                  }
                  className="flex-1 rounded-card border border-border px-3 py-2 text-body"
                />
                <input
                  required
                  type="date"
                  value={form.endDate}
                  onChange={(event) =>
                    setForm({ ...form, endDate: event.target.value })
                  }
                  className="flex-1 rounded-card border border-border px-3 py-2 text-body"
                />
              </div>

              <p className="mt-2 text-caption text-text-secondary">
                Dias da semana (opcional — vazio cobre todos os dias do
                intervalo)
              </p>
              <div className="mt-1 flex gap-1">
                {WEEKDAY_LABELS.map((label, day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleWeekday(day)}
                    className={`rounded-pill px-2 py-1 text-caption ${
                      form.daysOfWeek.includes(day)
                        ? "bg-accent text-accent-text"
                        : "border border-border text-text-secondary"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <label className="mt-2 block text-caption text-text-secondary">
                Multiplicador (ex: 1.2 = +20%, 0.8 = -20%)
                <input
                  required
                  type="number"
                  step="0.01"
                  value={form.multiplier}
                  onChange={(event) =>
                    setForm({ ...form, multiplier: event.target.value })
                  }
                  className="mt-1 w-full rounded-card border border-border px-3 py-2 text-body"
                />
              </label>

              <button
                type="button"
                onClick={loadHolidays}
                className="mt-2 text-caption text-accent underline"
              >
                {showHolidays ? "Esconder" : "Ver"} feriados de{" "}
                {previewMonth.year}
              </button>
              {showHolidays && (
                <ul className="mt-1 max-h-32 overflow-y-auto rounded-card border border-border p-2 text-caption text-text-secondary">
                  {holidays.map((holiday) => (
                    <li key={holiday.date}>
                      <button
                        type="button"
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            name: holiday.name,
                            ruleType: "feriado",
                            startDate: holiday.date,
                            endDate: holiday.date,
                          }))
                        }
                        className="hover:text-accent"
                      >
                        {holiday.date} — {holiday.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <button
                type="submit"
                className="mt-3 w-full rounded-pill bg-accent px-4 py-2 text-body font-medium text-accent-text"
              >
                Salvar regra
              </button>
            </form>
          )}

          <div className="flex flex-col gap-2">
            {rules.map((rule) => {
              const value = Number(rule.multiplier);
              return (
                <div
                  key={rule.id}
                  className="flex items-center justify-between rounded-card border border-border bg-surface p-3"
                >
                  <div>
                    <p className="text-body font-medium text-text-primary">
                      {rule.name}
                    </p>
                    <p className="text-caption text-text-secondary">
                      {rule.daysOfWeek.length > 0 &&
                        `${rule.daysOfWeek.map((d) => WEEKDAY_LABELS[d]).join(", ")} · `}
                      {dateFormatter.format(new Date(rule.startDate))} –{" "}
                      {dateFormatter.format(new Date(rule.endDate))}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-body font-medium ${
                        value > 1
                          ? "text-green"
                          : value < 1
                            ? "text-accent-dark"
                            : "text-text-secondary"
                      }`}
                    >
                      ×{rule.multiplier}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDelete(rule.id)}
                      className="text-caption text-text-secondary underline"
                    >
                      remover
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-card-title font-semibold text-text-primary">
            Pré-visualização — {previewMonth.month}/{previewMonth.year}
          </h2>
          <div className="grid grid-cols-7 gap-1">
            {preview.map((day) => {
              const affected = day.appliedRules.length > 0;
              return (
                <div
                  key={day.date}
                  className={`rounded-card border p-1.5 text-center text-caption ${
                    affected
                      ? "border-accent bg-accent-light text-accent-dark"
                      : "border-border bg-surface text-text-primary"
                  }`}
                >
                  <p>{Number(day.date.slice(8, 10))}</p>
                  <p className="font-medium">
                    R$ {Number(day.price).toFixed(0)}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
