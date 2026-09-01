"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Desistência do próprio pedido, disponível só enquanto ele está pendente.
// Depois de confirmada há compromisso dos dois lados, e desfazer passa a ser
// conversa com o gestor — por isso o botão some, e o servidor recusa mesmo
// que alguém chame a rota direto.
export function CancelBookingButton({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function cancelar() {
    if (enviando) return;
    setErro(null);
    setEnviando(true);

    try {
      const r = await fetch(`/api/bookings/${bookingId}/cancel`, {
        method: "PATCH",
      });
      if (!r.ok) {
        const b = await r.json();
        setErro(b.error?.message ?? "Não foi possível cancelar.");
        setEnviando(false);
        return;
      }
      setConfirmando(false);
      router.refresh();
    } catch {
      setErro("Falha de conexão. Tente novamente.");
      setEnviando(false);
    }
  }

  if (!confirmando) {
    return (
      <div className="border-t border-border px-3 py-2">
        <button
          type="button"
          onClick={() => setConfirmando(true)}
          className="text-caption text-text-secondary underline"
        >
          Desistir deste pedido
        </button>
      </div>
    );
  }

  return (
    <div className="border-t border-border px-3 py-2.5">
      <p className="text-caption text-text-secondary">
        As datas voltam a ficar disponíveis e nada será cobrado. Se o seu cartão
        foi autorizado, a retenção é liberada.
      </p>
      {erro && <p className="mt-2 text-caption text-accent-dark">{erro}</p>}
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={cancelar}
          disabled={enviando}
          className="rounded-pill bg-accent px-4 py-1.5 text-caption font-medium text-accent-text disabled:opacity-60"
        >
          {enviando ? "Cancelando…" : "Sim, desistir"}
        </button>
        <button
          type="button"
          onClick={() => setConfirmando(false)}
          disabled={enviando}
          className="rounded-pill border border-border px-4 py-1.5 text-caption text-text-primary disabled:opacity-60"
        >
          Voltar
        </button>
      </div>
    </div>
  );
}
