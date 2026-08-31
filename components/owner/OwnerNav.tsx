"use client";

import { IconCalendarWeek, IconChartBar } from "@tabler/icons-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Navegação enxuta de propósito: o proprietário tem duas telas e nenhuma
// ação de escrita. Uma sidebar como a do gestor sugeriria um painel de
// gerenciamento que ele não tem.
const ITENS = [
  { href: "/proprietario", rotulo: "Desempenho", icone: IconChartBar },
  {
    href: "/proprietario/calendario",
    rotulo: "Ocupação",
    icone: IconCalendarWeek,
  },
];

export function OwnerNav({ nome }: { nome: string }) {
  const pathname = usePathname();

  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 md:px-6">
        <span className="text-caption font-semibold tracking-widest text-accent uppercase">
          anfitri
        </span>

        <nav className="flex gap-1">
          {ITENS.map((item) => {
            const ativo =
              item.href === "/proprietario"
                ? pathname === "/proprietario"
                : pathname.startsWith(item.href);
            const Icone = item.icone;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-body ${
                  ativo
                    ? "bg-accent-light text-accent-dark"
                    : "text-text-secondary"
                }`}
              >
                <Icone size={17} />
                {item.rotulo}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3 text-caption text-text-secondary">
          <span>{nome}</span>
          <form action="/api/auth/logout" method="post">
            <button type="submit" className="underline">
              Sair
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
