"use client";

import { useState } from "react";

// Mecanismo de acesso sem senha (magic link por e-mail, decidido na Etapa 3).
export function GuestLoginForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    await fetch("/api/auth/magic-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setLoading(false);
    setSent(true);
  }

  if (sent) {
    return (
      <p className="rounded-card border border-border bg-surface p-4 text-body text-text-primary">
        Se esse e-mail tiver reservas, enviamos um link de acesso. Confira sua
        caixa de entrada.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <p className="mb-3 text-body text-text-secondary">
        Digite o e-mail usado na reserva para acessar seu perfil.
      </p>
      <input
        required
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        className="w-full rounded-card border border-border bg-surface px-3 py-2 text-body text-text-primary outline-none focus:border-accent"
      />
      <button
        type="submit"
        disabled={loading}
        className="mt-3 w-full rounded-pill bg-accent px-4 py-2.5 text-body font-medium text-accent-text disabled:opacity-60"
      >
        {loading ? "Enviando…" : "Receber link de acesso"}
      </button>
    </form>
  );
}
