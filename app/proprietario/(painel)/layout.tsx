import { redirect } from "next/navigation";

import { OwnerNav } from "@/components/owner/OwnerNav";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/server/auth/session";

// O proxy.ts já barra quem não tem o papel; esta checagem existe porque o
// layout também busca o nome do dono e precisa da sessão de qualquer forma.
export default async function ProprietarioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session || session.role !== "proprietario") {
    redirect("/proprietario/login");
  }

  const dono = await prisma.user.findUniqueOrThrow({
    where: { id: session.sub },
    select: { name: true },
  });

  return (
    <div className="min-h-screen bg-bg">
      <OwnerNav nome={dono.name} />
      <main>{children}</main>
    </div>
  );
}
