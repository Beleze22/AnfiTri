"use client";

import { IconX } from "@tabler/icons-react";
import { useState } from "react";

type PropertyOption = { id: string; title: string };

// Lançamento de reserva pelo gestor — o caso de quem fecha por telefone ou
// WhatsApp. Nem a arquitetura nem o doc de design especificaram esta tela
// (a §8.2 lista só "confirmar/cancelar"), mas o serviço createManualBooking
// já existia sem nada que o chamasse. Vive no Calendário porque é ali que o
// gestor enxerga a disponibilidade antes de lançar.
export function ManualBookingForm({
  properties,
  onClose,
  onCreated,
}: {
  properties: PropertyOption[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [propertyId, setPropertyId] = useState(properties[0]?.id ?? "");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [status, setStatus] = useState<"confirmado" | "pendente">("confirmado");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErro(null);

    if (checkIn >= checkOut) {
      setErro("A saída precisa ser depois da entrada.");
      return;
    }

    setEnviando(true);
    const response = await fetch(
      `/api/properties/${propertyId}/bookings/manual`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          phone: phone || undefined,
          checkIn,
          checkOut,
          status,
        }),
      },
    );

    if (!response.ok) {
      const body = await response.json();
      // 409 é o caso esperado: as datas já têm reserva pendente ou
      // confirmada. A checagem real acontece na transação serializable do
      // serviço, não aqui.
      setErro(body.error?.message ?? "Não foi possível lançar a reserva.");
      setEnviando(false);
      return;
    }

    onCreated();
    onClose();
  }

  const campo =
    "mt-1 w-full rounded-card border border-border bg-surface px-3 py-2 text-body text-text-primary outline-none focus:border-accent";
  const rotulo = "block text-caption text-text-secondary";

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 z-30 bg-[rgba(39,39,39,0.25)]"
      />
      <div className="fixed left-1/2 top-1/2 z-40 max-h-[90vh] w-full max-w-100 -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-card bg-surface p-5 shadow-lg">
        <div className="flex items-start justify-between">
          <h2 className="text-card-title font-semibold text-text-primary">
            Nova reserva
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="text-text-secondary"
          >
            <IconX size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4">
          <label className={rotulo}>
            Hospedagem
            <select
              value={propertyId}
              onChange={(event) => setPropertyId(event.target.value)}
              className={campo}
            >
              {properties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.title}
                </option>
              ))}
            </select>
          </label>

          <div className="mt-3 flex gap-3">
            <label className={`${rotulo} flex-1`}>
              Entrada
              <input
                type="date"
                required
                value={checkIn}
                onChange={(event) => setCheckIn(event.target.value)}
                className={campo}
              />
            </label>
            <label className={`${rotulo} flex-1`}>
              Saída
              <input
                type="date"
                required
                value={checkOut}
                onChange={(event) => setCheckOut(event.target.value)}
                className={campo}
              />
            </label>
          </div>

          <label className={`${rotulo} mt-3`}>
            Nome do hóspede
            <input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={campo}
            />
          </label>

          <label className={`${rotulo} mt-3`}>
            E-mail
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={campo}
            />
          </label>

          <label className={`${rotulo} mt-3`}>
            WhatsApp (opcional)
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className={campo}
            />
          </label>

          <fieldset className="mt-4">
            <legend className={rotulo}>Situação</legend>
            <div className="mt-1 flex gap-2">
              {(["confirmado", "pendente"] as const).map((opcao) => (
                <button
                  key={opcao}
                  type="button"
                  onClick={() => setStatus(opcao)}
                  className={`flex-1 rounded-pill px-4 py-2 text-body ${
                    status === opcao
                      ? "bg-accent text-accent-text"
                      : "border border-border text-text-primary"
                  }`}
                >
                  {opcao === "confirmado" ? "Confirmada" : "Pendente"}
                </button>
              ))}
            </div>
            <p className="mt-2 text-caption text-text-secondary">
              {status === "confirmado"
                ? "Bloqueia a data aqui e entra no calendário enviado ao Airbnb."
                : "Bloqueia a data apenas nesta plataforma, sem prazo de expiração."}
            </p>
          </fieldset>

          {erro && (
            <p className="mt-4 rounded-card bg-accent-light p-3 text-caption text-accent-dark">
              {erro}
            </p>
          )}

          <button
            type="submit"
            disabled={enviando || !propertyId}
            className="mt-5 w-full rounded-pill bg-accent px-4 py-2.5 text-body font-medium text-accent-text disabled:opacity-60"
          >
            {enviando ? "Lançando…" : "Lançar reserva"}
          </button>
        </form>
      </div>
    </>
  );
}
