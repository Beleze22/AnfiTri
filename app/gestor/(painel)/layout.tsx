import { redirect } from "next/navigation";

import { Sidebar } from "@/components/manager/Sidebar";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/server/auth/session";

export default async function PainelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session || session.role !== "gestor") {
    redirect("/gestor/login");
  }

  const manager = await prisma.user.findUniqueOrThrow({
    where: { id: session.sub },
  });

  return (
    // Mobile: bloco (topbar em cima, conteúdo embaixo). md+: sidebar ao lado.
    <div className="md:flex">
      <Sidebar managerName={manager.name} />
      <main className="min-h-screen flex-1 bg-bg">{children}</main>
    </div>
  );
}
