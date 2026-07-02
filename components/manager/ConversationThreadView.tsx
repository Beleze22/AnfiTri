"use client";

import { useState } from "react";

import { BookingDetailPanel } from "@/components/manager/BookingDetailPanel";
import { MessageThread } from "@/components/public/MessageThread";
import {
  StatusBadge,
  type BookingStatusLabel,
} from "@/components/ui/StatusBadge";

export function ConversationThreadView({
  conversationId,
  bookingId,
  viewerId,
  guestName,
  propertyTitle,
  status,
}: {
  conversationId: string;
  bookingId: string;
  viewerId: string;
  guestName: string;
  propertyTitle: string;
  status: BookingStatusLabel;
}) {
  const [panelOpen, setPanelOpen] = useState(false);

  return (
    <div className="flex h-screen flex-1 flex-col">
      <header className="flex shrink-0 items-center justify-between border-b border-border bg-surface px-4 py-3">
        <div>
          <p className="text-body font-semibold text-text-primary">
            {guestName}
          </p>
          <div className="flex items-center gap-2 text-caption text-text-secondary">
            {propertyTitle} <StatusBadge status={status} />
          </div>
        </div>
        <button
          type="button"
          onClick={() => setPanelOpen(true)}
          className="rounded-pill border border-border px-3 py-1.5 text-caption text-text-primary"
        >
          Ver reserva
        </button>
      </header>

      <div className="flex-1 overflow-hidden">
        <MessageThread conversationId={conversationId} viewerId={viewerId} />
      </div>

      <BookingDetailPanel
        bookingId={panelOpen ? bookingId : null}
        onClose={() => setPanelOpen(false)}
      />
    </div>
  );
}
