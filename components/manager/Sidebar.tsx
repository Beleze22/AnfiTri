"use client";

import {
  IconCalendarWeek,
  IconHome2,
  IconLayoutDashboard,
  IconMessageCircle2,
  IconSettings,
  IconTag,
} from "@tabler/icons-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/gestor", label: "Dashboard", icon: IconLayoutDashboard },
  { href: "/gestor/hospedagens", label: "Hospedagens", icon: IconHome2 },
  { href: "/gestor/calendario", label: "Calendário", icon: IconCalendarWeek },
  { href: "/gestor/mensagens", label: "Mensagens", icon: IconMessageCircle2 },
  { href: "/gestor/regras-preco", label: "Regras de preço", icon: IconTag },
  {
    href: "/gestor/configuracoes",
    label: "Configurações",
    icon: IconSettings,
  },
];

// Sidebar fixa do gestor (design-ui-ux.md, seção 3.7) — layout-base de toda
// a área /gestor/*, reaproveitada por todas as telas (nunca recriada).
export function Sidebar({ managerName }: { managerName: string }) {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-[200px] shrink-0 flex-col border-r border-border bg-surface">
      <div className="px-4 py-5 text-card-title font-semibold text-text-primary">
        anfitri
      </div>

      <nav className="flex-1">
        {ITEMS.map((item) => {
          const active =
            item.href === "/gestor"
              ? pathname === "/gestor"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 border-r-2 px-4 py-2.5 text-body ${
                active
                  ? "border-accent bg-accent-light text-accent-dark"
                  : "border-transparent text-text-secondary"
              }`}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border px-4 py-3 text-caption text-text-secondary">
        <p>{managerName}</p>
        <form action="/api/auth/logout" method="post">
          <button type="submit" className="mt-1 underline">
            Sair
          </button>
        </form>
      </div>
    </aside>
  );
}
