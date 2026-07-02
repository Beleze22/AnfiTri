"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginGestorPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const body = await response.json();
      setError(body.error?.message ?? "Não foi possível entrar.");
      setLoading(false);
      return;
    }

    router.push("/gestor");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-card border border-border bg-surface p-6"
      >
        <h1 className="text-page-title font-semibold text-text-primary">
          Entrar
        </h1>
        <p className="mt-1 text-body text-text-secondary">
          Área restrita ao gestor.
        </p>

        <label className="mt-6 block text-caption text-text-secondary">
          E-mail
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1 w-full rounded-card border border-border bg-surface px-3 py-2 text-body text-text-primary outline-none focus:border-accent"
          />
        </label>

        <label className="mt-4 block text-caption text-text-secondary">
          Senha
          <input
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1 w-full rounded-card border border-border bg-surface px-3 py-2 text-body text-text-primary outline-none focus:border-accent"
          />
        </label>

        {error && <p className="mt-4 text-caption text-accent-dark">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded-pill bg-accent px-4 py-2 text-body font-medium text-accent-text disabled:opacity-60"
        >
          {loading ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}
