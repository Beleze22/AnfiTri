import { prisma } from "@/lib/db/client";
import type { Role } from "@/lib/server/auth/jwt";

export async function getConversationForSession(
  conversationId: string,
  session: { sub: string; role: Role },
) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { booking: true },
  });

  if (!conversation) return null;
  if (
    session.role === "hospede" &&
    conversation.booking.userId !== session.sub
  ) {
    return null;
  }
  return conversation;
}

export async function listMessages(conversationId: string, readerId: string) {
  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
  });

  // Abrir a conversa marca como lidas as mensagens que o outro lado enviou —
  // o badge de "não lida" do inbox (design doc 4.8) é por mensagem.
  await prisma.message.updateMany({
    where: { conversationId, senderId: { not: readerId }, read: false },
    data: { read: true },
  });

  return messages;
}

export function sendMessage(
  conversationId: string,
  senderId: string,
  content: string,
) {
  return prisma.message.create({
    data: { conversationId, senderId, content },
  });
}

// Inbox do gestor (design-ui-ux.md, seção 4.8) — toda conversa pertence a um
// booking, nunca solta; lista ordenada pela mensagem mais recente.
export async function listConversationsForManager() {
  const conversations = await prisma.conversation.findMany({
    include: {
      booking: { include: { property: true, user: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  const unreadCounts = await prisma.message.groupBy({
    by: ["conversationId"],
    where: { read: false, sender: { role: "hospede" } },
    _count: { _all: true },
  });
  const unreadByConversation = new Map(
    unreadCounts.map((row) => [row.conversationId, row._count._all]),
  );

  return conversations
    .map((conversation) => ({
      ...conversation,
      unreadCount: unreadByConversation.get(conversation.id) ?? 0,
    }))
    .sort((a, b) => {
      const aTime = a.messages[0]?.createdAt ?? a.booking.createdAt;
      const bTime = b.messages[0]?.createdAt ?? b.booking.createdAt;
      return bTime.getTime() - aTime.getTime();
    });
}
