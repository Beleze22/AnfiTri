"use client";

import {
  IconCalendarWeek,
  IconHome2,
  IconLayoutDashboard,
  IconMenu2,
  IconMessageCircle2,
  IconSettings,
  IconTag,
  IconX,
} from "@tabler/icons-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

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

function isActive(pathname: string, href: string) {
  return href === "/gestor"
    ? pathname === "/gestor"
    : pathname.startsWith(href);
}

// Navegação do gestor (design-ui-ux.md, seção 3.7). O painel prioriza
// notebook: sidebar fixa a partir de md. Abaixo disso vira topbar + drawer —
// são 6 itens, demais para um bottom nav como o da área pública.
export function Sidebar({ managerName }: { managerName: string }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);

  // Polling do contador de não-lidas — alimenta a bolinha em "Mensagens"
  // (e no botão do menu mobile). 30s é suficiente para notificação passiva;
  // dentro da conversa o polling é o do MessageThread (5s).
  useEffect(() => {
    function check() {
      fetch("/api/manager/unread")
        .then((response) => response.json())
        .then((data) => setHasUnread(Boolean(data.unread)))
        .catch(() => {});
    }
    check();
    const interval = setInterval(check, 30_000);
    window.addEventListener("focus", check);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", check);
    };
  }, [pathname]);

  const unreadDot = (
    <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-accent" />
  );

  const navItems = (
    <nav className="flex-1">
      {ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            // Navegar fecha o drawer — este componente vive no layout e não
            // desmonta na troca de rota. Inócuo na sidebar desktop.
            onClick={() => setDrawerOpen(false)}
            className={`flex items-center gap-2.5 border-r-2 px-4 py-2.5 text-body ${
              active
                ? "border-accent bg-accent-light text-accent-dark"
                : "border-transparent text-text-secondary"
            }`}
          >
            <Icon size={18} />
            {item.label}
            {item.href === "/gestor/mensagens" && hasUnread && unreadDot}
          </Link>
        );
      })}
    </nav>
  );

  const footer = (
    <div className="border-t border-border px-4 py-3 text-caption text-text-secondary">
      <p>{managerName}</p>
      <form action="/api/auth/logout" method="post">
        <button type="submit" className="mt-1 underline">
          Sair
        </button>
      </form>
    </div>
  );

  return (
    <>
      {/* Topbar mobile — mesma altura (h-14) usada no cálculo de altura da
          tela de mensagens; mudar aqui exige mudar lá. */}
      <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-border bg-surface px-4 md:hidden">
        <span className="text-card-title font-semibold text-text-primary">
          anfitri
        </span>
        <button
          type="button"
          aria-label="Abrir menu"
          onClick={() => setDrawerOpen(true)}
          className="relative p-1 text-text-primary"
        >
          <IconMenu2 size={24} />
          {/* Não-lidas visíveis sem abrir o drawer. */}
          {hasUnread && (
            <span className="absolute right-0 top-0 h-2 w-2 rounded-full bg-accent" />
          )}
        </button>
      </header>

      {/* Drawer mobile */}
      <div
        onClick={() => setDrawerOpen(false)}
        className={`fixed inset-0 z-20 bg-[rgba(39,39,39,0.25)] transition-opacity md:hidden ${
          drawerOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <aside
        className={`fixed inset-y-0 right-0 z-30 flex w-65 max-w-[80vw] flex-col bg-surface shadow-lg transition-transform md:hidden ${
          drawerOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-4 py-4">
          <span className="text-card-title font-semibold text-text-primary">
            anfitri
          </span>
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={() => setDrawerOpen(false)}
            className="p-1 text-text-secondary"
          >
            <IconX size={22} />
          </button>
        </div>
        {navItems}
        {footer}
      </aside>

      {/* Sidebar desktop */}
      <aside className="hidden h-screen w-50 shrink-0 flex-col border-r border-border bg-surface md:flex">
        <div className="px-4 py-5 text-card-title font-semibold text-text-primary">
          anfitri
        </div>
        {navItems}
        {footer}
      </aside>
    </>
  );
}
