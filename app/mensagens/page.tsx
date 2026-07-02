import { BottomNav } from "@/components/ui/BottomNav";
import { GuestLoginForm } from "@/components/public/GuestLoginForm";
import { MyBookingCard } from "@/components/public/MyBookingCard";
import { getSession } from "@/lib/server/auth/session";
import { listBookingsForUser } from "@/lib/server/booking/service";

// Gap dos documentos: o bottom nav (seção 3.6) prevê uma aba "Mensagens",
// mas nenhuma tela do doc de design especifica o que ela mostra — a
// arquitetura só diz que toda conversa pertence a um booking, nunca solta
// (seção 7). Interpretação adotada: lista das reservas com conversa
// associada, cada uma levando à thread específica.
export default async function MensagensPage() {
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

  const bookings = await listBookingsForUser(session.sub);
  const withConversation = bookings.filter((booking) => booking.conversation);

  return (
    <main className="min-h-screen bg-bg px-4 py-6 pb-24">
      <h1 className="mb-4 text-page-title font-semibold text-text-primary">
        Mensagens
      </h1>
      <div className="flex flex-col gap-3">
        {withConversation.length === 0 && (
          <p className="text-body text-text-secondary">
            Nenhuma conversa por aqui ainda.
          </p>
        )}
        {withConversation.map((booking) => (
          <MyBookingCard
            key={booking.id}
            booking={{ ...booking, conversationId: booking.conversation!.id }}
          />
        ))}
      </div>
      <BottomNav />
    </main>
  );
}
