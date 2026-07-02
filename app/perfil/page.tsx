import { IconUserCircle } from "@tabler/icons-react";

import { AccountSection } from "@/components/public/AccountSection";
import { BottomNav } from "@/components/ui/BottomNav";
import { GuestLoginForm } from "@/components/public/GuestLoginForm";
import { MyBookingCard } from "@/components/public/MyBookingCard";
import { getSession } from "@/lib/server/auth/session";
import { listBookingsForUser } from "@/lib/server/booking/service";
import { prisma } from "@/lib/db/client";

export default async function PerfilPage() {
  const session = await getSession();

  if (!session || session.role !== "hospede") {
    return (
      <main className="flex min-h-screen flex-col bg-bg px-4 py-10">
        <h1 className="mb-4 text-page-title font-semibold text-text-primary">
          Entrar
        </h1>
        <GuestLoginForm />
        <BottomNav />
      </main>
    );
  }

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.sub },
  });
  const bookings = await listBookingsForUser(session.sub);
  const initials = user.name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <main className="min-h-screen bg-bg px-4 py-6 pb-24">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-light text-body font-semibold text-accent-dark">
          {initials || <IconUserCircle size={24} />}
        </span>
        <div>
          <p className="text-card-title font-semibold text-text-primary">
            {user.name}
          </p>
          <p className="text-caption text-text-secondary">{user.email}</p>
        </div>
      </div>

      <p className="mt-6 mb-2 text-card-title font-semibold text-text-primary">
        Minhas reservas
      </p>
      <div className="flex flex-col gap-3">
        {bookings.length === 0 && (
          <p className="text-body text-text-secondary">
            Você ainda não tem reservas.
          </p>
        )}
        {bookings.map((booking) => (
          <MyBookingCard
            key={booking.id}
            booking={{
              ...booking,
              conversationId: booking.conversation?.id ?? null,
            }}
          />
        ))}
      </div>

      <div className="mt-6">
        <AccountSection name={user.name} phone={user.phone} />
      </div>

      <BottomNav />
    </main>
  );
}
