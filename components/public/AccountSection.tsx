"use client";

import { useState } from "react";

export function AccountSection({
  name: initialName,
  phone: initialPhone,
}: {
  name: string;
  phone: string | null;
}) {
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    await fetch("/api/users/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone: phone || undefined }),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <p className="mb-3 text-card-title font-semibold text-text-primary">
        Conta
      </p>

      <label className="block text-caption text-text-secondary">
        Nome
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="mt-1 w-full rounded-card border border-border bg-surface px-3 py-2 text-body text-text-primary outline-none focus:border-accent"
        />
      </label>

      <label className="mt-3 block text-caption text-text-secondary">
        WhatsApp
        <input
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          className="mt-1 w-full rounded-card border border-border bg-surface px-3 py-2 text-body text-text-primary outline-none focus:border-accent"
        />
      </label>

      <button
        type="button"
        onClick={handleSave}
        className="mt-3 rounded-pill border border-border px-4 py-2 text-body text-text-primary"
      >
        {saved ? "Salvo!" : "Salvar"}
      </button>

      <form action="/api/auth/logout" method="post" className="mt-3">
        <button
          type="submit"
          className="text-body text-text-secondary underline"
        >
          Sair
        </button>
      </form>
    </div>
  );
}
