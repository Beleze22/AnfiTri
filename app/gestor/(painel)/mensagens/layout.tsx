export default function MensagensLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="flex h-screen">{children}</div>;
}
