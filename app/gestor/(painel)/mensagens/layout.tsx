export default function MensagensLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // No mobile desconta a topbar do gestor (h-14 — ver Sidebar.tsx) para o
  // campo de mensagem não ficar abaixo da dobra.
  return (
    <div className="flex h-[calc(100dvh-3.5rem)] md:h-screen">{children}</div>
  );
}
