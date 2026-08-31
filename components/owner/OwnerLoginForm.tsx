"use client";

import { useState } from "react";

// Acesso sem senha, pelo mesmo magic link do hóspede. O proprietário entra
// de tempos em tempos para ver relatório — não compensa a ele gerir senha,
// nem ao gestor distribuir credencial.
export function OwnerLoginForm() {
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setEnviando(true);
    await fetch("/api/auth/magic-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setEnviando(false);
    setEnviado(true);
  }

  if (enviado) {
    return (
      <p className="rounded-card border border-border bg-surface p-4 text-body text-text-primary">
        Se esse e-mail estiver cadastrado, enviamos um link de acesso. Ele vale
        por 15 minutos e só pode ser usado uma vez.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <label className="block text-caption text-text-secondary">
        E-mail
        <input
          required
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-1 w-full rounded-card border border-border bg-surface px-3 py-2 text-body text-text-primary outline-none focus:border-accent"
        />
      </label>
      <button
        type="submit"
        disabled={enviando}
        className="mt-4 w-full rounded-pill bg-accent px-4 py-2.5 text-body font-medium text-accent-text disabled:opacity-60"
      >
        {enviando ? "Enviando…" : "Receber link de acesso"}
      </button>
    </form>
  );
}
