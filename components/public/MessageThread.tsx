"use client";

import { useEffect, useState } from "react";

type Message = {
  id: string;
  senderId: string;
  content: string;
  createdAt: string;
};

// Bolhas de mensagem (design-ui-ux.md, seção 4.8): a mensagem do próprio
// usuário fica à direita (fundo accent, texto branco); a do outro lado, à
// esquerda (fundo bg). O doc descreve isso da perspectiva do gestor — aqui
// generalizamos por "é minha mensagem?" para funcionar também na visão do
// hóspede sobre a mesma conversa.
export function MessageThread({
  conversationId,
  viewerId,
}: {
  conversationId: string;
  viewerId: string;
}) {
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);

  function load() {
    fetch(`/api/conversations/${conversationId}/messages`)
      .then((response) => response.json())
      .then(setMessages);
  }

  // Polling enquanto a conversa está aberta — mensagens do outro lado
  // aparecem sem recarregar. Escala atual (um gestor + poucos hóspedes)
  // não justifica WebSocket/Realtime; ver discussão na Etapa de melhorias.
  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    window.addEventListener("focus", load);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", load);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load só depende de conversationId
  }, [conversationId]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!content.trim()) return;
    setSending(true);
    await fetch(`/api/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    setContent("");
    setSending(false);
    load();
  }

  return (
    <div className="flex h-full flex-col">
      {/* Fundo neutro explícito: o balão recebido é bg-surface e precisa de
          contraste com a área da conversa em qualquer tela (gestor/hóspede). */}
      <div className="flex-1 space-y-2 overflow-y-auto bg-bg px-4 py-3">
        {messages?.map((message) => {
          const isOwn = message.senderId === viewerId;
          return (
            <div
              key={message.id}
              className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
            >
              <span
                className={`max-w-[75%] rounded-card px-3 py-2 text-body ${
                  isOwn
                    ? "bg-accent text-accent-text"
                    : "border border-border bg-surface text-text-primary"
                }`}
              >
                {message.content}
              </span>
            </div>
          );
        })}
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 border-t border-border bg-surface px-3 py-2"
      >
        <input
          name="content"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Escreva uma mensagem"
          className="flex-1 rounded-pill border border-border bg-surface px-3 py-2 text-body text-text-primary outline-none focus:border-accent"
        />
        <button
          type="submit"
          aria-label="Enviar mensagem"
          disabled={sending}
          className="rounded-full bg-accent p-2.5 text-accent-text disabled:opacity-60"
        >
          ➤
        </button>
      </form>
    </div>
  );
}
