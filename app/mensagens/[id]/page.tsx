import { IconArrowLeft } from "@tabler/icons-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { MessageThread } from "@/components/public/MessageThread";
import { getSession } from "@/lib/server/auth/session";
import { getConversationForSession } from "@/lib/server/messages/service";
import { prisma } from "@/lib/db/client";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) {
    notFound();
  }

  const conversation = await getConversationForSession(id, session);
  if (!conversation) {
    notFound();
  }

  const property = await prisma.property.findUniqueOrThrow({
    where: { id: conversation.booking.propertyId },
  });

  return (
    <main className="flex h-screen flex-col bg-bg">
      <header className="flex shrink-0 items-center gap-3 border-b border-border bg-surface px-4 py-3">
        <Link href="/mensagens" className="text-text-secondary">
          <IconArrowLeft size={20} />
        </Link>
        <span className="text-card-title font-semibold text-text-primary">
          {property.title}
        </span>
      </header>
      <div className="flex-1 overflow-hidden">
        <MessageThread conversationId={id} viewerId={session.sub} />
      </div>
    </main>
  );
}
