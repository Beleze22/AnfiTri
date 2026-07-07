import { notFound } from "next/navigation";

import { ConversationList } from "@/components/manager/ConversationList";
import { ConversationThreadView } from "@/components/manager/ConversationThreadView";
import { getSession } from "@/lib/server/auth/session";
import { getConversationForSession } from "@/lib/server/messages/service";
import { prisma } from "@/lib/db/client";

export default async function GestorConversationPage({
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

  const [property, guest] = await Promise.all([
    prisma.property.findUniqueOrThrow({
      where: { id: conversation.booking.propertyId },
    }),
    prisma.user.findUniqueOrThrow({
      where: { id: conversation.booking.userId },
    }),
  ]);

  return (
    <>
      <ConversationList activeId={id} hideOnMobile />
      <ConversationThreadView
        conversationId={id}
        bookingId={conversation.booking.id}
        viewerId={session.sub}
        guestName={guest.name}
        propertyTitle={property.title}
        status={conversation.booking.status}
      />
    </>
  );
}
