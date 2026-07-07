import Link from "next/link";

import { listConversationsForManager } from "@/lib/server/messages/service";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  timeZone: "UTC",
});

// Lista de conversas do inbox (design-ui-ux.md, seção 4.8) — toda conversa
// mostra a hospedagem+datas do booking associado, nunca solta.
// No mobile o master-detail vira duas telas: a lista ocupa a largura toda no
// inbox e some quando uma conversa está aberta (hideOnMobile).
export async function ConversationList({
  activeId,
  hideOnMobile = false,
}: {
  activeId?: string;
  hideOnMobile?: boolean;
}) {
  const conversations = await listConversationsForManager();

  return (
    <div
      className={`w-full shrink-0 overflow-y-auto border-border md:block md:w-80 md:border-r ${
        hideOnMobile ? "hidden" : ""
      }`}
    >
      {conversations.length === 0 && (
        <p className="p-4 text-body text-text-secondary">
          Nenhuma conversa ainda.
        </p>
      )}
      {conversations.map((conversation) => (
        <Link
          key={conversation.id}
          href={`/gestor/mensagens/${conversation.id}`}
          className={`block border-b border-border p-3 ${
            conversation.id === activeId
              ? "bg-bg"
              : conversation.unreadCount > 0
                ? "bg-accent-light"
                : ""
          }`}
        >
          <p className="text-body font-medium text-text-primary">
            {conversation.booking.user.name}
          </p>
          <p className="text-caption text-text-secondary">
            {conversation.booking.property.title} ·{" "}
            {dateFormatter.format(conversation.booking.checkIn)} –{" "}
            {dateFormatter.format(conversation.booking.checkOut)}
          </p>
          <p className="truncate text-caption text-text-secondary">
            {conversation.messages[0]?.content ?? "Sem mensagens ainda"}
          </p>
        </Link>
      ))}
    </div>
  );
}
