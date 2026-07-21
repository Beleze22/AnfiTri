"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Linguagem deliberadamente provisória (changelog de design, item 5) —
// "Solicitar reserva", nunca "Confirmar"/"Reservar" sozinho.
export function BookingRequestForm({
  propertyId,
  checkIn,
  checkOut,
}: {
  propertyId: string;
  checkIn: string;
  checkOut: string;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const response = await fetch(`/api/properties/${propertyId}/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        checkIn,
        checkOut,
        email,
        phone: phone || undefined,
      }),
    });

    if (!response.ok) {
      const body = await response.json();
      setError(body.error?.message ?? "Não foi possível solicitar a reserva.");
      setLoading(false);
      return;
    }

    const booking = await response.json();
    if (booking.checkoutUrl) {
      // Pagamento ativo: autoriza o cartão agora; a cobrança só acontece
      // quando o gestor aprovar. O Stripe redireciona de volta ao sucesso.
      window.location.assign(booking.checkoutUrl);
      return;
    }
    router.push(`/reservas/sucesso?bookingId=${booking.id}`);
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4">
      <label className="block text-caption text-text-secondary">
        Nome completo
        <input
          name="name"
          autoComplete="name"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="mt-1 w-full rounded-card border border-border bg-surface px-3 py-2 text-body text-text-primary outline-none focus:border-accent"
        />
      </label>

      <label className="mt-3 block text-caption text-text-secondary">
        E-mail
        <input
          name="email"
          autoComplete="email"
          required
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-1 w-full rounded-card border border-border bg-surface px-3 py-2 text-body text-text-primary outline-none focus:border-accent"
        />
      </label>

      <label className="mt-3 block text-caption text-text-secondary">
        WhatsApp (opcional)
        <input
          name="phone"
          autoComplete="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          className="mt-1 w-full rounded-card border border-border bg-surface px-3 py-2 text-body text-text-primary outline-none focus:border-accent"
        />
      </label>

      {error && <p className="mt-3 text-caption text-accent-dark">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="mt-4 w-full rounded-pill bg-accent px-4 py-3 text-body font-medium text-accent-text disabled:opacity-60"
      >
        {loading ? "Enviando…" : "Solicitar reserva"}
      </button>
      <p className="mt-2 text-center text-caption text-text-secondary">
        Sem pagamento agora — só confirmamos o interesse.
      </p>
    </form>
  );
}
